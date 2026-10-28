import type { Command } from '../commands';
import { shipById } from '../combat/ships';
import { AllegianceC } from '../fight/components';
import { isOffDuty } from '../fight/relations';
import { totalStock } from '../items/stock';
import { dropCarried, structCostKey } from '../items/stacks';
import { ModuleC } from '../modules/components';
import { shipGrid, shipIdOf } from '../regions';
import { findSuitSource } from '../eva/errands';
import { planSiteWalk } from '../eva/route';
import { heldForMend } from '../robots/jobs';
import type { Sim } from '../sim';
import { Struct } from '../structure';
import type { Grid } from '../grid';
import { roomTiles } from '../roomIndex';
import {
  AssignmentC, CrewC, DamageOrderC, DraftedC, EatC, JobC, NeedsC, PathC, PositionC, PrioritiesC,
  type DamageOrder, type Job, type Position,
} from './components';
import { BUILD_TICKS, createJob } from './handlers';
import { clearPath, findJobAt, isIncapacitated, jobGoal, origin, releaseAssignment } from './helpers';
import type { Tile } from './pathfind';

/**
 * One-click damage control (#181). An order is a command that reuses the colony's own machinery: it picks the nearest able
 * crew member and reserves for them the very jobs the colony already posts (extinguish a burning tile, repair a module, or a
 * wall build on the hole), exactly as the job picker would, only ignoring their work priorities. The crew member keeps a
 * `DamageOrderC` while it lasts: when one job is done the next one of the same order is taken (fire tile by tile, hole by hole),
 * and when nothing is left (or they cannot go on) they return to the console they were manning, if any.
 *
 * Who can be pulled (an "able" crew member): the player's, awake, rested, not drafted (their orders are the player's own),
 * not off duty (fighting, fetching a weapon, surrendered), not in the middle of a meal, rescue or suit errand, and able to
 * walk to the job (in a suit from an airlock when the way is thin air). Of those the order prefers, in turn:
 *   tier 0: anyone not manning a console (their job is let go);
 *   tier 1: operators of a shield console;
 *   tier 2: operators of the helm or a weapons console, only when nobody else can reach the job.
 * Nearest by walking distance wins within a tier. A taken-off operator keeps the console reserved, so nobody else wanders in
 * and the post stays theirs; the console stands empty meanwhile. Doors and venting stay manual.
 */
type DamageCommandType = Extract<Command['type'], `damage.${string}` | 'module.priorityRepair'>;
type Handler<T extends DamageCommandType> = (sim: Sim, cmd: Extract<Command, { type: T }>) => void;

/** Rest below which the decide system sends a crew member to bed (kept in step with it): they are not able. */
const TIRED_BELOW = 20;
const TIER_STATION = 1;
const TIER_FIRST_STATION = 2;

function reject(sim: Sim, command: string, reason: string): void {
  sim.events.emit({ type: 'command.rejected', command, reason });
}

/** Burning tiles (sector coordinates) of a room. */
export function roomFireTiles(grid: Grid, room: number): Tile[] {
  if (!grid.has('fire') || !grid.has('room')) return [];
  const out: Tile[] = [];
  for (const i of roomTiles(grid).get(room) ?? []) {
    const x = grid.x0 + (i % grid.width);
    const y = grid.y0 + Math.floor(i / grid.width);
    if (grid.get('fire', x, y) > 0) out.push({ x, y });
  }
  return out;
}

/** Open-space tiles (sector coordinates) touching a room's floor: the holes in its hull. */
export function roomBreachTiles(grid: Grid, room: number): Tile[] {
  if (!grid.has('room')) return [];
  const seen = new Set<number>();
  const out: Tile[] = [];
  for (const i of roomTiles(grid).get(room) ?? []) {
    const x = grid.x0 + (i % grid.width);
    const y = grid.y0 + Math.floor(i / grid.width);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (!grid.inBounds(nx, ny) || grid.get('struct', nx, ny) !== Struct.Space || seen.has(ny * 100000 + nx)) continue;
      seen.add(ny * 100000 + nx);
      out.push({ x: nx, y: ny });
    }
  }
  return out;
}

const playerShip = (sim: Sim, shipId: number): boolean => shipById(sim, shipId)?.faction === 'player';

/** Whether a crew member may be given a damage-control job now (see the notes above). */
function able(sim: Sim, id: number): boolean {
  const crew = sim.world.get(id, CrewC);
  const needs = sim.world.get(id, NeedsC);
  if (!crew || !needs || !sim.world.has(id, PositionC) || !sim.world.has(id, PathC) || !sim.world.has(id, PrioritiesC)) return false;
  if (sim.world.get(id, AllegianceC)?.faction !== 'player' || isIncapacitated(sim, id) || isOffDuty(sim, id)) return false;
  if (sim.world.has(id, DraftedC) || sim.world.has(id, EatC) || heldForMend(sim, id)) return false;
  if (crew.activity === 'sleeping' || crew.activity === 'eating' || crew.activity === 'charging' || needs.rest < TIRED_BELOW) return false;
  const job = sim.world.get(sim.world.get(id, AssignmentC)?.jobId ?? 0, JobC);
  return !job || !(job.kind === 'rescue' || job.kind === 'suitUp' || job.kind === 'suitOff');
}

