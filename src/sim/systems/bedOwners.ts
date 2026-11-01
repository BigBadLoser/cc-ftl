import { AlienC } from '../aliens/components';
import { isIntactBed } from '../crew/beds';
import { BedOwnerC, CrewC, DeadC, NeedsC, PositionC } from '../crew/components';
import { isInvader } from '../fight/relations';
import { ModuleC } from '../modules/components';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { YardCrewC } from '../yard/types';

/** The bed-owner pass runs once per this many ticks (a second): crew joining, beds built or lost and ship changes settle within it. */
export const BED_PASS_TICKS = 20;

/** True if this crew member sleeps in a bed: a living crew member with a rest need (no robots), at home on the ship they stand on. */
function wantsBed(sim: Sim, id: number): boolean {
  const crew = sim.world.get(id, CrewC);
  if (!crew || sim.world.has(id, DeadC) || sim.world.has(id, AlienC) || sim.world.has(id, YardCrewC)) return false;
  return !sim.content.species[crew.species]?.charge && !isInvader(sim, id);
}

/**
 * Bed ownership, on a cadence (BED_PASS_TICKS; stateless, so save and load stay deterministic). Drops owners whose bed is gone,
 * wrecked, on another ship than they stand on, or who died or stopped needing one; then gives each crew member without a bed
 * (ascending id) the nearest unowned bed on their ship: Chebyshev distance, then lowest bed id. No pathfinding.
 */
export function bedOwnersSystem(sim: Sim): void {
  if (sim.tick % BED_PASS_TICKS !== 0) return;
  const owned = new Set<number>();
  for (const id of sim.world.query(BedOwnerC)) {
    const bed = (sim.world.get(id, BedOwnerC) as { bed: number }).bed;
    const pos = sim.world.get(id, PositionC);
    if (!pos || owned.has(bed) || !wantsBed(sim, id) || !isIntactBed(sim, bed, shipIdOf(sim, pos))) sim.world.remove(id, BedOwnerC);
    else owned.add(bed);
  }
  let free: Map<number, { id: number; x: number; y: number }[]> | undefined; // free beds by ship, built when someone needs one
  for (const id of sim.world.query(CrewC, NeedsC, PositionC)) {
    if (sim.world.has(id, BedOwnerC) || !wantsBed(sim, id)) continue;
    if (!free) {
      free = new Map();
      for (const bedId of sim.world.query(ModuleC)) {
        const m = sim.world.get(bedId, ModuleC) as { x: number; y: number; hp: number; def: string };
        if (owned.has(bedId) || m.hp <= 0 || !sim.content.modules[m.def]?.bed) continue;
        const ship = shipIdOf(sim, m);
        const list = free.get(ship);
        if (list) list.push({ id: bedId, x: m.x, y: m.y });
        else free.set(ship, [{ id: bedId, x: m.x, y: m.y }]);
      }
    }
    const pos = sim.world.get(id, PositionC) as { x: number; y: number };
    const list = free.get(shipIdOf(sim, pos));
    if (!list) continue;
    let pick = -1;
    let pickD = Infinity;
    for (let i = 0; i < list.length; i++) {
      const b = list[i] as { id: number; x: number; y: number };
      const d = Math.max(Math.abs(b.x - pos.x), Math.abs(b.y - pos.y));
      if (d < pickD) { pick = i; pickD = d; } // beds are listed by ascending id, so the first of equals wins
    }
    if (pick < 0) continue;
    const [bed] = list.splice(pick, 1);
    sim.world.add(id, BedOwnerC, { bed: (bed as { id: number }).id });
  }
}
