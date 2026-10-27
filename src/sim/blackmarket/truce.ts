import { CombatC, ShipC, WeaponC, type Faction } from '../combat/components';
import { wake } from '../combat/dormant';
import { CrewC, DeadC, PositionC } from '../crew/components';
import { AllegianceC, PrisonerC } from '../fight/components';
import { nodeState } from '../galaxy/state';
import { ModuleC } from '../modules/components';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { reputationOf } from '../story/state';
import { BAN_TURNS, BREACH_STANDING } from './tuning';

/**
 * The truce of a black market's node. It is a flag on the node (`NodeState.truce`) that a market service sets when it is attached (attach.ts), so it
 * works for any station and is tested on a test node. While it holds nobody starts a fight there: the enemy AI holds fire, the node is never "in combat",
 * and no interdiction is made there. The player firing on or boarding anyone there breaks it (`truceSystem` finds that): a breach is a ban for BAN_TURNS
 * turns in which every ship there is hostile and fires on the player, and every pirate faction thinks less of them by BREACH_STANDING. The game never
 * stops the player travelling to a truce node, so a ban only makes it dangerous.
 */

/** Does the truce hold at the node (there is one, and no ban is running)? */
export function truceHolds(sim: Sim, node: string = sim.sector.node): boolean {
  const t = sim.galaxy.nodes[node]?.truce;
  return !!t && !(t.banUntil !== undefined && t.banUntil > sim.galaxy.turn);
}

/** Is the player banned at the node (a breach less than BAN_TURNS turns ago)? */
export function banned(sim: Sim, node: string = sim.sector.node): boolean {
  const t = sim.galaxy.nodes[node]?.truce;
  return !!t && t.banUntil !== undefined && t.banUntil > sim.galaxy.turn;
}

/** Give a node a truce (what a market service does). Idempotent. */
export function setTruce(sim: Sim, node: string): void {
  const s = nodeState(sim, node);
  s.truce ??= {};
}

/** Every pirate faction's reputation key, from the faction table (the factions of kind 'pirates', so ones added later are picked up). */
export function pirateKeys(sim: Sim): string[] {
  const keys = new Set<string>();
  for (const f of Object.values(sim.content.galaxy?.factions ?? {})) if (f.kind === 'pirates') keys.add(f.reputation);
  return [...keys].sort();
}

/** The truce is broken: ban the player here, make everyone hostile to them and cost them standing with every pirate faction. */
export function breachTruce(sim: Sim, node: string = sim.sector.node): void {
  const t = sim.galaxy.nodes[node]?.truce;
  if (!t || banned(sim, node)) return;
  t.banUntil = sim.galaxy.turn + BAN_TURNS;
  for (const key of pirateKeys(sim)) sim.story.reputation[key] = reputationOf(sim.story, key) - BREACH_STANDING;
  sim.galaxy.rev++;
  sim.events.emit({ type: 'truce.breached', node, until: t.banUntil });
}

/** Ships of the node that are in play and not the player's, ascending. */
function others(sim: Sim): number[] {
  return [...sim.world.query(ShipC)].sort((a, b) => a - b).filter((id) => {
    const s = sim.world.get(id, ShipC);
    return !!s && s.faction !== 'player' && (s.state === 'active' || s.state === 'disabled');
  });
}

/** Does the player threaten anyone here: a player ship or weapon aimed at a live ship, or a player crew member aboard one? */
export function aggression(sim: Sim): boolean {
  const live = new Set(others(sim));
  for (const id of sim.world.query(ShipC, CombatC)) {
    if (sim.world.get(id, ShipC)?.faction !== 'player') continue;
    const t = sim.world.get(id, CombatC)?.target;
    if (t?.ship && live.has(t.ship)) return true;
  }
  for (const id of sim.world.query(WeaponC, ModuleC)) {
    const t = sim.world.get(id, WeaponC)?.target;
    if (t?.ship && live.has(t.ship) && sim.world.get(shipIdOf(sim, sim.world.get(id, ModuleC)), ShipC)?.faction === 'player') return true;
  }
  for (const id of sim.world.query(CrewC, AllegianceC, PositionC)) {
    if (sim.world.get(id, AllegianceC)?.faction !== 'player' || sim.world.has(id, DeadC) || sim.world.has(id, PrisonerC)) continue;
    if (live.has(shipIdOf(sim, sim.world.get(id, PositionC)))) return true;
  }
  return false;
}

/** Crew allegiance of a ship's people, from one faction to another. */
function turnCrew(sim: Sim, ship: number, from: Faction, to: Faction): void {
  for (const id of sim.world.query(CrewC, AllegianceC, PositionC)) {
    const a = sim.world.get(id, AllegianceC);
    if (a?.faction === from && shipIdOf(sim, sim.world.get(id, PositionC)) === ship) a.faction = to;
  }
}

/** During a ban every ship here (and its people) turns hostile to the player and wakes; when it ends they go back to what they were. */
export function applyBan(sim: Sim, node: string): void {
  const ban = banned(sim, node);
  for (const id of [...sim.world.query(ShipC)].sort((a, b) => a - b)) {
    const s = sim.world.get(id, ShipC);
    if (!s) continue;
    if (ban && s.faction !== 'player' && s.faction !== 'hostile' && s.faction !== 'rogue' && s.banned === undefined && (s.state === 'active' || s.state === 'disabled')) {
      s.banned = s.faction;
      turnCrew(sim, id, s.faction, 'hostile');
      s.faction = 'hostile';
    } else if (ban && s.faction === 'hostile') {
      wake(sim, id, 'aimed');
    }
    if (!ban && s.banned !== undefined) {
      turnCrew(sim, id, 'hostile', s.banned);
      s.faction = s.banned;
      delete s.banned;
      const combat = sim.world.get(id, CombatC);
      if (combat) combat.target = null;
    }
    if (ban && s.banned !== undefined) wake(sim, id, 'aimed');
  }
}

/** One tick at a truce node: restore after a ban, find a breach, turn the ships hostile while a ban runs. */
export function tendTruce(sim: Sim): void {
  const node = sim.sector.node;
  const t = sim.galaxy.nodes[node]?.truce;
  if (t) {
    if (truceHolds(sim, node) && aggression(sim)) breachTruce(sim, node);
    applyBan(sim, node);
    return;
  }
  // Ships frozen mid-ban in a node whose truce is gone (no such case today) would stay hostile; nothing to restore without a flag.
}
