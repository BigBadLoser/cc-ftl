import { CombatC, ShipC } from '../combat/components';
import { CrewC, PositionC } from '../crew/components';
import { AllegianceC } from '../fight/components';
import { isCombatReady } from '../fight/relations';
import { shipIdOf } from '../regions';
import type { Engagement } from '../combat/engagementTypes';
import { shipsHostile } from '../combat/engage';
import { shipCentre } from '../combat/intercept';
import { shipCanAct } from '../combat/shipQuery';
import { dropAims } from '../combat/stations';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { retreat, strand } from './agenda';
import { clash, type Clash, type SideResult } from './clash';
import { engagements, sideShips } from './engagements';
import { liftFleet } from './fleetShips';
import { aftermath, apply, liveMeetings, type Meeting } from './meetings';
import { fleetName } from './names';
import { report } from './news';
import { standingShift } from './standing';
import { FTL_CHARGE_SEC } from '../tuning';
import { ENGAGE_HURT_INTEGRITY, ENGAGE_STALE_SEC, ENGAGE_WAIT_SEC, JOIN_STANDING, JOIN_WIN_STANDING } from './tuningWar';
import type { Contact, Fleet } from './types';

/**
 * Fights between NPC ships played out in the player's node (#603; user decisions 2026-11-21). Fleets that would fight on the map and meet here
 * (meetings.ts `liveMeetings`, at most once a turn per fleet) fight as real ships instead of the stats mini-sim: each ship is pointed at the nearest foe (`Combat.prey`,
 * which the combat AI ranks above the player), the combat rules treat the two sides as foes (combat/engage.ts), and the fight ends only when a side has
 * no ship left in play: wrecked, taken, or jumped away. There is no time limit and no breaking off in place (user, 2026-11-21). A badly hurt ship
 * flees by the enemy AI's own rule (FLEE_BELOW, `combat.flee`), and its fleet goes with it (fleetShips.ts `tendFleet`: lift and `retreat`), so a
 * routed side leaves the node and the other wins. A stalemate (no damage for ENGAGE_STALE_SEC) sends the weaker side away the same way (`stalemate`,
 * `leave`). `reap` (fleetShips.ts) still forgets the ships lost and sends the fled home; the end adds what the stats fight would have (meetings.ts `aftermath`: news, loot, chase) and strands a side left hurt. A side with no ship
 * real after ENGAGE_WAIT_SEC, or a fight the player leaves (`settleEngagements`), is settled by the stats fight on what is left. Joining a side
 * earns standing with its faction at the end (`credit`). Aid fights (engagementAid.ts) run through the same loop.
 */

const ROLE_FIRST: Record<Fleet['role'], number> = { raider: 0, pirate: 0, patrol: 1, miner: 2, trader: 2 };

const fleetById = (sim: Sim, id: number | undefined): Fleet | undefined => (id === undefined ? undefined : sim.galaxy.fleets.find((f) => f.id === id));

/** A new engagement id: unique within the sector's lifetime (the tick it started, and its place among those started that tick). */
export const engagementId = (sim: Sim): number => sim.tick * 8 + engagements(sim).filter((e) => e.since === sim.tick).length;

/** Start the fight of a meeting in the player's node: the attacker (a pirate before a patrol before a hauler; else the lower id) is side 0. */
export function startMeeting(sim: Sim, m: Meeting, turn: number): Engagement {
  const [a, b] = ROLE_FIRST[m.b.role] < ROLE_FIRST[m.a.role] ? [m.b, m.a] : [m.a, m.b];
  const e: Engagement = {
    id: engagementId(sim), kind: 'meeting', node: m.node, since: sim.tick, turn, fleets: [[a.id], [b.id]], members: [[], []],
    names: [fleetName(a), fleetName(b)], factions: [a.faction, b.faction],
  };
  (sim.sector.engagements ??= []).push(e);
  refresh(sim, e);
  aim(sim, e);
  sim.galaxy.rev++;
  const ship = e.members[0][0]?.ship ?? e.members[1][0]?.ship ?? 0;
  sim.events.emit({ type: 'engagement.started', engagement: e.id, kind: e.kind, node: e.node, who: e.names[0], faction: a.faction, foe: e.names[1], foeFaction: b.faction, ship });
  return e;
}

