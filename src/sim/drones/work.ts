import { shipById } from '../combat/ships';
import { CarriedC, CrewC, DeadC, DownedC, HealthC, PositionC } from '../crew/components';
import { douseTile, repairModule, type WorkResult } from '../crew/jobWork';
import { AllegianceC } from '../fight/components';
import { ModuleC } from '../modules/components';
import { footprintTiles } from '../modules/footprint';
import { isTileWalkable } from '../modules/walk';
import { shipGrid, shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { ShipC } from '../combat/components';
import { TICK_HZ } from '../time';
import { EXTINGUISH_PER_SEC, REPAIR_PER_SEC } from '../tuning';
import type { Drone, DroneTarget } from './components';
import { intercept } from './intercept';
import type { DroneJobDef, DroneJobKind } from './types';

/** A candidate target and its rank within its kind (lower first: a downed patient before a scratched one). */
export interface Candidate extends DroneTarget {
  rank: number;
}

/**
 * How the drone system finds and works each job kind (DESIGN.md "Drones": a type's job list is a direct target query). Every drone type
 * goes through this one table; a type differs only in which kinds its def lists and their numbers.
 */
export interface KindRules<J extends DroneJobDef> {
  /** Where the work is: inside the drone's ship (tile flight) or out in space (free flight; it launches through its bay's hatch). Default inside. */
  where?: 'inside' | 'space';
  /** Any number of drones may share one target of this kind (no claim). */
  shared?: boolean;
  /** Every target of this kind on the ship that needs the work now. */
  candidates(sim: Sim, ship: number, job: J): Candidate[];
  /** The target still needs this work; it may update where to hover (`x`, `y`: a patient who moved). */
  valid(sim: Sim, ship: number, t: DroneTarget, job: J): boolean;
  /** One tick of work by a drone hovering on the target (inside), or one tick of the job in space, where the job steers the drone itself. */
  work(sim: Sim, id: number, d: Drone, t: DroneTarget, job: J): WorkResult;
}

const onWreck = (sim: Sim, ship: number): boolean => sim.world.get(ship, ShipC)?.state === 'wreck';

const repair: KindRules<Extract<DroneJobDef, { kind: 'repair' }>> = {
  candidates(sim, ship) {
    if (onWreck(sim, ship)) return [];
    const out: Candidate[] = [];
    for (const id of sim.world.query(ModuleC)) {
      const m = sim.world.get(id, ModuleC);
      const def = m && sim.content.modules[m.def];
      if (!m || !def || m.hp >= def.maxHp || shipIdOf(sim, m) !== ship) continue;
      const at = workSpot(sim, ship, footprintTiles(def, m.x, m.y, m.rot));
      if (at) out.push({ kind: 'repair', id, x: at.x, y: at.y, rank: 0 });
    }
    return out;
  },
  valid(sim, ship, t) {
    const m = sim.world.get(t.id, ModuleC);
    const def = m && sim.content.modules[m.def];
    return !!m && !!def && m.hp < def.maxHp && shipIdOf(sim, m) === ship;
  },
  work: (sim, _id, _d, t, job) => repairModule(sim, t.id, REPAIR_PER_SEC * job.rate),
};

/**
 * Where a drone hovers to work on a module: its first footprint tile a drone can fly to (a hull-mounted module's origin may be a wall), else
 * the first flyable tile beside the footprint. Null when there is none.
 */
function workSpot(sim: Sim, ship: number, tiles: readonly { x: number; y: number }[]): { x: number; y: number } | null {
  const grid = shipGrid(sim, ship);
  if (!grid) return null;
  const ok = (x: number, y: number): boolean => isTileWalkable(sim, grid, x, y, false, true);
  const inside = tiles.find((t) => ok(t.x, t.y));
  if (inside) return inside;
  for (const t of tiles) for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]] as const) if (ok(t.x + dx, t.y + dy)) return { x: t.x + dx, y: t.y + dy };
  return null;
}

const fireAt = (sim: Sim, ship: number, x: number, y: number): number => {
  const grid = shipGrid(sim, ship);
  return grid?.has('fire') && grid.inBounds(x, y) ? grid.get('fire', x, y) : 0;
};

