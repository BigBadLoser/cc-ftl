import type { ScheduleBlock } from '../sim';

/** Pure helpers for the crew schedule panel and the HUD clock (#412). The sim owns every schedule rule; this only reads snapshot rows. */

export type Row = readonly ScheduleBlock[];

export const BRUSHES: { block: ScheduleBlock; label: string; key: string }[] = [
  { block: 'any', label: 'Any', key: '1' },
  { block: 'work', label: 'Work', key: '2' },
  { block: 'sleep', label: 'Sleep', key: '3' },
  { block: 'free', label: 'Free', key: '4' },
];

/** Per hour, how many rows have Work in that hour. */
export function coverage(rows: readonly Row[]): number[] {
  return Array.from({ length: 24 }, (_, h) => rows.reduce((n, r) => n + (r[h] === 'work' ? 1 : 0), 0));
}

/** How a count of crew on Work reads: nobody (red), one (amber), or covered. */
export const coverTone = (n: number): 'none' | 'one' | 'ok' => (n === 0 ? 'none' : n === 1 ? 'one' : 'ok');

/** The id of the preset whose 24 blocks equal the row, or null (the row is "Custom"). */
export function matchPreset(row: Row, presets: readonly { id: string; hours: Row }[]): string | null {
  return presets.find((p) => p.hours.length === row.length && p.hours.every((b, h) => b === row[h]))?.id ?? null;
}

/** The inclusive hour range a drag from `a` to `b` paints (never wrapping: the lower hour first). */
export const paintRange = (a: number, b: number): { from: number; to: number } => ({ from: Math.min(a, b), to: Math.max(a, b) });

/** A row with a drag's range painted over it, for the preview while the button is down. */
export function painted(row: Row, a: number, b: number, block: ScheduleBlock): ScheduleBlock[] {
  const { from, to } = paintRange(a, b);
  return row.map((x, h) => (h >= from && h <= to ? block : x));
}

/** "HH:MM" of the ship clock. */
export const clockText = (c: { hour: number; minute: number }): string => `${String(c.hour).padStart(2, '0')}:${String(c.minute).padStart(2, '0')}`;

/** Selection after a click on a crew name: shift toggles it in the set, a plain click selects only it (or clears when it was the only one). */
export function clickSelect(sel: readonly number[], id: number, shift: boolean): number[] {
  if (shift) return sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id];
  return sel.length === 1 && sel[0] === id ? [] : [id];
}

/** The rows a row-level action applies to: the selection when the row is in it, else just that row. */
export const targets = (sel: readonly number[], id: number): number[] => (sel.includes(id) ? [...sel] : [id]);
