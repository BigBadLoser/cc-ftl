import { AwayC, AwaySiteC } from '../away/components';
import { ShipC, type Faction } from '../combat/components';
import { factionsHostile } from '../combat/factions';
import { CrewC, DeadC, PositionC } from '../crew/components';
import { AllegianceC } from '../fight/components';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { ConsentC, type Grant } from './components';

/** Give leave to come aboard `ship` (consent/components.ts). A grant by the same owner for the same site replaces the old one. */
export function grant(sim: Sim, ship: number, g: Omit<Grant, 'since'>): void {
  const c = sim.world.get(ship, ConsentC) ?? (sim.world.add(ship, ConsentC, { grants: [] }), sim.world.get(ship, ConsentC)!);
  c.grants = c.grants.filter((x) => !(x.by === g.by && x.site === g.site));
  c.grants.push({ ...g, since: sim.tick });
}

/** Drop the owner's grants on `ship` (only those for `site`, when given); the record goes with the last one. */
export function revoke(sim: Sim, ship: number, by: Grant['by'], site?: number): void {
  const c = sim.world.get(ship, ConsentC);
  if (!c) return;
  c.grants = c.grants.filter((x) => x.by !== by || (site !== undefined && x.site !== site));
  if (!c.grants.length) sim.world.remove(ship, ConsentC);
}

/** True while the grant covers the crew member: of its side, the host not at war with that side, and one of its named crew or its site's party. */
function covers(sim: Sim, g: Grant, crew: number, host: Faction | undefined): boolean {
  const side = sim.world.get(crew, AllegianceC)?.faction;
  if (side !== g.faction || factionsHostile(host, g.faction)) return false;
  if (g.crew?.includes(crew)) return true;
  return g.site !== undefined && sim.world.has(g.site, AwaySiteC) && sim.world.get(crew, AwayC)?.site === g.site;
}

/** True when the crew member is aboard `ship` as a guest: some grant on it covers them. Standing there is then no boarding (provocation, the observer, the fight code). */
export function guestOn(sim: Sim, crew: number, ship: number): boolean {
  const c = sim.world.get(ship, ConsentC);
  if (!c) return false;
  const host = sim.world.get(ship, ShipC)?.faction;
  return c.grants.some((g) => covers(sim, g, crew, host));
}

/** True while one of the player's crew stands aboard the ship uninvited (alive, no grant covering them). */
export function uninvitedOn(sim: Sim, ship: number): boolean {
  for (const id of sim.world.query(CrewC, PositionC)) {
    if (sim.world.has(id, DeadC) || sim.world.get(id, AllegianceC)?.faction !== 'player') continue;
    if (shipIdOf(sim, sim.world.get(id, PositionC) as { x: number; y: number }) === ship && !guestOn(sim, id, ship)) return true;
  }
  return false;
}