/** 0 for crew free to go, higher for the ones holding a console (see the notes above). */
function tierOf(sim: Sim, id: number): number {
  const job = sim.world.get(sim.world.get(id, AssignmentC)?.jobId ?? 0, JobC);
  if (job?.kind !== 'operate') return 0;
  const m = sim.world.get(job.target ?? 0, ModuleC);
  const console = m && sim.content.modules[m.def]?.console;
  return console === 'helm' || console === 'weapons' ? TIER_FIRST_STATION : TIER_STATION;
}

interface Pick { crew: number; job: number; steps: number; tier: number }

/** The best crew member (restricted to `only`, if given) to take any of `jobs`: lowest tier, then shortest walk. */
function bestPick(sim: Sim, shipId: number, jobs: readonly number[], only?: number): Pick | null {
  let best: Pick | null = null;
  for (const id of only ? [only] : sim.world.query(CrewC)) {
    if (!able(sim, id) || (!only && sim.world.has(id, DamageOrderC))) continue;
    const pos = sim.world.get(id, PositionC) as Position;
    if (shipIdOf(sim, pos) !== shipId) continue;
    const tier = tierOf(sim, id);
    let suit: boolean | undefined;
    for (const jobId of jobs) {
      const job = sim.world.get(jobId, JobC) as Job;
      const plan = planSiteWalk(sim, id, shipId, origin(pos), jobGoal(job));
      if (!plan || (plan.thin && !(suit ??= !!findSuitSource(sim, id, pos)))) continue;
      if (!best || tier < best.tier || (tier === best.tier && plan.steps.length < best.steps)) best = { crew: id, job: jobId, steps: plan.steps.length, tier };
    }
  }
  return best;
}

/** Hand the crew member the job; the decide system walks them there (fetching a suit first when the way is thin air). */
function engage(sim: Sim, crew: number, jobId: number, order: DamageOrder): void {
  const held = sim.world.get(crew, AssignmentC);
  if (held) {
    const cur = sim.world.get(held.jobId, JobC);
    if (cur?.kind === 'operate' && cur.reservedBy === crew) {
      order.post = held.jobId; // the console stays theirs while they are away
      sim.world.remove(crew, AssignmentC);
      clearPath(sim, crew);
    } else releaseAssignment(sim, crew);
  }
  dropCarried(sim, crew);
  (sim.world.get(jobId, JobC) as Job).reservedBy = crew;
  sim.world.add(crew, AssignmentC, { jobId });
  order.job = jobId;
}

/** The jobs of this order a crew member may take now: unreserved (or already theirs). Wall builds for holes are posted when missing and affordable. */
function targetJobs(sim: Sim, order: DamageOrder, crew: number): number[] {
  const grid = shipGrid(sim, order.ship);
  if (!grid) return [];
  const free = (j: Job): boolean => j.reservedBy === 0 || j.reservedBy === crew;
  const out: number[] = [];
  if (order.kind === 'breach') {
    for (const t of roomBreachTiles(grid, order.room)) {
      let id = findJobAt(sim, order.ship, t.x, t.y);
      if (!id) {
        if (!canAffordWall(sim)) continue;
        id = createJob(sim, 'build', order.ship, t.x, t.y, Struct.Wall, BUILD_TICKS[Struct.Wall] as number);
      }
      const j = sim.world.get(id, JobC);
      if (j && j.kind === 'build' && j.struct === Struct.Wall && free(j)) out.push(id);
    }
    return out;
  }
  const fire = order.kind === 'fire' ? roomFireTiles(grid, order.room) : [];
  for (const id of sim.world.query(JobC)) {
    const j = sim.world.get(id, JobC) as Job;
    if (!free(j) || shipIdOf(sim, j) !== order.ship) continue;
    if (order.kind === 'repair' ? j.kind === 'repair' && j.target === order.module : j.kind === 'extinguish' && fire.some((t) => t.x === j.x && t.y === j.y)) out.push(id);
  }
  return out;
}

function canAffordWall(sim: Sim): boolean {
  const key = structCostKey(Struct.Wall);
  return (key ? sim.content.structCosts[key] ?? [] : []).every((q) => totalStock(sim, q.item) >= q.count);
}

