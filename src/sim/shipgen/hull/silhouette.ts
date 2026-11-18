import type { Rng } from '../../rng';

/**
 * Hull silhouettes (SHIPGEN_V4, outline first): a type's outline as data, drawn before any room. The hull runs bow (x = 0)
 * to stern along a centre row (y = 0), mirrored about it unless a feature says otherwise, so a corridor three wide
 * centres on it. A silhouette is a run of sections, each a half-width (tiles beside the centre row) and optionally a
 * void down its middle (a twin hull); sections join by a taper (`slope` tiles along per tile of width) or a step. Gun
 * sponsons stand out from the sides, engine pods from the stern quarters, an island from one side.
 */

export type Range = readonly [number, number];

export interface Section {
  len: Range;
  half: Range;
  /** Half-width of an open void down the middle (two arms round it); 0 or none: solid. */
  inner?: Range;
  /** How it meets the section before: tapered (default) or stepped. */
  join?: 'taper' | 'step';
}

export interface Sponsons {
  /** Pairs, one each side (or one side only with `side`). */
  count: Range;
  len: Range;
  depth: Range;
  /** Stretch of the hull they stand along, as fractions bow (0) to stern (1). */
  span: Range;
  side?: 'both' | 'south';
}

export interface Pods {
  /** Along, from the stern. */
  len: Range;
  /** How far past the hull's side they stand. */
  out: Range;
  /** Stand out aft of the stern too. */
  aft?: Range;
}

export interface Profile {
  id: string;
  /** The bow's tip half-width and its taper (tiles along per tile of width). */
  bow: { tip: Range; slope: Range };
  sections: readonly Section[];
  sponsons?: readonly Sponsons[];
  pods?: Pods;
}

export interface Silhouette {
  /** Rows north to south; row `axis` is the centre row. '#': hull. */
  rows: string[];
  axis: number;
  length: number;
}

const pick = (rng: Rng, r: Range): number => rng.int(r[0], r[1]);

export function drawSilhouette(rng: Rng, p: Profile): Silhouette {
  // Half-widths along the hull: outer and void.
  const outer: number[] = [], inner: number[] = [];
  const secs = p.sections.map((s) => ({ len: pick(rng, s.len), half: pick(rng, s.half), inner: s.inner ? pick(rng, s.inner) : 0, join: s.join ?? 'taper' }));
  const tip = pick(rng, p.bow.tip), slope = pick(rng, p.bow.slope);
  // Bow: from the tip out to the first section's width.
  const first = secs[0] as (typeof secs)[number];
  for (let h = tip; h < first.half; h++) for (let k = 0; k < slope; k++) { outer.push(h); inner.push(0); }
  let prev = first.half, prevIn = 0;
  for (const s of secs) {
    const start = outer.length;
    // A taper between widths takes the start of the section (two along per tile, as the bow's own slope at least).
    if (s.join === 'taper' && s.half !== prev) {
      const step = Math.max(2, Math.min(slope, 3));
      for (let h = prev; h !== s.half; h += s.half > prev ? 1 : -1) for (let k = 0; k < step; k++) { outer.push(h + (s.half > prev ? 1 : 0)); inner.push(Math.min(s.inner, prevIn)); }
    }
    while (outer.length - start < s.len) { outer.push(s.half); inner.push(s.inner); }
    prev = s.half; prevIn = s.inner;
  }
  const L = outer.length;
  const maxHalf = Math.max(...outer) + 12;
  const H = 2 * maxHalf + 1, axis = maxHalf;
  const grid = Array.from({ length: H }, () => Array<string>(L + 12).fill('.'));
  const fill = (x: number, y: number): void => { const row = grid[axis + y]; if (row && x >= 0 && x < row.length) row[x] = '#'; };
  for (let x = 0; x < L; x++) for (let y = -(outer[x] as number); y <= (outer[x] as number); y++) if (Math.abs(y) > (inner[x] as number) || (inner[x] as number) === 0) fill(x, y);
  // Sponsons: blocks standing out from the side, their outer corners cut.
  for (const sp of p.sponsons ?? []) {
    const n = pick(rng, sp.count), len = pick(rng, sp.len), depth = pick(rng, sp.depth);
    const a = Math.floor(sp.span[0] * L), b = Math.floor(sp.span[1] * L) - len;
    for (let i = 0; i < n; i++) {
      const x0 = n === 1 ? Math.floor((a + b) / 2) : Math.round(a + ((b - a) * i) / (n - 1));
      const base = Math.min(...outer.slice(x0, x0 + len));
      for (let x = x0; x < x0 + len; x++) for (let d = 1; d <= depth; d++) {
        const cut = d === depth && (x === x0 || x === x0 + len - 1);
        if (cut) continue;
        const y = base + d;
        if (sp.side !== 'south') fill(x, -y);
        fill(x, y);
      }
    }
  }
  // Engine pods: blocks on the stern quarters, standing out past the side (and aft), their bow ends tapered.
  if (p.pods) {
    const len = pick(rng, p.pods.len), out = pick(rng, p.pods.out), aft = p.pods.aft ? pick(rng, p.pods.aft) : 0;
    const half = outer[L - 1] as number;
    // Each pod is `out` + 4 rows deep: it overlaps the side by four rows and stands `out` past it, so aft of the stern
    // the two leave a notch between them.
    const outerEdge = half + out, innerEdge = outerEdge - (out + 4) + 1;
    for (let x = L - len; x < L + aft; x++) {
      const reach = Math.min(out, Math.floor((x - (L - len)) / 2) + 1); // the bow end tapered
      for (let y = innerEdge; y <= half + reach; y++) { fill(x, y); fill(x, -y); }
    }
  }
  // Trim to what was drawn.
  const used = grid.map((r) => r.join(''));
  const ys = used.flatMap((r, y) => (r.includes('#') ? [y] : []));
  const y0 = Math.min(...ys), y1 = Math.max(...ys);
  const w = Math.max(...used.map((r) => r.lastIndexOf('#'))) + 1;
  return { rows: used.slice(y0, y1 + 1).map((r) => r.slice(0, w)), axis: axis - y0, length: w };
}
