import { PositionC } from '../crew/components';
import { AllegianceC } from '../fight/components';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { ForHireC, StationCrewC } from '../stations/components';
import { guestGrant } from './guests';

/**
 * What a person is to the ship they stand on: the one place that reads the marker components (ForHireC, StationCrewC, a ConsentC grant, the player's
 * allegiance), so a new kind of person is decided here and not in every system that asks. Systems read `roleOf` or a helper below, not the markers.
 * - crew: on the player's side.
 * - recruit: for hire at a station (also StationCrewC until hired, so it comes before 'station').
 * - station: a station's own staff.
 * - passenger: lodging aboard by a 'passage' grant.
 * - guest: lodging aboard by any other grant (a contractor, a rescued visitor).
 * - other: everyone else (a boarder, a hostile, a visitor who only has leave to be there).
 */
export type PersonRole = 'crew' | 'recruit' | 'station' | 'passenger' | 'guest' | 'other';

/** The role of `person`, aboard `ship` (default: the ship under their feet). */
export function roleOf(sim: Sim, person: number, ship?: number): PersonRole {
  if (sim.world.get(person, AllegianceC)?.faction === 'player') return 'crew';
  if (sim.world.has(person, ForHireC)) return 'recruit';
  if (sim.world.has(person, StationCrewC)) return 'station';
  const pos = sim.world.get(person, PositionC);
  const at = ship ?? (pos ? shipIdOf(sim, pos) : undefined);
  const g = at === undefined ? undefined : guestGrant(sim, person, at);
  if (!g?.lodge) return 'other';
  return g.by === 'passage' ? 'passenger' : 'guest';
}

/** Staff of a station, hired or not: lives off the station's supplies and is not the player's to command. */
export const onStationRoll = (r: PersonRole): boolean => r === 'station' || r === 'recruit';

/** Lives aboard the player's ship as a guest (lodging), whatever the grant. */
export const isLodger = (r: PersonRole): boolean => r === 'passenger' || r === 'guest';

/** Takes up a fight on their own with no weapon or fighter role (anyone but staff and lodgers: they run from trouble like civilians do). */
export const fightsBareHanded = (r: PersonRole): boolean => !onStationRoll(r) && !isLodger(r);

/** May be drafted by the player (a lodger never is; commands refuse them). */
export const canDraft = (r: PersonRole): boolean => !isLodger(r);