const extinguish: KindRules<Extract<DroneJobDef, { kind: 'extinguish' }>> = {
  candidates(sim, ship, job) {
    const grid = shipGrid(sim, ship);
    if (!grid?.has('fire')) return [];
    const fire = grid.load('fire');
    const out: Candidate[] = [];
    for (let i = 0; i < fire.length; i++) {
      const f = fire[i] as number;
      if (f === 0 || f > job.maxFire) continue;
      const x = grid.x0 + (i % grid.width), y = grid.y0 + Math.floor(i / grid.width);
      out.push({ kind: 'extinguish', id: 0, x, y, rank: 0 });
    }
    return out;
  },
  // Once it is working a fire it keeps at it even if it flares up; a fire that grew too big before it got there is left to the crew.
  valid: (sim, ship, t) => fireAt(sim, ship, t.x, t.y) > 0,
  work: (sim, _id, d, t, job) => douseTile(sim, d.ship, t.x, t.y, EXTINGUISH_PER_SEC * job.rate),
};

type FirstAid = Extract<DroneJobDef, { kind: 'firstAid' }>;

/** 0: downed and still bleeding (patch them), 1: awake and hurt below `healTo` (heal them), -1: nothing for a first-aid drone to do. */
function aidNeed(sim: Sim, ship: number, crew: number, job: FirstAid): number {
  const c = sim.world.get(crew, CrewC);
  const pos = sim.world.get(crew, PositionC);
  const hp = sim.world.get(crew, HealthC);
  if (!c || !pos || !hp || sim.world.has(crew, DeadC) || sim.world.has(crew, CarriedC) || shipIdOf(sim, pos) !== ship) return -1;
  const species = sim.content.species[c.species];
  if (species?.mechanical || species?.creature) return -1;
  if (sim.world.get(crew, AllegianceC)?.faction !== shipById(sim, ship)?.faction) return -1;
  const downed = sim.world.get(crew, DownedC);
  if (downed) return downed.stabilized || downed.patched ? -1 : 0;
  return hp.hp < hp.max * job.healTo ? 1 : -1;
}

const firstAid: KindRules<FirstAid> = {
  candidates(sim, ship, job) {
    const out: Candidate[] = [];
    for (const id of sim.world.query(CrewC, PositionC)) {
      const rank = aidNeed(sim, ship, id, job);
      if (rank < 0) continue;
      const p = sim.world.get(id, PositionC);
      if (p) out.push({ kind: 'firstAid', id, x: p.x, y: p.y, rank });
    }
    return out;
  },
  valid(sim, ship, t, job) {
    if (aidNeed(sim, ship, t.id, job) < 0) return false;
    const p = sim.world.get(t.id, PositionC);
    if (p) [t.x, t.y] = [p.x, p.y]; // follows a patient who walks on
    return true;
  },
  work(sim, id, d, t, job) {
    const downed = sim.world.get(t.id, DownedC);
    if (downed) {
      d.work += 1 / TICK_HZ;
      if (d.work < job.patchSec) return 'working';
      downed.patched = true;
      sim.events.emit({ type: 'crew.patched', crew: t.id, by: id });
      return 'done';
    }
    const hp = sim.world.get(t.id, HealthC);
    if (!hp) return 'done';
    const cap = hp.max * job.healTo;
    hp.hp = Math.min(Math.max(hp.hp, cap), hp.hp + job.healPerSec / TICK_HZ);
    return hp.hp >= cap ? 'done' : 'working';
  },
};

const RULES: { [K in DroneJobKind]: KindRules<Extract<DroneJobDef, { kind: K }>> } = { repair, extinguish, firstAid, intercept };

/** Where a job kind's work is. */
export const jobWhere = (kind: DroneJobKind): 'inside' | 'space' => RULES[kind].where ?? 'inside';

/** The target query of one job kind. */
export function candidatesFor(sim: Sim, ship: number, job: DroneJobDef): Candidate[] {
  return (RULES[job.kind] as KindRules<DroneJobDef>).candidates(sim, ship, job);
}

/** The target still needs its work. */
export function stillWanted(sim: Sim, ship: number, t: DroneTarget, job: DroneJobDef): boolean {
  return (RULES[job.kind] as KindRules<DroneJobDef>).valid(sim, ship, t, job);
}

/** One tick of a drone's work on its target. */
export function workOn(sim: Sim, id: number, d: Drone, t: DroneTarget, job: DroneJobDef): WorkResult {
  return (RULES[job.kind] as KindRules<DroneJobDef>).work(sim, id, d, t, job);
}

/** The claim key of a target: one drone per module, patient or burning tile; '' for a kind any number of drones share. */
export const targetKey = (t: DroneTarget): string => (RULES[t.kind].shared ? '' : t.kind === 'extinguish' ? `x:${t.x},${t.y}` : `${t.kind}:${t.id}`);
