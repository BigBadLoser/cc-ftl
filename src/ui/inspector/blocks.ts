/** Data shapes of the shared inspector blocks (Breakdown, ConditionList, SlotGrid, TraitChips). */

export interface BreakdownRow { label: string; value: number; op?: 'add' | 'mul'; tag?: string }

export interface Condition { key: string; label: string; text: string; pct: number | null; tone: 'good' | 'ok' | 'warn' | 'bad' }

export interface Slot {
  key: string; label: string; wide?: boolean;
  item: { icon: string; name: string; count?: number; lines?: string[]; note?: string } | null;
  action?: { label: string; onClick: () => void; disabled?: boolean; testId?: string };
}

export interface TraitChip { id: string; name: string; kind: string; flavour: string; effect: string }
