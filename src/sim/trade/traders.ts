import { ShipC, type Ship } from '../combat/components';
import { Rng } from '../rng';
import type { Sim } from '../sim';
import { CombatC } from '../combat/components';
import { reputationOf } from '../story/state';
import { TraderC, type Trader, type TraderDef, type TradeFactionDef } from './types';

/** Stable 32-bit mix of integers (seed, identity), so a trader's stock does not depend on when it is first hailed. */
function mix(...parts: number[]): number {
  let h = 0x811c9dc5;
  for (const p of parts) {
    h = Math.imul(h ^ (p >>> 0), 0x01000193);
    h ^= h >>> 15;
  }
  return h >>> 0;
}

/** The trade faction id of a ship: its generator faction, else its combat side ('side.hostile'). */
export function tradeFactionOf(ship: Ship): string {
  return ship.gen?.faction ?? `side.${ship.faction}`;
}

/** The profile id that fits a ship best: faction + role, then faction, then side; null if the content has none. */
export function profileFor(sim: Sim, ship: Ship): string | null {
  const traders = sim.content.trade?.traders ?? {};
  const faction = ship.gen?.faction;
  let best: string | null = null;
  let bestScore = 0;
  for (const id of Object.keys(traders).sort()) {
    const m = (traders[id] as TraderDef).match;
    if (m.faction !== undefined && m.faction !== faction) continue;
    if (m.role !== undefined && m.role !== ship.gen?.role) continue;
    if (m.side !== undefined && m.side !== ship.faction) continue;
    const score = (m.faction !== undefined ? 2 : 0) + (m.role !== undefined ? 2 : 0) + (m.side !== undefined ? 1 : 0);
    if (score > bestScore) [best, bestScore] = [id, score];
  }
  return best;
}

/** Roll a trader's wallet and stock from the world seed and an identity number. Pure: same inputs, same trader. */
export function rollTrader(sim: Sim, profile: string, faction: string, name: string, identity: number, station: boolean): Trader {
  const def = sim.content.trade?.traders[profile];
  const rng = new Rng(mix(sim.seed, identity, profile.length, profile.charCodeAt(profile.length - 1)));
  const stock = [];
  for (const line of def?.stock ?? []) {
    if (line.chance !== undefined && !rng.chance(line.chance)) continue;
    const count = rng.int(line.min, line.max);
    if (count > 0 && sim.content.items[line.item]) stock.push({ item: line.item, count });
  }
  const [lo, hi] = def?.credits ?? [0, 0];
  return { profile, faction, name, credits: rng.int(lo, hi), stock, station };
}

/** The trader record of an entity, creating it on first use for a ship. Null if the entity is not a trade partner. */
export function ensureTrader(sim: Sim, id: number): Trader | null {
  const have = sim.world.get(id, TraderC);
  if (have) return have;
  const ship = sim.world.get(id, ShipC);
  if (!ship || ship.faction === 'player') return null;
  const profile = profileFor(sim, ship);
  if (!profile) return null;
  const t = rollTrader(sim, profile, tradeFactionOf(ship), ship.name, ship.gen?.seed ?? id, false);
  sim.world.add(id, TraderC, t);
  return t;
}

export interface HailVerdict {
  answers: boolean;
  /** '' when it answers, else 'silent' (wreck, fled), 'noTrade' (nothing to trade with), 'weaponsHot' or 'hostile'. */
  reason: string;
  /** relation + reputation (+ trader kind): >= 0 answers. */
  score: number;
}

/**
 * The answer rule. A ship answers a hail unless it is dead, aiming at the player, or its attitude is below zero: the
 * faction's base relation, plus the trader kind's, plus the player's reputation with that faction (`story.reputation`).
 */
export function hailVerdict(sim: Sim, id: number): HailVerdict {
  const cfg = sim.content.trade;
  const ship = sim.world.get(id, ShipC);
  const t = ensureTrader(sim, id);
  if (!cfg || !t) return { answers: false, reason: 'noTrade', score: 0 };
  if (ship && ship.state !== 'active' && ship.state !== 'disabled') return { answers: false, reason: 'silent', score: 0 };
  const fac: TradeFactionDef | undefined = cfg.factions[t.faction];
  const score = (fac?.relation ?? 0) + (cfg.traders[t.profile]?.relation ?? 0) + (fac ? reputationOf(sim.story, fac.reputation) : 0);
  if (ship && aimingAtPlayer(sim, id)) return { answers: false, reason: 'weaponsHot', score };
  return { answers: score >= 0, reason: score >= 0 ? '' : 'hostile', score };
}

/** True while this ship's guns are locked on a player ship or shuttle. */
function aimingAtPlayer(sim: Sim, id: number): boolean {
  const c = sim.world.get(id, CombatC);
  const t = c?.target;
  if (!t) return false;
  if (t.vehicle) return false;
  const target = [...sim.world.query(ShipC)].map((s) => sim.world.get(s, ShipC)).find((s) => s?.gridId === t.gridId);
  return target?.faction === 'player';
}

/**
 * Spawn a trading station: an entity with a wallet and stock but no grid yet. Stations have no airlock or shuttle, so
 * their deliveries use the TEMPORARY instant fallback (see systems/trade.ts) until station grids exist.
 */
export function spawnStation(sim: Sim, profile: string, name: string): number {
  const def = sim.content.trade?.traders[profile];
  if (!def) throw new Error(`spawnStation: unknown trader "${profile}"`);
  const id = sim.world.createEntity();
  const faction = def.match.faction ?? `side.${def.match.side ?? 'neutral'}`;
  sim.world.add(id, TraderC, rollTrader(sim, profile, faction, name, id, true));
  return id;
}