/** Add the ships of the fight's fleets that have turned up in the sector since. */
function refresh(sim: Sim, e: Engagement): void {
  for (const side of [0, 1] as const) {
    for (const id of e.fleets[side]) {
      const f = fleetById(sim, id);
      if (!f || f.node !== e.node) continue;
      for (const c of f.ships) if (c.ship !== undefined && !e.members[side].some((m) => m.ship === c.ship)) e.members[side].push({ ship: c.ship, contact: c.id });
    }
  }
}

/** Point each ship of the attacking sides (both in a meeting; the aiders only in aid, the attackers keep their own aim) at its nearest foe in play. */
function aim(sim: Sim, e: Engagement): void {
  for (const side of e.kind === 'meeting' ? ([0, 1] as const) : ([0] as const)) {
    const foes = sideShips(sim, e, side === 0 ? 1 : 0);
    if (!foes.length) continue;
    for (const id of sideShips(sim, e, side)) {
      const c = sim.world.get(id, CombatC);
      if (!c || (c.prey !== undefined && foes.includes(c.prey))) continue;
      const at = shipCentre(sim, id);
      const far = (f: number): number => {
        const p = shipCentre(sim, f);
        return at && p ? Math.hypot(p.x - at.x, p.y - at.y) : 0;
      };
      c.prey = foes.reduce((best, f) => (far(f) < far(best) ? f : best));
    }
  }
}

/** One ship's part in how the fight went: still holding the field, ran (or left with its fleet), or lost (wrecked, taken, forgotten). */
function fateOf(sim: Sim, e: Engagement, ship: number, contact: number | undefined): 'hold' | 'fled' | 'lost' {
  const s = sim.world.get(ship, ShipC);
  if (s) return s.state === 'active' || s.state === 'disabled' ? 'hold' : s.state === 'fled' ? 'fled' : 'lost';
  const kept = contact !== undefined && e.fleets.flat().some((id) => fleetById(sim, id)?.ships.some((c) => c.id === contact));
  return kept ? 'fled' : 'lost';
}

/** A side's result from its ships' fates: the descriptors it lost (those still known) and its fate as the stats fight would name it. */
function sideResult(sim: Sim, e: Engagement, side: 0 | 1): SideResult & { held: boolean } {
  const lost: Contact[] = [];
  let hold = 0;
  let fled = 0;
  let hurt = false;
  const fleets = e.fleets[side].map((id) => fleetById(sim, id)).filter((f): f is Fleet => !!f);
  for (const m of e.members[side]) {
    const fate = fateOf(sim, e, m.ship, m.contact);
    if (fate === 'hold') {
      hold++;
      hurt ||= (sim.world.get(m.ship, ShipC)?.integrity ?? 1) < ENGAGE_HURT_INTEGRITY;
    } else if (fate === 'fled') fled++;
    else {
      hurt = true;
      const c = fleets.flatMap((f) => f.ships).find((x) => x.id === m.contact);
      if (c) lost.push(c);
    }
  }
  const fate = hold ? (hurt ? 'hurt' : 'unhurt') : fled ? 'fled' : 'destroyed';
  return { lost, fate, held: hold > 0 };
}

/** Is a side still in the fight: a ship of it in play, or one of its fleet's ships still waiting for room here? */
function alive(sim: Sim, e: Engagement, side: 0 | 1): boolean {
  if (sideShips(sim, e, side).length) return true;
  return e.fleets[side].some((id) => {
    const f = fleetById(sim, id);
    return !!f && f.node === e.node && f.ships.some((c) => c.ship === undefined);
  });
}

/** Standing for joining a side: the player fired on (or boarded) only its foes. Once per fight, at its end. Returns what was earned. */
function credit(sim: Sim, e: Engagement, winner: 0 | 1 | null): number {
  const j = e.joined;
  if (e.kind !== 'meeting' || j === undefined) return 0;
  const struck = e.struck ?? [];
  if (!struck.includes(j === 0 ? 1 : 0) || struck.includes(j)) return 0;
  const n = JOIN_STANDING + (winner === j ? JOIN_WIN_STANDING : 0);
  standingShift(sim, e.factions[j], n);
  report(sim, { node: e.node, kind: 'joined', who: e.names[j], faction: e.factions[j], foe: e.names[j === 0 ? 1 : 0], foeFaction: e.factions[j === 0 ? 1 : 0] }, sim.galaxy.turn);
  return n;
}

