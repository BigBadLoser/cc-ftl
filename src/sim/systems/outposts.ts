import { BodyC } from '../body';
import { ShipC } from '../combat/components';
import { PositionC } from '../crew/components';
import { AllegianceC } from '../fight/components';
import { isDormant, wake } from '../combat/dormant';
import { discoverOutpost } from '../outposts/state';
import type { Sim } from '../sim';
import { Struct } from '../structure';
import { VehicleC } from '../vehicles/components';

/** A player crew member, pod or shuttle within this many tiles (Chebyshev) of a hidden base's tiles discovers it. */
export const DISCOVER_RANGE = 6;
/** The checks run every this many ticks (outposts never move, so a short delay is fine). */
export const OUTPOST_CHECK_TICKS = 10;

const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

/**
 * Outpost discovery and breach detection (outposts/state.ts has the rules). Every OUTPOST_CHECK_TICKS, per dormant outpost: a
 * floor or door of the base next to a floor or door it does not own is a breach (someone dug into it: it wakes); a hidden one is
 * discovered by any player crew member or player vehicle within DISCOVER_RANGE of its tiles' box. Aim, damage and boarding wake
 * it in the dormancy system; digging into it in the build handlers. Deterministic: outposts in id order, crew and vehicles in id order.
 */
export function outpostSystem(sim: Sim): void {
  if (sim.tick % OUTPOST_CHECK_TICKS !== 0) return;
  const g = sim.sector.grid;
  for (const id of [...sim.world.query(ShipC)].sort((a, b) => a - b)) {
    const s = sim.world.get(id, ShipC);
    if (!s?.outpost || !isDormant(s)) continue;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    let breach = false;
    for (let y = s.y; y < s.y + s.height; y++) {
      for (let x = s.x; x < s.x + s.width; x++) {
        if (g.get('ship', x, y) !== id) continue;
        x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
        const k = g.get('struct', x, y);
        if (k !== Struct.Floor && k !== Struct.Door) continue;
        for (const [dx, dy] of N4) {
          const n = g.get('struct', x + dx, y + dy);
          if ((n === Struct.Floor || n === Struct.Door) && g.get('ship', x + dx, y + dy) !== id) breach = true;
        }
      }
    }
    if (breach) {
      wake(sim, id, 'breach');
      continue;
    }
    if (!s.outpost.hidden) continue;
    const near = (x: number, y: number) => x >= x0 - DISCOVER_RANGE && x <= x1 + DISCOVER_RANGE && y >= y0 - DISCOVER_RANGE && y <= y1 + DISCOVER_RANGE;
    let seen = false;
    for (const c of [...sim.world.query(PositionC)].sort((a, b) => a - b)) {
      if (sim.world.get(c, AllegianceC)?.faction !== 'player') continue;
      const p = sim.world.get(c, PositionC);
      if (!p) continue;
      const tx = Math.round(p.x), ty = Math.round(p.y);
      if (near(tx, ty)) seen = true;
    }
    for (const v of [...sim.world.query(VehicleC, BodyC)].sort((a, b) => a - b)) {
      const home = sim.world.get(sim.world.get(v, VehicleC)?.homeShip ?? 0, ShipC);
      const b = sim.world.get(v, BodyC);
      if (home?.faction === 'player' && b && sim.world.get(v, VehicleC)?.state !== 'stowed' && near(Math.floor(b.x), Math.floor(b.y))) seen = true;
    }
    if (seen) discoverOutpost(sim, id, 'proximity');
  }
}
