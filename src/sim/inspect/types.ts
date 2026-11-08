import { defineComponent } from '../ecs';
import type { ItemQty } from '../registry';
import type { Sim } from '../sim';
import { VehicleC } from '../vehicles/components';

/**
 * A contraband inspection at a station (docs/DESIGN.md "Contraband inspections in the world", #138 step 1), on the inspectors' shuttle. A navy or
 * corporation station sends it when the player opens trade there: the shuttle serves an away site on the player's ship (owner 'inspect'), docked at a
 * free airlock or hovering (the party then boards by EVA); the inspectors are the site's party, guests by an 'inspect' consent grant. Phases:
 * - 'fly': on the way; ends once an inspector stands on the player's ship.
 * - 'search': a search job at each storage module and each module with a fitted upgrade (only the party take them); what a search finds, and what
 *   the inspectors find on crew and floors they pass, they carry to the shuttle with ordinary hauls. Ends when no search or seizure haul is left.
 * - 'settle': contraband was found: the lead inspector waits aboard for the player's answer (`inspect.settle`: the fine, a bribe, or refusing).
 * - 'leave': the site closes, the run brings the party home and the inspection ends with them (`InspectionC` goes with the shuttle).
 * - 'fight': the player attacked them (inspect/fight.ts): the inspectors are boarders on their side's combat faction until none is left standing aboard.
 */
export type InspectPhase = 'fly' | 'search' | 'settle' | 'leave' | 'fight';
export interface Inspection {
  /** The station that sent it, the player's ship it inspects, and the galaxy faction (the station's owner) and name it inspects for. */
  station: number;
  ship: number;
  faction: string;
  name: string;
  phase: InspectPhase;
  /** Ticks in this phase. */
  timer: number;
  /** The inspectors, the lead first (the one who waits for the answer). */
  crew: number[];
  /** Search jobs still posted (job entities). */
  jobs: number[];
  /** What they found and took (by item id), and its worth at base prices: tallied when the search ends (the hold and `impounded`). */
  found: ItemQty[];
  /** Contraband found beyond the room in the shuttle's hold: taken where it was found, without being carried (handed back with a bribe). */
  impounded?: ItemQty[];
  value: number;
  /** The fine and the bribe, set when the search ends with something found. */
  fine?: number;
  bribe?: number;
  /** A patrol's inspection (inspect/patrol.ts): the fleet whose ship (`station`) sent it. What refusing it leads to is step 3. */
  patrol?: number;
  /** A bribe was offered and turned down: it is not offered again. */
  bribeFailed?: true;
  /** How it ended: the player's answer, 'clean' (nothing found), 'fled' (the player left) or 'off' (a fight, the station gone). */
  outcome?: 'fined' | 'bribed' | 'refused' | 'clean' | 'fled' | 'off' | 'fought';
  /** Set while the party cannot reach the work: no inspector has made it aboard, or a search job nobody can take (the urgent alert). */
  blocked?: true;
}
export const InspectionC = defineComponent<Inspection>('inspection');

/** The answers to an inspection that found contraband. */
export type InspectChoice = 'fine' | 'bribe' | 'refuse';

/**
 * The shuttles that carry an inspection, lowest id first. Read through the vehicles (a query of `InspectionC` itself would make its store, and an
 * empty store changes the save bytes of games that never had an inspection).
 */
export const inspections = (sim: Sim): number[] => sim.world.query(VehicleC).filter((id) => sim.world.has(id, InspectionC));