/**
 * Take the fight off the record, drop the aims it set, credit the player and report it. Once it is gone, a member's aims (ship-wide, weapon and
 * committed) at the other side are dropped where the two are no longer foes, so a side that left is no longer shot at even while the node is otherwise in combat.
 */
function close(sim: Sim, e: Engagement, winner: 0 | 1 | null, stats: boolean): void {
  for (const side of e.members) {
    for (const m of side) {
      const c = sim.world.get(m.ship, CombatC);
      if (c && c.prey !== undefined && e.members.flat().some((o) => o.ship === c.prey)) delete c.prey;
    }
  }
  sim.sector.engagements = engagements(sim).filter((x) => x !== e);
  e.members.forEach((side, i) => {
    const other = new Set(e.members[i === 0 ? 1 : 0].map((o) => o.ship));
    for (const m of side) dropAims(sim, m.ship, (t) => other.has(t) && !shipsHostile(sim, m.ship, t));
  });
  const standing = credit(sim, e, winner);
  sim.galaxy.rev++;
  sim.events.emit({
    type: 'engagement.ended', engagement: e.id, kind: e.kind, node: e.node, who: e.names[0], foe: e.names[1], winner, stats,
    ...(e.joined !== undefined ? { joined: e.joined } : {}), ...(standing ? { standing, faction: e.factions[e.joined as 0 | 1] } : {}),
    ...(winner !== null && e.taken?.includes(winner === 0 ? 1 : 0) ? { taken: true as const } : {}),
  });
}

/**
 * The fight played out: strand a side left hurt, then the news, loot and chase of the stats fight's aftermath. No winner (both sides gone at once)
 * is no news, nor is a loser whose ship was taken (engagementPrize.ts said so as it happened).
 */
function finish(sim: Sim, e: Engagement): void {
  const r = [sideResult(sim, e, 0), sideResult(sim, e, 1)] as const;
  const winner = r[0].held === r[1].held ? null : r[0].held ? 0 : 1;
  const a = fleetById(sim, e.fleets[0][0]);
  const b = fleetById(sim, e.fleets[1][0]);
  if (e.kind === 'meeting' && a && b) {
    const loser = winner === null ? null : r[winner === 0 ? 1 : 0];
    const taken = winner !== null && !!e.taken?.includes(winner === 0 ? 1 : 0);
    const kind: Clash['kind'] = !loser || taken ? 'avoided' : loser.fate === 'destroyed' ? 'decisive' : 'driven';
    r.forEach((x, i) => {
      const f = i === 0 ? a : b;
      if (x.fate === 'hurt' && f.node === e.node && f.ships.length) strand(sim, f, sim.galaxy.turn);
    });
    aftermath(sim, { a, b, node: e.node }, { kind, winner: winner === null ? null : winner === 0 ? 'a' : 'b', share: 0.5, a: r[0], b: r[1] }, sim.galaxy.turn, e.names);
  }
  close(sim, e, winner, false);
}

/** A side's summed integrity over its ships in play, and that per ship it has had in the fight (lost ones count 0). */
function hullOf(sim: Sim, e: Engagement, side: 0 | 1): number {
  return sideShips(sim, e, side).reduce((n, id) => n + (sim.world.get(id, ShipC)?.integrity ?? 0), 0);
}
const shareOf = (sim: Sim, e: Engagement, side: 0 | 1): number => hullOf(sim, e, side) / Math.max(1, e.members[side].length);

/** Is a boarding on: a crew member serving a ship of one side, able to fight, aboard a ship of the other (fight/relations.ts `crewShipOf`)? */
function boarding(sim: Sim, e: Engagement): boolean {
  const ships = [new Set(sideShips(sim, e, 0)), new Set(sideShips(sim, e, 1))] as const;
  return sim.world.query(CrewC, PositionC).some((c) => {
    const own = sim.world.get(c, AllegianceC)?.ship;
    if (own === undefined || !isCombatReady(sim, c)) return false;
    const at = shipIdOf(sim, sim.world.get(c, PositionC));
    return (ships[0].has(own) && ships[1].has(at)) || (ships[1].has(own) && ships[0].has(at));
  });
}

/**
 * Once a second: note whether the fight did damage (or a boarding party is still at it). After ENGAGE_STALE_SEC without, the weaker side (the lower integrity share; on a tie side 1,
 * the one that did not start it) gives up and jumps away (`leave`).
 */
