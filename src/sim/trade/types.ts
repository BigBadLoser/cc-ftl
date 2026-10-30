import { defineComponent } from '../ecs';
import type { Faction } from '../combat/components';
import type { ItemQty } from '../registry';

/**
 * Trade content (`ContentRegistry.trade`). Terminology: a "node" is one playable location (the old "sector"); this file
 * only knows trade partners, which are entities (ships; stations are immobile ships).
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
  /** Added to the hail score for each heavily augmented crew member of the player (trade/augmentation.ts; the zealots). */
  augmentBonus?: number;
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
  /**
   * Surplus: every item with `tag` up to `maxTier` (ItemDef.tier; older, middle-grade gear, never the best) is stocked with a
   * count in [min, max] and sold at `markup` (on top of the other price modifiers). Labelled "surplus" in the trade window.
   */
  surplus?: { tag: string; maxTier: number; min: number; max: number; markup: number };
}

/** A trade partner entity (a ship, or a station): its wallet and stock. Created on the first hail. */
export interface Trader {
  /** TraderDef id and TradeFactionDef id it was resolved to. */
  profile: string;
  faction: string;
  name: string;
  credits: number;
  stock: ItemQty[];
  /** True for a station (an immobile ship): its trades run like any ship's, by shuttle. */
  station: boolean;
  /**
   * The galaxy faction that owns this trader (a ship's fleet, a station's port): its standing sets the prices and the hail, its specialities the
   * stock and some prices. Absent = the trade faction's own reputation key.
   */
  owner?: string;
  /**
   * Set while a station stands in a node with a port (galaxy/marketLive.ts): the port whose market this trader is. Its `stock` is then the port's stock, and
   * `base` the port's baseline for the commodities (item, count; 0 allowed), against which prices rise with scarcity and fall with plenty (`stockFactor`).
   */
  port?: string;
  base?: ItemQty[];
  /** Black-market service sets this station carries (`ContentRegistry.blackMarkets` ids; blackmarket/services.ts). */
  services?: string[];
  /** The fence's rate (its share of an item's value) when a set gives the station a fence. */
  fence?: number;
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

/**
 * Deal phases. At a station the player's shuttle docks (`dockStation`) and the station crew haul both ways
 * (`stationWork`) instead of the hover swap (`exchange`).
 */
export type DealPhase = 'dispatch' | 'load' | 'out' | 'dockStation' | 'stationWork' | 'exchange' | 'back' | 'unload' | 'done' | 'failed';

/** One haul trip of a larger order: its share of the goods, priced when the order was accepted. */
export interface Trip {
  give: ItemQty[];
  get: ItemQty[];
  balance: number;
}

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
  /** Who flies: the trader's own shuttle or the player's. */
  courier: 'them' | 'you';
  phase: DealPhase;
  /** Vehicle entity doing the run (0 until it exists). */
  vehicle: number;
  /** Player airlock module the shuttle docks at. */
  airlock: number;
  /** Ticks spent in this phase (timeouts, the exchange). */
  timer: number;
  /** Tick the deal was made. */
  tick: number;
  /** The agreed value of each `get` line (aligned with `get`, summing to the escrow), fixed when the trip opens: a part-delivered run is settled by it, not by later prices. */
  getValue?: number[];
  /** Why a failed deal failed. */
  reason?: string;
  /** How the goods change hands at the trader: docked at a station airlock, or the hover swap (no free station airlock). */
  via?: 'dock' | 'hover';
  /** Docking at a station: the station airlock (reserved by the dock order) and the bought goods staged in its storage. */
  dock?: { airlock: number; staged: { storage: number; item: string; count: number }[] };
  /**
   * An order bigger than one hold runs as several trips, one after another (settled trip by trip: each trip's credits and goods are held
   * only while it runs). `n` of `of` is the trip now running (the deal's give/get/balance/held are that trip's) and `rest` the trips still to
   * come. A deal called off or lost drops `rest`; trips already settled stay settled. `stopped` is why the order ended before the last trip.
   */
  trip?: { n: number; of: number; rest: Trip[]; stopped?: string };
  /** A hiring run: the recruits (crew entities of the station) the shuttle fetches. The escrow is their cost, paid when they arrive. */
  crew?: number[];
  /**
   * A delivery handover (galaxy/handover.ts): the station's shuttle comes to the player's airlock for the crate of job `job`. No goods and no escrow; the
   * deal's `ship` is the station. `retryAt` is the tick after which a called-off run may be tried again.
   */
  handover?: { job: number; via: 'station' | 'own'; retryAt?: number };
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
