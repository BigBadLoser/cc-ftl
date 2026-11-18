import { CrewC, DeadC, PositionC } from '../crew/components';
import { EvaFloatC } from '../eva/components';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { inspections, InspectionC, type Inspection } from './types';

/**
 * Where inspectors are: queries apart from inspect/fight.ts so that packing a ship (sector/members.ts) and the jump checks don't import the
 * inspection fight (#553).
 */

/**
 * Is the inspector on the inspected ship: alive, with their position on its grid, and not drifting back to the shuttle in a suit (an EVA 'back' drift
 * keeps the hull tile as its position, but they are leaving: they board the shuttle when it ends).
 */
export function onInspectedShip(sim: Sim, id: number, insp: Inspection): boolean {
  if (!sim.world.has(id, CrewC) || sim.world.has(id, DeadC) || sim.world.get(id, EvaFloatC)?.mode === 'back') return false;
  const pos = sim.world.get(id, PositionC);
  return !!pos && shipIdOf(sim, pos) === insp.ship;
}

/**
 * The inspectors on `ship` that leaving the node now would carry off (`abortInspections`: that counts as fighting them): those of every inspection of the
 * ship not already a fight, standing on it. The one answer for "are inspectors aboard" (the jump warning, the queued jump, the abort itself).
 */
export function inspectorsAboard(sim: Sim, ship: number): number[] {
  return inspections(sim).flatMap((v) => {
    const insp = sim.world.get(v, InspectionC)!;
    return insp.ship === ship && insp.phase !== 'fight' ? insp.crew.filter((id) => onInspectedShip(sim, id, insp)) : [];
  });
}
