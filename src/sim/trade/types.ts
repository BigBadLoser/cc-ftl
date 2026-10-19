import { defineComponent } from '../ecs';
import type { Faction } from '../combat/components';
import type { ItemQty } from '../registry';

/**
 * Trade content (`ContentRegistry.trade`). Terminology: a "node" is one playable location (the old "sector"); this file
 * only knows trade partners, which are entities (ships, or stations that have no grid yet).
 */
export interface TradeDef {
  /** Credits the player starts with. */
  startCredits: number;
  /** Global spread against an item's base price: a trader sells at base x sell and buys at base x buy (buy < 1 < sell). */
  spread: { sell: number; buy: number };
  /** Each reputation point shifts prices by this fraction (sell cheaper, buy dearer for the player), capped at +-repMax. */
  repStep: number;
  repMax: number;
  /** Seconds the cargo takes to change hands when the shuttle meets the trader's ship. */
  exchangeSec: number;
  /** Trade stance by faction id ('faction.civilian') or by combat side ('side.hostile'). */
  factions: Record<string, TradeFactionDef>;
  /** Trader profiles by id ('trader.freighter'): ship roles and station kinds. */
  traders: Record<string, TraderDef>;
}

/**
 * How a faction treats the player. A ship answers a hail when `relation + reputation[reputation] + trader.relation >= 0`.
 * A proper faction system will replace this table; the rest of the trade code only reads `traderStance()`.
 */
export interface TradeFactionDef {
  name: string;
  /** Key into `sim.story.reputation`. */
  reputation: string;
  /** Base attitude: >= 0 talks to strangers, < 0 needs reputation first. */
  relation: number;
  /** Price multipliers of the whole faction (default 1). */
  sell?: number;
  buy?: number;
}

/** A kind of trader: a ship role or a station kind. */
export interface TraderDef {
  name: string;
  /** Which entities use it, most specific wins: faction + role, then faction, then combat side. */
  match: { faction?: string; role?: string; side?: Faction };
  /** Added to the faction's relation (a liner is friendlier than a freighter's skeleton crew, say). */
  relation?: number;
  /** Has its own shuttle: it flies goods to the player instead of the player fetching them. */
  shuttle: boolean;
  /** Price multipliers of this kind of trader (default 1), and per item tag (multiplied in for every tag the item has). */
  sell?: number;
  buy?: number;
  tagMods?: Record<string, { sell?: number; buy?: number }>;
  /** Wallet, rolled in [min, max]. */
  credits: [number, number];
  /** Stock for sale: each entry is included with `chance` (default 1) and rolls a count in [min, max]. */
  stock: { item: string; min: number; max: number; chance?: number }[];
}

/** A trade partner entity (a ship, or a station): its wallet and stock. Created on the first hail. */
export interface Trader {
  /** TraderDef id and TradeFactionDef id it was resolved to. */
  profile: string;
  faction: string;
  name: string;
  credits: number;
  stock: ItemQty[];
  /** True for a station with no grid: deliveries are the temporary instant fallback. */
  station: boolean;
}
export const TraderC = defineComponent<Trader>('trader');

export interface Hail {
  ship: number;
  answered: boolean;
  /** Refusal code ('hostile', 'weaponsHot', 'silent', 'noTrade') or ''. */
  reason: string;
  tick: number;
}

/** A priced proposal the player may accept. Lines are item counts; `balance` > 0 means the player pays credits. */
export interface Offer {
  id: number;
  ship: number;
  /** Items the player hands over / receives. */
  give: ItemQty[];
  get: ItemQty[];
  barter: boolean;
  balance: number;
  tick: number;
}

export type DealPhase = 'dispatch' | 'load' | 'out' | 'exchange' | 'back' | 'unload' | 'done' | 'failed';

/** An accepted deal: escrow, reserved goods and the delivery task. */
export interface Deal {
  id: number;
  ship: number;
  give: ItemQty[];
  get: ItemQty[];
  barter: boolean;
  balance: number;
  /** Credits held in escrow from the payer (the player when balance > 0, the trader when < 0). Paid out on delivery. */
  held: number;
  /** Who flies: the trader's own shuttle, the player's, or the temporary instant fallback (stations with no grid). */
  courier: 'them' | 'you' | 'instant';
  phase: DealPhase;
  /** Vehicle entity doing the run (0 until it exists / instant). */
  vehicle: number;
  /** Player airlock module the shuttle docks at. */
  airlock: number;
  /** Ticks spent in this phase (timeouts, the exchange). */
  timer: number;
  /** Tick the deal was made. */
  tick: number;
  /** Why a failed deal failed. */
  reason?: string;
}

/** All trade state. Plain data on the Sim, saved with it (optional in old saves). */
export interface TradeState {
  /** The player's credits. NPC wallets live on their `TraderC`. */
  credits: number;
  hails: Hail[];
  offers: Offer[];
  deals: Deal[];
  nextId: number;
}

export function newTrade(credits = 0): TradeState {
  return { credits, hails: [], offers: [], deals: [], nextId: 1 };
}
