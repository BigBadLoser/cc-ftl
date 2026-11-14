import { AlienC } from '../aliens/components';
import { isIntactBed } from '../crew/beds';
import { berthCount } from '../crew/berths';
import { bedSocialCost, bondedPeers } from '../crew/bondSpot';
import { BedOwnerC, CrewC, DeadC, NeedsC, PositionC } from '../crew/components';
import { isInvader } from '../fight/relations';
import { ModuleC } from '../modules/components';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { guestHere } from '../consent/guests';

/** The bed-owner pass runs once per this many ticks (a second): crew joining, beds built or lost and ship changes settle within it. */
export const BED_PASS_TICKS = 20;

/** True if this crew member sleeps in a bed: a living crew member with a rest need (no robots), at home on the ship they stand on (no invader, no guest but a lodging one). */
function wantsBed(sim: Sim, id: number): boolean {
  const crew = sim.world.get(id, CrewC);
  const guest = crew && guestHere(sim, id);
  if (!crew || sim.world.has(id, DeadC) || sim.world.has(id, AlienC) || (guest && !guest.lodge)) return false;
  return !sim.content.species[crew.species]?.charge && !isInvader(sim, id);
}

/**
 * Bed ownership, on a cadence (BED_PASS_TICKS; stateless, so save and load stay deterministic). Drops owners whose bed is gone,
 * wrecked, on another ship than they stand on, or who died or stopped needing one; then gives each crew member without a bed
 * (ascending id) the nearest unowned bed on their ship: Chebyshev distance, then lowest bed id. No pathfinding.
 */
export function bedOwnersSystem(sim: Sim): void {
  if (sim.tick % BED_PASS_TICKS !== 0) return;
  const owned = new Map<number, Set<number>>(); // bed -> its berths that have an owner
  for (const id of sim.world.query(BedOwnerC)) {
    const { bed, berth = 0 } = sim.world.get(id, BedOwnerC) as { bed: number; berth?: number };
    const pos = sim.world.get(id, PositionC);
    const taken = owned.get(bed);
    const bm = sim.world.get(bed, ModuleC);
    if (!pos || taken?.has(berth) || !bm || berth >= berthCount(sim.content.modules[bm.def]) || !wantsBed(sim, id) || !isIntactBed(sim, bed, shipIdOf(sim, pos))) sim.world.remove(id, BedOwnerC);
    else if (taken) taken.add(berth);
    else owned.set(bed, new Set([berth]));
  }
  let free: Map<number, { id: number; x: number; y: number; berths: number[] }[]> | undefined; // beds with an unowned berth by ship, built when someone needs one
  for (const id of sim.world.query(CrewC, NeedsC, PositionC)) {
    if (sim.world.has(id, BedOwnerC) || !wantsBed(sim, id)) continue;
    if (!free) {
      free = new Map();
      for (const bedId of sim.world.query(ModuleC)) {
        const m = sim.world.get(bedId, ModuleC) as { x: number; y: number; hp: number; def: string };
        const bd = sim.content.modules[m.def];
        if (m.hp <= 0 || !bd?.bed || bd.medical) continue;
        const berths = Array.from({ length: berthCount(bd) }, (_, i) => i).filter((i) => !owned.get(bedId)?.has(i));
        if (berths.length === 0) continue;
        const ship = shipIdOf(sim, m);
        const list = free.get(ship);
        if (list) list.push({ id: bedId, x: m.x, y: m.y, berths });
        else free.set(ship, [{ id: bedId, x: m.x, y: m.y, berths }]);
      }
    }
    const pos = sim.world.get(id, PositionC) as { x: number; y: number };
    const list = free.get(shipIdOf(sim, pos));
    if (!list) continue;
    let pick = -1;
    let pickD = Infinity;
    const peers = bondedPeers(sim, id); // rivals keep apart, friends bed down together: the bed's distance plus the company beside it
    for (let i = 0; i < list.length; i++) {
      const b = list[i] as { id: number; x: number; y: number };
      const d = Math.max(Math.abs(b.x - pos.x), Math.abs(b.y - pos.y)) + (peers.length ? bedSocialCost(sim, peers, b.x, b.y) : 0);
      if (d < pickD) { pick = i; pickD = d; } // beds are listed by ascending id, so the first of equals wins
    }
    if (pick < 0) continue;
    const bed = list[pick] as { id: number; berths: number[] };
    const berth = bed.berths.shift() as number; // the lowest unowned berth
    if (bed.berths.length === 0) list.splice(pick, 1);
    sim.world.add(id, BedOwnerC, berth === 0 ? { bed: bed.id } : { bed: bed.id, berth });
  }
}