/** The order is over (or cannot go on): let go of its job and, if wanted and possible, go back to the console. */
function finish(sim: Sim, crew: number, returnToPost: boolean): void {
  const order = sim.world.get(crew, DamageOrderC);
  if (!order) return;
  sim.world.remove(crew, DamageOrderC);
  const held = sim.world.get(crew, AssignmentC);
  if (held && held.jobId === order.job) releaseAssignment(sim, crew);
  const post = sim.world.get(order.post, JobC);
  if (!post || post.reservedBy !== crew) return;
  if (returnToPost && !sim.world.has(crew, AssignmentC)) sim.world.add(crew, AssignmentC, { jobId: order.post });
  else if (!returnToPost) post.reservedBy = 0;
}

/** Take the next job of the order, or finish it. */
function advance(sim: Sim, crew: number, order: DamageOrder): void {
  const pick = bestPick(sim, order.ship, targetJobs(sim, order, crew), crew);
  if (pick) engage(sim, crew, pick.job, order);
  else finish(sim, crew, true);
}

/**
 * Once a tick (end of the auto-jobs system, so job lists are fresh): ordered crew take the next job when theirs is done, and
 * orders end when the crew member can no longer do them (downed, drafted by the player, sent off to fight).
 */
export function settleDamageOrders(sim: Sim): void {
  for (const crew of [...sim.world.query(DamageOrderC)]) {
    const order = sim.world.get(crew, DamageOrderC) as DamageOrder;
    if (!sim.world.has(crew, CrewC) || !able(sim, crew)) {
      finish(sim, crew, false);
      continue;
    }
    const job = sim.world.get(order.job, JobC);
    const held = sim.world.get(crew, AssignmentC);
    if (job && job.reservedBy === crew) {
      // On the job, or fitting a suit for it (the errand points back at it). Anything else means something took them off it.
      const cur = held && sim.world.get(held.jobId, JobC);
      if (!held || held.jobId === order.job || cur?.resume === order.job) continue;
      finish(sim, crew, false);
      continue;
    }
    advance(sim, crew, order);
  }
}

function start(sim: Sim, type: string, order: Omit<DamageOrder, 'job' | 'post'>, jobs: number[]): void {
  if (!jobs.length) return reject(sim, type, 'alreadyHandled');
  const pick = bestPick(sim, order.ship, jobs);
  if (!pick) return reject(sim, type, 'noAbleCrew');
  const full: DamageOrder = { ...order, job: 0, post: 0 };
  engage(sim, pick.crew, pick.job, full);
  sim.world.add(pick.crew, DamageOrderC, full);
}

export const damageHandlers: { [T in DamageCommandType]: Handler<T> } = {
  'damage.fightFire': (sim, cmd) => {
    const grid = shipGrid(sim, cmd.ship);
    if (!grid || !playerShip(sim, cmd.ship)) return reject(sim, cmd.type, 'notYours');
    if (!roomFireTiles(grid, cmd.room).length) return reject(sim, cmd.type, 'noFire');
    const order = { kind: 'fire' as const, ship: cmd.ship, room: cmd.room, module: 0 };
    start(sim, cmd.type, order, targetJobs(sim, { ...order, job: 0, post: 0 }, 0));
  },
  'damage.sealBreach': (sim, cmd) => {
    const grid = shipGrid(sim, cmd.ship);
    if (!grid || !playerShip(sim, cmd.ship)) return reject(sim, cmd.type, 'notYours');
    if (!roomBreachTiles(grid, cmd.room).length) return reject(sim, cmd.type, 'noBreach');
    if (!canAffordWall(sim)) return reject(sim, cmd.type, 'noMaterials');
    const order = { kind: 'breach' as const, ship: cmd.ship, room: cmd.room, module: 0 };
    start(sim, cmd.type, order, targetJobs(sim, { ...order, job: 0, post: 0 }, 0));
  },
  'damage.repair': (sim, cmd) => {
    const m = sim.world.get(cmd.module, ModuleC);
    const def = m && sim.content.modules[m.def];
    if (!m || !def) return reject(sim, cmd.type, 'noModule');
    const ship = shipIdOf(sim, m);
    if (!playerShip(sim, ship)) return reject(sim, cmd.type, 'notYours');
    if (m.hp >= def.maxHp) return reject(sim, cmd.type, 'notDamaged');
    const order = { kind: 'repair' as const, ship, room: 0, module: cmd.module };
    start(sim, cmd.type, order, targetJobs(sim, { ...order, job: 0, post: 0 }, 0));
  },
  'module.priorityRepair': (sim, cmd) => {
    const m = sim.world.get(cmd.id, ModuleC);
    const def = m && sim.content.modules[m.def];
    if (!m || !def) return reject(sim, cmd.type, 'noModule');
    if (!cmd.on) return void delete m.repairFirst;
    if (m.hp >= def.maxHp) return reject(sim, cmd.type, 'notDamaged');
    let top = 0;
    for (const id of sim.world.query(ModuleC)) top = Math.max(top, sim.world.get(id, ModuleC)?.repairFirst ?? 0);
    m.repairFirst = top + 1;
  },
};
