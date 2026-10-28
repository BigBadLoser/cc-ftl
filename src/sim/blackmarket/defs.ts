import type { ItemQty } from '../registry';

/**
 * A black-market service set (`ContentRegistry.blackMarkets`, content/blackMarkets.ts). A set is attached to a station (`attachServices`), not tied to
 * how the station was generated, so any station can carry one. The lesser set belongs to pirate-held and lawless stations; the three named sets (cartel,
 * zealot machine bazaar, mercenary hiring hall) are ready to attach but the galaxy does not spawn them yet (DESIGN.md "Black markets").
 */
export interface BlackMarketDef {
  name: string;
  /** 'lesser' sets are wired to existing stations; 'named' ones are the three specialist markets. */
  tier: 'lesser' | 'named';
  /** Galaxy faction that owns a station carrying the set . */
  owner?: string;
  /** Price multipliers of the whole service, and per item tag (multiplied in for every tag the item has). */
  sell?: number;
  buy?: number;
  tagMods?: Readonly<Record<string, { sell?: number; buy?: number }>>;
  /** Share of an item's value it pays for contraband. A legitimate trader refuses contraband outright. */
  contrabandBuy: number;
  /** Stock lines added to the station's shelves (rolled from the world seed and the station, so a given station always rolls the same). */
  stock: readonly { item: string; min: number; max: number; chance?: number }[];
  /** The fence: buys anything, contraband included, at a share of its value in [min, max] (rolled per station), with no questions. */
  fence?: { min: number; max: number };
  /**
   * Shady crew for hire on top of the station's own: `slots` candidates per window of the given `roles`, each with `bonus` extra levels in every
   * skill of its role, hired for `costMult` x the usual price + `extra`. They take no wages (nobody does), so there is no wage field.
   * TODO(drawbacks): shady crew will carry a drawback trait each once traits exist.
   */
  shadyCrew?: { slots: number; roles: readonly string[]; bonus: number; costMult: number; extra: number };
  /** Sets the node's truce flag (blackmarket/truce.ts). */
  truce: boolean;
  /** Trade faction (`TradeDef.factions` id) the station trades under when the set is attached: its hail relation and price tilts apply (the zealot bazaar: `faction.zealot`, with its augmentation rule). */
  tradeFaction?: string;
}

/** Plain stock lines. */
export type StockLine = ItemQty;
