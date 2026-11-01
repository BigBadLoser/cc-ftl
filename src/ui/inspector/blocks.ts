/** Data shapes of the shared inspector blocks (Breakdown, ConditionList, SlotGrid, TraitChips). */

export interface BreakdownRow { label: string; value: number; op?: 'add' | 'mul'; tag?: string }

export interface Condition { key: string; label: string; text: string; pct: number | null; tone: 'good' | 'ok' | 'warn' | 'bad' | 'dim'; /** Bar colour (default by tone). */ color?: string }

/** A hover card for an item (see ItemCard.svelte). */
export interface Card {
  title: string;
  sub: string;
  rows: { label: string; value: string; note?: string; extra?: { text: string; good: boolean } }[];
  foot: { label: string; value: string; note?: string }[];
  flavour?: string;
}

/**
 * One equipment slot: its label, the faint glyph an empty slot shows, and what fills it (`icon`: the item id, for its
 * sprite) with its hover card; an optional action under it (Equip).
 */
export interface Slot {
  key: string;
  label: string;
  glyph: string;
  item: { icon: string; name: string; count?: number; note?: string; card?: Card | null } | null;
  action?: { label: string; onClick: () => void; disabled?: boolean; testId?: string };
}

export interface TraitChip { id: string; name: string; kind: string; flavour: string; effect: string; short?: string }
