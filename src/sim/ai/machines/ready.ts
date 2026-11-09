import type { Crew, Position } from '../../crew/components';
import { needKeepsHome, siteWantsThem } from '../../away/crew';
import { shipIdOf } from '../../regions';
import type { Sim } from '../../sim';
import { TaskC } from '../components';
import { serveDrive } from '../utility';
import { eatTurn } from './eat';
import { sleepTurn } from './sleep';

/**
 * Getting ready for an away site (#408): a crew member the scheduler found no job for, who would take a passage to a site that wants workers
 * but for a need too low to stay out a while (`needKeepsHome`: rest or hunger under its passage line), sees to that need now, early, rather
 * than idling until it falls to the sleep or eat line. Crew who come home for a need go straight to it the same way. True while it keeps them.
 */
export function readyTurn(sim: Sim, id: number, crew: Crew, pos: Position): boolean {
  const need = needKeepsHome(sim, id);
  if (!need || !siteWantsThem(sim, id, shipIdOf(sim, pos))) return false;
  if (need === 'hunger') return eatTurn(sim, id, crew, pos) && (serveDrive(sim, id, 'eat'), true);
  sleepTurn(sim, id, crew, pos, false);
  serveDrive(sim, id, 'sleep');
  return crew.activity === 'sleeping' || sim.world.get(id, TaskC)?.machine === 'sleep';
}
