import { PositionC } from '../crew/components';
import { hostileAct } from '../combat/provoke';
import { ShipC } from '../combat/components';
import { factionsHostile } from '../combat/factions';
import { startParty } from '../boarding/party';
import { playerShipInfo } from '../galaxy/arrivals';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { AMBUSH_SPRING_SEC } from '../tuning';
import { BoarderC } from '../vehicles/components';
import type { Ambush, SceneShip, SceneSpec } from './types';

/**
 * A boarding trigger outside combat (DESIGN.md "Pirate ambush"). A scene skiff that is a trap asks to dock a while after the scene opens; the player's
 * answer is the command `galaxy.visit`. Let in, its party goes by the ordinary boarding path (`startParty`, then `boardingAiSystem` flies the shuttle, docks it
 * and lands the party), only the ship is still neutral (`Boarder.visit`). Once they stand on the player's ship they pass for guests for AMBUSH_SPRING_SEC,
 * then the ship turns on the player through `hostileAct` (reason 'ambush'), which turns its group and its people, party included, and records the group
 * as every provocation does. Refused, a trap drops the act the same way. A player shot on the skiff (or on anything of its group) turns it first, by the
 * same rule. Nothing here is a parallel hostility record.
 */

const live = (sim: Sim, s: SceneShip): number | null => {
  const id = s.contact.ship;
  const ship = id === undefined ? undefined : sim.world.get(id, ShipC);
  return id !== undefined && ship && (ship.state === 'active' || ship.state === 'disabled') ? id : null;
};

/** The party is on the player's ship when one of them is standing on its grid. */
function partyAboard(sim: Sim, id: number): boolean {
  const me = playerShipInfo(sim)?.id;
  if (me === undefined) return false;
  return (sim.world.get(id, BoarderC)?.crew ?? []).some((c) => {
    const pos = sim.world.get(c, PositionC);
    return !!pos && shipIdOf(sim, pos) === me;
  });
}

/** Set the clock of the skiff's request when the scene opens (called by `openScene`). */
export function startVisitClock(sim: Sim, s: SceneShip): void {
  if (s.ambush?.trap) s.ambush.askAt = sim.tick + Math.round(s.ambush.askAfter * TICK_HZ);
}

/** True while the skiff's visit is a live question or a thing under way: it holds station (it neither jumps away nor is idle). */
export const visiting = (a: Ambush | undefined): boolean => !!a?.trap && a.visit !== 'refused' && a.visit !== 'sprung';

/** Once a second in the event grid: a trap's request comes due, a let-in party that landed stands aboard, then turns. */
export function tendVisit(sim: Sim, spec: SceneSpec): boolean {
  let changed = false;
  for (const s of spec.ships) {
    const a = s.ambush;
    const id = live(sim, s);
    if (!a?.trap || id === null) continue;
    const ship = sim.world.get(id, ShipC);
    if (!ship || a.visit === 'refused' || a.visit === 'sprung') continue;
    // The player's shot (or anything of its group turning) got there first: it is hostile already, the party with it.
    if (ship.provoked !== undefined || factionsHostile(ship.faction, 'player')) {
      a.visit = 'sprung';
      changed = true;
      continue;
    }
    if (a.visit === undefined && a.askAt !== undefined && sim.tick >= a.askAt && playerShipInfo(sim)) {
      a.visit = 'asked';
      sim.events.emit({ type: 'scene.dockAsked', ship: id });
      changed = true;
    } else if (a.visit === 'granted') {
      const b = sim.world.get(id, BoarderC);
      if (b?.state === 'idle') startParty(sim, id, b); // also while no airlock is free: try again
      if (partyAboard(sim, id)) {
        a.visit = 'aboard';
        a.springAt = sim.tick + Math.round(AMBUSH_SPRING_SEC * TICK_HZ);
        changed = true;
      } else if (b?.state === 'done' && b.crew.length === 0) turn(sim, a, id); // nobody could be sent
    } else if (a.visit === 'aboard' && a.springAt !== undefined && sim.tick >= a.springAt) {
      turn(sim, a, id);
      changed = true;
    }
  }
  return changed;
}

function turn(sim: Sim, a: Ambush, id: number): void {
  a.visit = 'sprung';
  hostileAct(sim, id, 'ambush');
}

/** The player's answer to a request to dock (`galaxy.visit`). Rejected when no skiff of the scene has one open. */
export function answerVisit(sim: Sim, ship: number, grant: boolean): void {
  const s = sim.galaxy.event?.scene.ships.find((x) => x.contact.ship === ship);
  const reject = (reason: string): void => void sim.events.emit({ type: 'command.rejected', command: 'galaxy.visit', reason });
  if (!s?.ambush || s.ambush.visit !== 'asked') return reject('noRequest');
  const a = s.ambush;
  if (!grant) {
    a.visit = 'refused';
    hostileAct(sim, ship, 'ambush');
    sim.galaxy.rev++;
    return;
  }
  const b = sim.world.get(ship, BoarderC);
  if (!b) return reject('noParty');
  a.visit = 'granted';
  b.visit = true; // `tendVisit` sends the party (from a system, so its embark orders are in place before the boarding system next looks)
  sim.galaxy.rev++;
}

/** Debug: the open signal's ambush skiff is a trap (or honest) whatever its seed rolled, with the talk and crew that goes with it. */
export function setAmbush(sim: Sim, trap: boolean): void {
  const spec = sim.galaxy.signal;
  const recipe = spec?.event ? sim.content.events?.[spec.event]?.scene?.ships : undefined;
  spec?.ships.forEach((s, i) => {
    const r = recipe?.[i]?.ambush;
    if (!s.ambush || !r) return;
    s.ambush = { trap, party: trap ? r.party : 0, talk: trap ? r.talk.trap : r.talk.honest, askAfter: s.ambush.askAfter, ...(trap ? { tell: 'lag' as const } : {}) };
    if (trap) s.ambush.talk = r.talk.tells.lag;
    s.crew = trap ? r.crew[0] : r.crew[0] > 1 ? 2 : 1;
  });
}
