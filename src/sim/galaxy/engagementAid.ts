import { CombatC, ShipC } from '../combat/components';
import type { Engagement, EngagementMember } from '../combat/engagementTypes';
import { isDormant } from '../combat/dormant';
import { factionsHostile } from '../combat/factions';
import { modulesOn, type DefTest } from '../modules/byShip';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { AI_THREAT_SEC } from '../tuning';
import { playerShipInfo } from './arrivals';
import { engagementId } from './engagementFlow';
import { engagements, inEngagement, sideIn } from './engagements';
import { contactOf, shipmates } from './groups';
import { factionOfShip } from './heat';
import { stanceOf } from './relations';
import { standing, tierOf } from './standing';
import { AID_STANDING } from './tuningWar';
import { PLAYER } from '../side';

/**
 * Allies come to the player's aid (#603; user decisions 2026-11-21). When a ship hostile to the player fires on the player's ship, armed ships in the
 * node whose faction the player stands at least AID_STANDING with (fleet ships, and armed stations) take it on, with the ships it came with: an 'aid'
 * fight (engagementFlow.ts runs it like any other; the aiders aim at the attackers, the attackers keep their own aim and answer whoever shoots them).
 * A faction never aids against its own ships or an ally's. Looked at once a second.
 */

const EVERY = TICK_HZ;
const isWeapon: DefTest = (d) => !!d.weapon;

/** Who shot at the player's ship lately (`Combat.threat`, AI_THREAT_SEC): a ship in play hostile to the player, or 0. */
export function playerAttacker(sim: Sim): number {
  const me = playerShipInfo(sim);
  const t = me ? sim.world.get(me.id, CombatC)?.threat : undefined;
  if (!t || sim.tick - t.at > AI_THREAT_SEC * TICK_HZ) return 0;
  const s = sim.world.get(t.ship, ShipC);
  return s && (s.state === 'active' || s.state === 'disabled') && factionsHostile(s.faction, PLAYER) ? t.ship : 0;
}

/** May this ship take on the player's attacker (whose galaxy faction is `foe`)? Armed, awake, not hostile to the player, not in a fight, of a faction that likes the player and is no friend of the foe. */
export function canAid(sim: Sim, id: number, foe: string | null): boolean {
  const s = sim.world.get(id, ShipC);
  if (!s || s.state !== 'active' || s.faction === PLAYER || factionsHostile(s.faction, PLAYER) || isDormant(s) || s.outpost || s.base) return false;
  if (!modulesOn(sim, id, isWeapon).length || inEngagement(sim, id)) return false;
  const owner = factionOfShip(sim, id, s, s.faction);
  const content = sim.content.galaxy;
  if (!owner || !content || owner === foe || tierOf(sim, owner) === 'hostile' || standing(sim, owner) < AID_STANDING) return false;
  return !foe || stanceOf(sim, owner, foe) !== 'allied';
}

const member = (sim: Sim, ship: number): EngagementMember => {
  const c = contactOf(sim, ship);
  return c ? { ship, contact: c.id } : { ship };
};

/** The fleet a ship came with, if any. */
const fleetOf = (sim: Sim, ship: number): number | undefined => sim.galaxy.fleets.find((f) => f.ships.some((c) => c.ship === ship))?.id;

/** Once a second: the player under fire from a ship no aid fight covers yet, and allies here who can take it on, start one. */
export function callAid(sim: Sim): void {
  if (sim.tick % EVERY !== 0) return;
  const attacker = playerAttacker(sim);
  if (!attacker || engagements(sim).some((e) => e.kind === 'aid' && sideIn(sim, e, attacker) === 1)) return;
  const att = sim.world.get(attacker, ShipC);
  if (!att) return;
  const foe = factionOfShip(sim, attacker, att, att.faction);
  const aiders = sim.world.query(ShipC).filter((id) => canAid(sim, id, foe));
  if (!aiders.length) return;
  const them = shipmates(sim, attacker).filter((id) => {
    const s = sim.world.get(id, ShipC);
    return !!s && (s.state === 'active' || s.state === 'disabled');
  });
  const fleets = (ids: number[]): number[] => [...new Set(ids.map((id) => fleetOf(sim, id)).filter((f): f is number => f !== undefined))];
  const lead = sim.world.get(aiders[0] as number, ShipC);
  const owner = lead ? factionOfShip(sim, aiders[0] as number, lead, lead.faction) ?? '' : '';
  const e: Engagement = {
    id: engagementId(sim), kind: 'aid', node: sim.galaxy.current, since: sim.tick, turn: sim.galaxy.turn, fleets: [fleets(aiders), fleets(them)],
    members: [aiders.map((id) => member(sim, id)), them.map((id) => member(sim, id))], names: [lead?.name ?? '', att.name], factions: [owner, foe ?? ''],
  };
  (sim.sector.engagements ??= []).push(e);
  sim.galaxy.rev++;
  sim.events.emit({ type: 'engagement.started', engagement: e.id, kind: 'aid', node: e.node, who: e.names[0], faction: owner, foe: att.name, foeFaction: foe ?? '', ship: aiders[0] as number });
}
