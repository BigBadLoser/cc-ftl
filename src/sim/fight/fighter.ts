import { releaseBedClaim } from '../crew/beds';
import { AssignmentC, CarriedC, CrewC, DraftedC, HealthC, JobC, PathC, PositionC, type Crew, type Path, type Position } from '../crew/components';
import { clearPath, facingOf, isSettled, origin, releaseAssignment } from '../crew/helpers';
import { findPath } from '../crew/pathfind';
import { dropCarried } from '../items/stacks';
import type { Grid } from '../grid';
import { ModuleC } from '../modules/components';
import { accessTile } from '../modules/footprint';
import type { Sim } from '../sim';
import { CHASE_REPLAN_TICKS, COMBAT_SIGHT, FLEE_REPLAN_TICKS } from '../tuning';
import { AllegianceC, FighterC, type Fighter } from './components';
import { fleePath } from './flee';
import { sightLine, type Cover } from './los';
import { isCombatReady, isHostile, isInvader, isPlayerControlled } from './relations';
import { armorOf } from '../robots/core';
import { stunCrew } from '../robots/halt';
import { surrender, wantsToSurrender } from './surrender';
import { cooldownTicks, hitChance, isArmed, wielded } from './weapons';
import { gridIdOf } from '../regions';

/** Combat-ready crew with an allegiance, grouped by grid, each list in ascending id order. */
export function combatReadyUnits(sim: Sim): Map<number, number[]> {
  const out = new Map<number, number[]>();
  for (const id of sim.world.query(AllegianceC, PositionC)) {
    if (!isCombatReady(sim, id)) continue;
    const gridId = gridIdOf(sim, sim.world.get(id, PositionC));
    const list = out.get(gridId);
    if (list) list.push(id);
    else out.set(gridId, [id]);
  }
  return out;
}

const dist = (a: Position, b: Position): number => Math.hypot(a.x - b.x, a.y - b.y);

function fighterOf(sim: Sim, id: number): Fighter {
  let f = sim.world.get(id, FighterC);
  if (!f) {
    f = { mode: 'idle', target: 0, ordered: 0, engage: true, cooldown: 0, planned: -1000 };
    sim.world.add(id, FighterC, f);
  }
  return f;
}

/** True while the crew member carries a patient on a rescue job: they finish it rather than flee or fight. */
function carryingPatient(sim: Sim, id: number): boolean {
  const a = sim.world.get(id, AssignmentC);
  const job = a && sim.world.get(a.jobId, JobC);
  return !!job && job.kind === 'rescue' && sim.world.get(job.target ?? 0, CarriedC)?.carrier === id;
}

/** Enter or leave a fighting mode. Leaving idle drops the colony chores; leaving a fight forgets the chase path. */
function setMode(sim: Sim, id: number, f: Fighter, mode: Fighter['mode']): void {
  if (f.mode === mode) return;
  if (f.mode === 'idle') {
    releaseAssignment(sim, id);
    releaseBedClaim(sim, id);
    dropCarried(sim, id);
    const crew = sim.world.get(id, CrewC) as Crew;
    if (crew.activity === 'sleeping' || crew.activity === 'charging' || crew.activity === 'eating') crew.activity = 'idle';
  } else if (mode === 'idle' && !sim.world.get(id, DraftedC)?.target) clearPath(sim, id);
  f.mode = mode;
  if (mode === 'idle') {
    f.target = 0;
    delete f.goal;
  }
}

/** Walk to `goal` (adjacent to it if `adjacent`), replanning when idle on the way or when the goal moved. */
function walkTo(sim: Sim, id: number, f: Fighter, pos: Position, goal: { x: number; y: number }, adjacent: boolean): void {
  const path = sim.world.get(id, PathC) as Path;
  const moved = !f.goal || f.goal.x !== goal.x || f.goal.y !== goal.y;
  const idle = path.steps.length === 0 && isSettled(pos);
  if (!idle && !(moved && sim.tick - f.planned >= CHASE_REPLAN_TICKS)) return;
  const steps = findPath(sim, gridIdOf(sim, pos), origin(pos), { ...goal, adjacent });
  f.planned = sim.tick;
  f.goal = { x: goal.x, y: goal.y };
  if (steps) {
    path.steps = steps;
    delete path.then;
  } else clearPath(sim, id);
}

/** The grid's bridge if it has one (so boarders go hold it, which captures the ship), else its nearest console: a boarder's objective, as an access tile. */
function consoleObjective(sim: Sim, gridId: number, from: Position): { x: number; y: number } | null {
  let best: { x: number; y: number } | null = null;
  let bestD = Infinity;
  for (const mid of sim.world.query(ModuleC)) {
    const m = sim.world.get(mid, ModuleC);
    const def = m && sim.content.modules[m.def];
    if (!m || !def?.console || gridIdOf(sim, m) !== gridId || m.hp <= 0) continue;
    const at = accessTile(def, m.x, m.y, m.rot);
    const d = (at ? Math.hypot(at.x - from.x, at.y - from.y) : Infinity) + (def.bridge || def.console === 'helm' ? 0 : 1000);
    if (at && d < bestD) {
      best = at;
      bestD = d;
    }
  }
  return best;
}

