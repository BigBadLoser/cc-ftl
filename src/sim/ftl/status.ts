import { CombatC, IonC, ShipC } from '../combat/components';
import { mannedConsole } from '../combat/operators';
import { CrewC, DeadC, JobC, PositionC } from '../crew/components';
import { isIncapacitated } from '../crew/helpers';
import { ModuleC } from '../modules/components';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { FTL_CHARGE_SEC } from '../tuning';

/** Why a ship's drive cannot be charged right now. */
export type FtlBlock = 'noShip' | 'notActive' | 'noHelm' | 'helmOffline' | 'noEngines' | 'noCrewAboard';

/** The state of the drive as the player sees it. 'waiting': ordered but nobody can sit at the helm yet. */
export type FtlState = 'idle' | 'waiting' | 'heading' | 'charging' | 'ready';

export interface FtlStatus {
  state: FtlState;
  /** Why it cannot charge (the order may still stand and resume once fixed), or null. */
  blocker: FtlBlock | null;
  charge: number;
  max: number;
  /** A charge order stands. */
  ordered: boolean;
  /** A jump is queued for when the drive is charged (the route, without the current node). */
  jump: string[] | null;
  /** The crew member walking to or sitting at the helm (0 = none) and their name. */
  pilot: number;
  pilotName: string | null;
}

/** The helm modules of a ship that work (powered, intact, not ionised) and the ones that exist. */
function helmsOf(sim: Sim, ship: number): { any: boolean; working: number[] } {
  const out = { any: false, working: [] as number[] };
  for (const id of sim.world.query(ModuleC)) {
    const m = sim.world.get(id, ModuleC);
    if (!m || sim.content.modules[m.def]?.console !== 'helm' || shipIdOf(sim, m) !== ship) continue;
    out.any = true;
    if (m.powered && m.hp > 0 && !sim.world.has(id, IonC)) out.working.push(id);
  }
  return out;
}

/** True if a powered, intact engine runs on the ship (the drive only charges with one). */
function hasEngine(sim: Sim, ship: number): boolean {
  for (const id of sim.world.query(ModuleC)) {
    const m = sim.world.get(id, ModuleC);
    const def = m && sim.content.modules[m.def];
    if (m && def?.engine && m.powered && m.hp > 0 && !sim.world.has(id, IonC) && shipIdOf(sim, m) === ship) return true;
  }
  return false;
}

/** The first thing that stops the ship's drive charging, or null. */
export function ftlBlocker(sim: Sim, ship: number): FtlBlock | null {
  const s = sim.world.get(ship, ShipC);
  if (!s || !sim.world.has(ship, CombatC) || s.faction !== 'player') return 'noShip';
  if (s.state !== 'active' || sim.sector.state !== 'active') return 'notActive';
  const helms = helmsOf(sim, ship);
  if (!helms.any) return 'noHelm';
  if (!helms.working.length) return 'helmOffline';
  if (!hasEngine(sim, ship)) return 'noEngines';
  for (const id of sim.world.query(CrewC, PositionC)) {
    if (!sim.world.has(id, DeadC) && !isIncapacitated(sim, id) && shipIdOf(sim, sim.world.get(id, PositionC)) === ship) return null;
  }
  return 'noCrewAboard';
}

/** The open operate job of a ship's helm: its id and the crew member who reserved it (0 = none). */
export function helmJob(sim: Sim, ship: number): { id: number; by: number; module: number } | null {
  for (const id of sim.world.query(JobC)) {
    const job = sim.world.get(id, JobC);
    if (job?.kind !== 'operate') continue;
    const m = sim.world.get(job.target ?? 0, ModuleC);
    if (m && sim.content.modules[m.def]?.console === 'helm' && shipIdOf(sim, m) === ship) return { id, by: job.reservedBy, module: job.target as number };
  }
  return null;
}

/** The drive's state for the UI: idle, waiting for a pilot, a pilot heading to the helm, charging, or ready. */
export function ftlStatus(sim: Sim, ship: number): FtlStatus | null {
  const combat = sim.world.get(ship, CombatC);
  if (!combat) return null;
  const order = combat.ftlOrder ?? null;
  const blocker = ftlBlocker(sim, ship);
  const job = order ? helmJob(sim, ship) : null;
  const sitting = order && !blocker ? mannedConsole(sim, ship, 'helm') : null;
  const pilot = sitting?.crew ?? job?.by ?? 0;
  let state: FtlState = 'idle';
  if (combat.ftl + 1e-9 >= FTL_CHARGE_SEC) state = 'ready';
  else if (order && !blocker) state = sitting ? 'charging' : job?.by ? 'heading' : 'waiting';
  else if (order) state = 'waiting';
  return {
    state, blocker, charge: combat.ftl, max: FTL_CHARGE_SEC, ordered: !!order, jump: order?.jump ?? null,
    pilot, pilotName: pilot ? sim.world.get(pilot, CrewC)?.name ?? null : null,
  };
}
