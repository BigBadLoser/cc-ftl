import { AwaySiteC } from '../away/components';
import { openSite } from '../away/handlers';
import { ShipC } from '../combat/components';
import { playerShipInfo } from '../galaxy/arrivals';
import { shipGrid } from '../regions';
import { SalvageOrderC } from '../salvage/components';
import type { Sim } from '../sim';
import { mended } from './clock';
import { ConsentC } from '../consent/components';
import { grant, revoke } from '../consent/guests';
import type { SceneShip, SceneSpec } from './types';

/**
 * Aid by hail (DESIGN.md "Distress freighter", user ruling 2026-11-06). Help is agreed over comms: on the signal (the "Offer help" choice, a `scene`
 * effect with `aid`) or in the pocket (`galaxy.aid`). The agreement is the scene ship's (`SceneShip.aid`); its away site (owner 'aid') takes the party
 * aboard as invited guests (a consent grant on the ship for the site's party, consent/; revoked when the site is gone or the help is off), and they mend what is broken through the ordinary repair and firefighting jobs (the site's demand is its
 * open jobs). The site closes when the damage the ship started with is mended and no fire burns aboard (the help is done), or when the player recalls it
 * (the agreement stands: `galaxy.aid` sends them again). Turning on the ship ends it: a shot, uninvited boarding (both provoke it), taking it as a prize,
 * or a salvage order on it.
 */

const live = (sim: Sim, s: SceneShip): number | null => {
  const id = s.contact.ship;
  const st = id === undefined ? undefined : sim.world.get(id, ShipC)?.state;
  return id !== undefined && (st === 'active' || st === 'disabled') ? id : null;
};

/** True while a fire burns anywhere aboard the ship. */
function burning(sim: Sim, ship: number): boolean {
  const grid = shipGrid(sim, ship);
  if (!grid?.has('fire')) return false;
  for (let y = grid.y0; y < grid.y0 + grid.height; y++) for (let x = grid.x0; x < grid.x0 + grid.width; x++) if (grid.get('fire', x, y) > 0) return true;
  return false;
}

/** The player turned on it, or took it: the help is off. */
function turnedOn(sim: Sim, s: SceneShip): boolean {
  const id = s.contact.ship;
  const ship = id === undefined ? undefined : sim.world.get(id, ShipC);
  return !!ship && (ship.provoked !== undefined || ship.state === 'prize' || sim.world.has(id as number, SalvageOrderC));
}

function closeSite(sim: Sim, ship: number | undefined): void {
  const site = ship === undefined ? undefined : sim.world.get(ship, AwaySiteC);
  if (site?.owner === 'aid' && site.status === 'open') site.status = 'closing';
}

function settle(sim: Sim, s: SceneShip, state: 'done' | 'broken'): void {
  const a = s.aid as NonNullable<SceneShip['aid']>;
  a.state = state;
  closeSite(sim, s.contact.ship);
  if (state === 'broken' && s.contact.ship !== undefined) revoke(sim, s.contact.ship, 'aid');
  sim.events.emit({ type: 'scene.aid', ship: s.contact.ship ?? 0, state });
}

/** Open the aid site on the ship: the player's ship is deployed and no fight is on (a fight would call the party straight home). */
function send(sim: Sim, id: number): boolean {
  if (sim.sector.state !== 'active' || sim.sector.inCombat || !playerShipInfo(sim) || sim.world.has(id, AwaySiteC)) return false;
  if (openSite(sim, id, 'aid') === 'noShuttle') return false;
  const site = sim.world.get(id, AwaySiteC);
  if (site) site.noLoot = true; // guests take nothing home
  grant(sim, id, { by: 'aid', faction: 'player', site: id }); // the party is aboard by the ship's leave
  return true;
}

/** Once a second in the event grid: keep each agreement in step with what happened. True when one changed. */
export function tendAid(sim: Sim, spec: SceneSpec): boolean {
  let changed = false;
  for (const s of spec.ships) {
    const a = s.aid;
    const ship = s.contact.ship;
    // The leave lasts while its site does (a party walking home is still a guest); a ship that turned on is void by the consent rule anyway.
    if (ship !== undefined && sim.world.get(ship, AwaySiteC)?.owner !== 'aid' && sim.world.has(ship, ConsentC)) revoke(sim, ship, 'aid');
    if (a?.state !== 'agreed') continue;
    if (turnedOn(sim, s)) {
      settle(sim, s, 'broken');
      changed = true;
      continue;
    }
    const id = live(sim, s);
    if (id === null) {
      closeSite(sim, s.contact.ship); // not here yet, or wrecked: nothing to help (the observer sees the rest)
      continue;
    }
    if (s.damaged !== undefined && mended(sim, s.damaged) && !burning(sim, id)) {
      settle(sim, s, 'done');
      changed = true;
      continue;
    }
    if (!a.sent && send(sim, id)) {
      a.sent = true;
      changed = true;
    }
  }
  return changed;
}

/**
 * The player offers help to a scene ship in the pocket (`galaxy.aid`), or sends the party again after recalling it. A helpless ship the player has not
 * turned on accepts; the site opens once it can (`tendAid`). Rejected when no such ship is in the open scene, help is done or off, or its party is out.
 */
export function offerAid(sim: Sim, ship: number): void {
  const reject = (reason: string): void => void sim.events.emit({ type: 'command.rejected', command: 'galaxy.aid', reason });
  const s = sim.galaxy.event?.scene.ships.find((x) => x.contact.ship === ship);
  if (!s || s.stance !== 'helpless' || live(sim, s) === null) return reject('badTarget');
  if (s.aid?.state === 'done' || s.aid?.state === 'broken' || turnedOn(sim, s)) return reject(s.aid?.state === 'done' ? 'done' : 'refused');
  if (s.aid?.state === 'agreed' && sim.world.has(ship, AwaySiteC)) return reject('open');
  const first = !s.aid;
  s.aid = { state: 'agreed' };
  sim.galaxy.rev++;
  if (first) sim.events.emit({ type: 'scene.aid', ship, state: 'agreed' });
}
