import type { Sim } from '../sim';
import { stackSizeOf } from '../items/stacks';
import { unit } from './hash';

/**
 * What a lost container holds (node content `structure.lost_cargo`, DESIGN.md "Core loop direction"). A freight load is one kind of goods, as a hold
 * is packed: the kind is picked by weight at the node's danger tier (richer goods deeper out), and the container is filled to a share of its slots.
 * A rare few are contraband instead, from the black-market list. The goods are plain stacks in the container's storage; opening is up to whoever gets it open.
 */

interface Good {
  item: string;
  /** Weight at tier 0, and its change per tier (never below 0). */
  weight: number;
  perTier?: number;
}

/** Ordinary freight. Staples dominate near the start; parts, electronics and fuel thicken with distance. */
export const CARGO_GOODS: readonly Good[] = [
  { item: 'item.metal', weight: 3 },
  { item: 'item.ration', weight: 2.5, perTier: -0.15 },
  { item: 'item.water', weight: 2, perTier: -0.1 },
  { item: 'item.polymer', weight: 1.5 },
  { item: 'item.cloth', weight: 1.2 },
  { item: 'item.parts', weight: 0.8, perTier: 0.2 },
  { item: 'item.electronics', weight: 0.5, perTier: 0.25 },
  { item: 'item.fuel', weight: 0.5, perTier: 0.1 },
  { item: 'item.energy_crystal', weight: 0.2, perTier: 0.15 },
  { item: 'item.rare_ore', weight: 0, perTier: 0.1 },
];

/** Contraband loads: what turns up in a box nobody wants to claim. */
export const CARGO_CONTRABAND: readonly Good[] = [
  { item: 'item.stolen_goods', weight: 3 },
  { item: 'item.looted_goods', weight: 2 },
  { item: 'item.disruptor', weight: 0.5, perTier: 0.1 },
];

/** Chance a container is contraband: rare, a touch likelier deeper out. */
export const CONTRABAND_CHANCE = { base: 0.05, perTier: 0.008 };
/** Share of a container's slots a load fills, from the least to the most. */
export const FILL: readonly [number, number] = [0.35, 0.9];

function pick(pool: readonly Good[], tier: number, u: number, has: (item: string) => boolean): string | null {
  const live = pool.filter((g) => has(g.item)).map((g) => ({ item: g.item, w: Math.max(0, g.weight + (g.perTier ?? 0) * tier) }));
  const total = live.reduce((t, g) => t + g.w, 0);
  if (total <= 0) return null;
  let at = u * total;
  for (const g of live) {
    if (at < g.w) return g.item;
    at -= g.w;
  }
  return live[live.length - 1]?.item ?? null;
}

/** The stock of one lost container: a function of (seed, tier, capacity). Empty only if the content has none of the goods. */
export function rollCargo(sim: Sim, seed: number, tier: number, capacity: number): { item: string; count: number }[] {
  const has = (item: string) => !!sim.content.items[item];
  const contraband = unit(seed, 201) < CONTRABAND_CHANCE.base + CONTRABAND_CHANCE.perTier * tier;
  const item = pick(contraband ? CARGO_CONTRABAND : CARGO_GOODS, tier, unit(seed, 202), has);
  if (!item) return [];
  const size = stackSizeOf(sim, item);
  const slots = Math.max(1, Math.round(capacity * (FILL[0] + (FILL[1] - FILL[0]) * unit(seed, 203))));
  // Whole stacks except the last, which is part full.
  const out: { item: string; count: number }[] = [];
  for (let i = 0; i < slots; i++) out.push({ item, count: i < slots - 1 ? size : Math.max(1, Math.round(size * (0.3 + 0.7 * unit(seed, 204)))) });
  return out;
}