function stalemate(sim: Sim, e: Engagement): void {
  const now = hullOf(sim, e, 0) + hullOf(sim, e, 1);
  if (e.calm === undefined || e.hull === undefined || now < e.hull - 1e-6 || boarding(sim, e)) e.calm = sim.tick;
  e.hull = now;
  if (e.leaving || sim.tick - e.calm < ENGAGE_STALE_SEC * TICK_HZ) return;
  e.leaving = { side: shareOf(sim, e, 0) < shareOf(sim, e, 1) ? 0 : 1, since: sim.tick };
}

/**
 * The side giving up jumps away: each of its ships with a charged drive flees (`combat.flee`, as the enemy AI does), and its fleet follows the first
 * (`tendFleet`). A fleet none of whose ships can jump within FTL_CHARGE_SEC + ENGAGE_WAIT_SEC (no pilot, no engines) is moved off the same way.
 */
function leave(sim: Sim, e: Engagement): void {
  const l = e.leaving;
  if (!l) return;
  for (const id of sideShips(sim, e, l.side)) {
    const s = sim.world.get(id, ShipC);
    const c = sim.world.get(id, CombatC);
    if (s && c && s.state === 'active' && !s.immobile && shipCanAct(s) && c.ftl >= FTL_CHARGE_SEC) sim.enqueue({ type: 'combat.flee', ship: id });
  }
  if (sim.tick - l.since < (FTL_CHARGE_SEC + ENGAGE_WAIT_SEC) * TICK_HZ) return;
  for (const id of e.fleets[l.side]) {
    const f = fleetById(sim, id);
    if (!f || f.node !== e.node) continue;
    liftFleet(sim, f);
    retreat(sim, f, sim.galaxy.turn);
  }
}

/** Settle what is left of a meeting by the stats fight: both fleets' ships are lifted out (damage is not carried, as on any lift) and `clash` decides. */
function byStats(sim: Sim, e: Engagement): void {
  const a = fleetById(sim, e.fleets[0][0]);
  const b = fleetById(sim, e.fleets[1][0]);
  let winner: 0 | 1 | null = null;
  if (e.kind === 'meeting' && a && b) {
    const g = sim.galaxy;
    for (const f of [a, b]) if (f.node === g.current) liftFleet(sim, f);
    if (a.ships.length && b.ships.length) {
      const c = clash(sim, a, b, g.turn);
      apply(sim, { a, b, node: e.node }, c, g.turn);
      winner = c.winner === 'a' ? 0 : c.winner === 'b' ? 1 : null;
    }
    g.fleets = g.fleets.filter((f) => f.ships.length > 0);
  }
  close(sim, e, winner, true);
}

/**
 * Each tick in the live node: once a second, fleets here that would fight and have not fought this turn start a fight (as they arrive, or once
 * their ships turn up); then every fight takes in its ships that turned up, re-aims, and
 * ends when a side is out (or falls back to the stats fight while a side has not turned up). Once a second a stalemate is checked and a side
 * giving up is sent on its way.
 */
export function tendEngagements(sim: Sim): void {
  const g = sim.galaxy;
  if (sim.sector.meetTurn !== g.turn) {
    sim.sector.meetTurn = g.turn;
    delete sim.sector.met;
  }
  if (sim.tick % TICK_HZ === 0) {
    for (const m of liveMeetings(sim, new Set(sim.sector.met))) {
      startMeeting(sim, m, g.turn);
      (sim.sector.met ??= []).push(m.a.id, m.b.id);
    }
  }
  for (const e of [...engagements(sim)]) {
    refresh(sim, e);
    const age = sim.tick - e.since;
    if (e.kind === 'meeting' && e.members.some((side, i) => side.length === 0 && !e.taken?.includes(i as 0 | 1))) {
      if (age >= ENGAGE_WAIT_SEC * TICK_HZ || !alive(sim, e, 0) || !alive(sim, e, 1)) byStats(sim, e);
      continue;
    }
    if (!alive(sim, e, 0) || !alive(sim, e, 1)) {
      finish(sim, e);
      continue;
    }
    aim(sim, e);
    if (sim.tick % TICK_HZ !== 0) continue;
    stalemate(sim, e);
    leave(sim, e);
  }
}

/** The player leaves the node: every fight here is settled (a meeting by the stats fight on what is left) before the ships are lifted out. */
export function settleEngagements(sim: Sim): void {
  for (const e of [...engagements(sim)]) byStats(sim, e);
  delete sim.sector.engagements;
}
