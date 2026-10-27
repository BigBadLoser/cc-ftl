import { ShipC, type Ship } from '../combat/components';
import { Rng } from '../rng';
import type { Sim } from '../sim';
import { CombatC } from '../combat/components';
import { reputationOf } from '../story/state';
import { augmentedCrew } from './augmentation';
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

/**
 * The `sim.story.reputation` key a trader's prices and hail read: its owner's own key (every galaxy faction has one), else the key of its
 * trade faction (ships and stations with no owner: debug spawns, plain-template raiders).
 */
export function repKeyOf(sim: Sim, t: { faction: string; owner?: string }): string | undefined {
  const own = t.owner ? sim.content.galaxy?.factions[t.owner]?.reputation : undefined;
  return own ?? sim.content.trade?.factions[t.faction]?.reputation;
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

/** True when a trader sells this item as surplus (its kind's surplus rule covers it). */
export function isSurplus(sim: Sim, profile: string, item: string): boolean {
  const sp = sim.content.trade?.traders[profile]?.surplus;
  const it = sim.content.items[item];
  return !!sp && !!it && it.tags.includes(sp.tag) && (it.tier ?? 99) <= sp.maxTier;
}

/** The weight an owner faction puts on an item's stock lines: the product of its `specialities.stock` weights over the item's tags (1 = none). */
export function stockWeight(sim: Sim, owner: string | undefined, item: string): number {
  const w = owner ? sim.content.galaxy?.factions[owner]?.specialities?.stock : undefined;
  return w ? (sim.content.items[item]?.tags ?? []).reduce((m, tag) => m * (w[tag] ?? 1), 1) : 1;
}

/**
 * Roll a trader's wallet and stock from the world seed and an identity number. Pure: same inputs, same trader. The owner faction weights the stock
 * (`stockWeight`: a favoured good is stocked in bigger counts and more often) without changing what the draws are, so a trader with no owner,
 * or with no speciality in a line, rolls exactly as before.
 */
export function rollTrader(sim: Sim, profile: string, faction: string, name: string, identity: number, station: boolean, owner?: string): Trader {
  const def = sim.content.trade?.traders[profile];
  const rng = new Rng(mix(sim.seed, identity, profile.length, profile.charCodeAt(profile.length - 1)));
  const stock = [];
  for (const line of def?.stock ?? []) {
    const w = stockWeight(sim, owner, line.item);
    if (line.chance !== undefined && !rng.chance(Math.min(1, line.chance * w))) continue;
    const count = Math.round(rng.int(line.min, line.max) * w);
    if (count > 0 && sim.content.items[line.item]) stock.push({ item: line.item, count });
  }
  const sp = def?.surplus;
  if (sp) {
    for (const [item, it] of Object.entries(sim.content.items).sort(([a], [b]) => (a < b ? -1 : 1))) {
      if (!it.tags.includes(sp.tag) || (it.tier ?? 99) > sp.maxTier || stock.some((s) => s.item === item)) continue;
      const count = rng.int(sp.min, sp.max);
      if (count > 0) stock.push({ item, count });
    }
  }
  const [lo, hi] = def?.credits ?? [0, 0];
  return { profile, faction, name, credits: rng.int(lo, hi), stock, station, ...(owner ? { owner } : {}) };
}

/** The trader record of an entity, creating it on first use for a ship. Null if the entity is not a trade partner. */
export function ensureTrader(sim: Sim, id: number): Trader | null {
  const have = sim.world.get(id, TraderC);
  if (have) return have;
  const ship = sim.world.get(id, ShipC);
  if (!ship || ship.faction === 'player') return null;
  const profile = profileFor(sim, ship);
  if (!profile) return null;
  const t = rollTrader(sim, profile, tradeFactionOf(ship), ship.name, ship.gen?.seed ?? id, ship.immobile === true, ship.gen?.owner);
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
  const augmented = fac?.augmentBonus ? fac.augmentBonus * augmentedCrew(sim) : 0;
  const score = (fac?.relation ?? 0) + (cfg.traders[t.profile]?.relation ?? 0) + (fac ? reputationOf(sim.story, repKeyOf(sim, t) ?? fac.reputation) : 0) + augmented;
  if (ship && aimingAtPlayer(sim, id)) return { answers: false, reason: 'weaponsHot', score };
  return { answers: score >= 0, reason: score >= 0 ? '' : 'hostile', score };
}

/** True while this ship's guns are locked on a player ship or shuttle. */
function aimingAtPlayer(sim: Sim, id: number): boolean {
  const c = sim.world.get(id, CombatC);
  const t = c?.target;
  if (!t) return false;
  if (t.vehicle) return false;
  return sim.world.get(t.ship, ShipC)?.faction === 'player';
}