/** One crew member's combat turn. `units` are the combat-ready crew of the grid (ascending ids). */
export function stepFighter(sim: Sim, grid: Grid, id: number, units: readonly number[]): void {
  if (!isCombatReady(sim, id)) return; // downed or killed earlier this tick
  const pos = sim.world.get(id, PositionC) as Position;
  const f = fighterOf(sim, id);
  if (f.cooldown > 0) f.cooldown--;
  const controlled = isPlayerControlled(sim, id);
  const invader = isInvader(sim, id);
  const foes = units
    .filter((o) => o !== id && isHostile(sim, id, o) && isCombatReady(sim, o))
    .map((o) => ({ id: o, pos: sim.world.get(o, PositionC) as Position }))
    .sort((a, b) => dist(pos, a.pos) - dist(pos, b.pos) || a.id - b.id);

  if (foes.length === 0) {
    if (f.mode !== 'idle') setMode(sim, id, f, 'idle');
    f.ordered = 0;
    if (invader && !controlled && sim.world.get(id, CrewC)?.activity !== 'sleeping' && !sim.world.has(id, AssignmentC)) {
      const goal = consoleObjective(sim, gridIdOf(sim, pos), pos);
      if (goal && (pos.x !== goal.x || pos.y !== goal.y)) walkTo(sim, id, f, pos, goal, false);
    }
    return;
  }
  const faction0 = sim.world.get(id, AllegianceC)?.faction;
  if (!controlled && wantsToSurrender(sim, id, units.filter((o) => sim.world.get(o, AllegianceC)?.faction === faction0), foes.map((o) => o.id))) return surrender(sim, id);
  if (carryingPatient(sim, id)) return;

  const crew = sim.world.get(id, CrewC) as Crew;
  const role = sim.content.roles[crew.role];
  const weapon = wielded(sim, id);
  const faction = sim.world.get(id, AllegianceC)?.faction;
  const canFight = isArmed(sim, id) || !!role?.fighter || faction !== 'player';
  const hunter = invader || !!role?.fighter;

  // The nearest foe we can see (sight range, clear line).
  let seen: (typeof foes)[number] | undefined;
  for (const o of foes) {
    if (dist(pos, o.pos) > COMBAT_SIGHT) break;
    if (sightLine(sim, grid, pos, o.pos).visible) {
      seen = o;
      break;
    }
  }

  let target: (typeof foes)[number] | undefined;
  if (controlled) {
    const ordered = f.ordered ? foes.find((o) => o.id === f.ordered) : undefined;
    if (f.ordered && !ordered) f.ordered = 0;
    target = ordered ?? (f.engage && canFight ? seen : undefined);
  } else if (canFight) target = seen ?? (hunter ? foes[0] : undefined);
  else if (seen && !sim.content.species[crew.species]?.fearless) return flee(sim, grid, id, f, pos, foes.filter((o) => dist(pos, o.pos) <= COMBAT_SIGHT).map((o) => o.pos));

  if (!target) {
    setMode(sim, id, f, 'idle');
    return;
  }
  setMode(sim, id, f, 'engage');
  f.target = target.id;
  const moveOrder = controlled && !!sim.world.get(id, DraftedC)?.target;
  const d = dist(pos, target.pos);
  const adjacent = Math.max(Math.abs(pos.x - target.pos.x), Math.abs(pos.y - target.pos.y)) <= 1;
  let cover: Cover = 'none';
  let inReach = adjacent;
  if (weapon.def.kind === 'ranged') {
    const line = d <= weapon.def.range ? sightLine(sim, grid, pos, target.pos) : { visible: false, cover };
    cover = line.cover;
    inReach = line.visible;
  }
  if (!inReach) {
    if (!moveOrder) walkTo(sim, id, f, pos, target.pos, true);
    return;
  }
  if (moveOrder || !isSettled(pos)) return; // no firing on the move
  clearPath(sim, id);
  if (f.cooldown > 0) return;
  attack(sim, id, f, target.id, target.pos, pos, weapon, d, cover);
}

function attack(
  sim: Sim, id: number, f: Fighter, targetId: number, tpos: Position, pos: Position,
  weapon: ReturnType<typeof wielded>, d: number, cover: Cover,
): void {
  f.cooldown = cooldownTicks(weapon.def);
  pos.facing = facingOf(tpos.x - pos.x, tpos.y - pos.y, pos.facing);
  sim.events.emit({
    type: 'crew.attacked', crew: id, target: targetId, weapon: weapon.item, ranged: weapon.def.kind === 'ranged',
    gridId: gridIdOf(sim, pos), x: pos.x, y: pos.y, tx: tpos.x, ty: tpos.y,
  });
  if (!sim.rng.chance(hitChance(sim, id, weapon.def, d, cover))) {
    sim.events.emit({ type: 'crew.miss', crew: id, target: targetId, cover });
    return;
  }
  const health = sim.world.get(targetId, HealthC);
  const damage = weapon.def.damage * (1 - armorOf(sim, targetId));
  if (health) health.hp = Math.max(0, health.hp - damage); // vitals downs them next tick
  sim.events.emit({ type: 'crew.hit', crew: id, target: targetId, damage, hp: health?.hp ?? 0, cover });
  if (weapon.def.ion) stunCrew(sim, targetId);
}

/** Unarmed non-fighters run from hostiles they can see: replan every FLEE_REPLAN_TICKS or when the path runs out. */
function flee(sim: Sim, grid: Grid, id: number, f: Fighter, pos: Position, threats: Position[]): void {
  setMode(sim, id, f, 'flee');
  const path = sim.world.get(id, PathC) as Path;
  const idle = path.steps.length === 0 && isSettled(pos);
  if (!idle && sim.tick - f.planned < FLEE_REPLAN_TICKS) return;
  f.planned = sim.tick;
  const steps = fleePath(sim, grid, origin(pos), threats);
  if (steps) {
    path.steps = steps;
    delete path.then;
  }
}
