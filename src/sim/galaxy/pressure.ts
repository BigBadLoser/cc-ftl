import type { Sim } from '../sim';
import { atWarContent } from './relations';
import { controlOf, nodeOwnerAt, tidyControl } from './control';
import { nodeOf } from './state';
import { PRESSURE_EPS, PRESSURE_MAX } from './tuningCoarse';

/**
 * Pressure on a sector: an enemy faction pushing on it (`SectorControl.pressure`). The coarse tick (coarse.ts) builds it at the fronts and decays it;
 * the fine tier adds to it here when real outcomes happen in the fleet area, so the player's choices and the fleets' fights near a border move it.
 */

/** Pressure one fine-tier outcome adds: a base, plus per ship lost; a raid on a den counts double. */
const FINE_BASE = 0.12;
const FINE_PER_LOSS = 0.1;
const FINE_RAID = 2;

/**
 * Faction `by` pushed on the sector holding `node` by `amount`. Against the sector's owner this builds pressure (when the two are at war); `by` the owner
 * (it won a fight at home) it relieves pressure instead. A push by another faction than the one already pushing first wears that pressure down.
 */
export function addPressure(sim: Sim, node: string, by: string, amount: number): void {
  const content = sim.content.galaxy;
  const n = nodeOf(sim, node);
  if (!content || !n || amount <= 0) return;
  const owner = nodeOwnerAt(sim, node);
  if (owner === null) return;
  const c = controlOf(sim, n.sector);
  const cur = c.pressure;
  if (by === owner || !atWarContent(content, by, owner)) {
    if (by === owner && cur) {
      cur.value -= amount;
      if (cur.value < PRESSURE_EPS) delete c.pressure;
    }
  } else if (cur && cur.by !== by) {
    cur.value -= amount;
    if (cur.value < 0) c.pressure = { by, value: -cur.value, ticks: 0 };
  } else {
    c.pressure = { by, value: Math.min(PRESSURE_MAX, (cur?.value ?? 0) + amount), ticks: cur?.ticks ?? 0 };
  }
  tidyControl(sim, n.sector);
}

/** A real fight settled at `node` (meetings.ts): `winner` beat `loser`, who lost `lost` ships; `raid` = a patrol raiding a den. Feeds `addPressure` for whichever side holds the ground. */
export function fightPressure(sim: Sim, node: string, winner: string, loser: string, lost: number, raid: boolean): void {
  const owner = nodeOwnerAt(sim, node);
  if (owner !== winner && owner !== loser) return;
  addPressure(sim, node, winner, (FINE_BASE + FINE_PER_LOSS * lost) * (raid ? FINE_RAID : 1));
}
