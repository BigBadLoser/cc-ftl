import { AwayC, AwaySiteC } from '../away/components';
import { ShipC, type Faction } from '../combat/components';
import { factionsHostile } from '../combat/factions';
import { CrewC, DeadC, PositionC } from '../crew/components';
import { AllegianceC } from '../fight/components';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { ConsentC, type Grant } from './components';

/** Which grants of an owner a call means: those for this site and from this ship (each absent: any). */
export interface GrantKey {
  site?: number;
  from?: number;
}
const matches = (g: Grant, by: Grant['by'], k: GrantKey): boolean =>
  g.by === by && (k.site === undefined || g.site === k.site) && (k.from === undefined || g.from === k.from);

/** Give leave to come aboard `ship` (consent/components.ts). A grant by the same owner for the same site and `from` (a passage: the same person) replaces the old one. */
export function grant(sim: Sim, ship: number, g: Omit<Grant, 'since'>): void {
  if (!sim.world.has(ship, ShipC)) return;
  const c = sim.world.get(ship, ConsentC) ?? (sim.world.add(ship, ConsentC, { grants: [] }), sim.world.get(ship, ConsentC)!);
  // Passengers are one grant each (each carries their own story, `carry`): a passage grant replaces only the one naming the same person.
  const same = c.grants.find((x) => x.by === g.by && x.site === g.site && x.from === g.from && (g.by !== 'passage' || x.crew?.[0] === g.crew?.[0]));
  c.grants = c.grants.filter((x) => x !== same);
  c.grants.push({ ...g, ...(same?.carry && !g.carry ? { carry: same.carry } : {}), since: same?.since ?? sim.tick });
}

/** Drop the owner's grants on `ship` (only those matching `key`, when given); the record goes with the last one. */
export function revoke(sim: Sim, ship: number, by: Grant['by'], key: GrantKey = {}): void {
  const c = sim.world.get(ship, ConsentC);
  if (!c) return;
  c.grants = c.grants.filter((x) => !matches(x, by, key));
  if (!c.grants.length) sim.world.remove(ship, ConsentC);
}

/** True while the grant covers the crew member: of its side, the host not at war with that side, and one of its named crew or its site's party (or neither named: the whole side). */
function covers(sim: Sim, g: Grant, crew: number, host: Faction | undefined): boolean {
  const side = sim.world.get(crew, AllegianceC)?.faction;
  if (side !== g.faction || factionsHostile(host, g.faction)) return false;
  if (g.crew === undefined && g.site === undefined) return true;
  if (g.crew?.includes(crew)) return true;
  return g.site !== undefined && sim.world.has(g.site, AwaySiteC) && sim.world.get(crew, AwayC)?.site === g.site;
}

/** The grant the crew member is aboard `ship` by, if any (the first that covers them; a working one first). */
export function guestGrant(sim: Sim, crew: number, ship: number): Grant | undefined {
  const c = sim.world.get(ship, ConsentC);
  if (!c) return undefined;
  const host = sim.world.get(ship, ShipC)?.faction;
  const covering = c.grants.filter((g) => covers(sim, g, crew, host));
  return covering.find((g) => g.work) ?? covering[0];
}

/** True when the crew member is aboard `ship` as a guest: some grant on it covers them. Standing there is then no boarding (provocation, the observer, the fight code). */
export function guestOn(sim: Sim, crew: number, ship: number): boolean {
  return guestGrant(sim, crew, ship) !== undefined;
}

/** The grant the crew member stands where they are by (a guest of the ship under their feet), if any. */
export function guestHere(sim: Sim, crew: number): Grant | undefined {
  const pos = sim.world.get(crew, PositionC);
  return pos ? guestGrant(sim, crew, shipIdOf(sim, pos)) : undefined;
}

/** The lodging grant the crew member lives where they stand by (a passenger: consent/components.ts `lodge`), if any. */
export function lodgingHere(sim: Sim, crew: number): Grant | undefined {
  if (sim.world.get(crew, AllegianceC)?.faction === 'player') return undefined; // the common case, without the ship lookup
  const g = guestHere(sim, crew);
  return g?.lodge ? g : undefined;
}

/** True while some ship has given leave to the people of `from` (a skiff's party let dock): the party may go outside combat. */
export function hasLeaveFrom(sim: Sim, from: number): boolean {
  // (Ships, not the consent store: querying that would create it, and an empty store changes the save bytes of games that never used it.)
  return sim.world.query(ShipC).some((id) => !!sim.world.get(id, ConsentC)?.grants.some((g) => g.from === from));
}

/** True while one of the player's crew stands aboard the ship uninvited (alive, no grant covering them). */
export function uninvitedOn(sim: Sim, ship: number): boolean {
  for (const id of sim.world.query(CrewC, PositionC)) {
    if (sim.world.has(id, DeadC) || sim.world.get(id, AllegianceC)?.faction !== 'player') continue;
    if (shipIdOf(sim, sim.world.get(id, PositionC) as { x: number; y: number }) === ship && !guestOn(sim, id, ship)) return true;
  }
  return false;
}
