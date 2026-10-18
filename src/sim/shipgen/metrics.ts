import { footprintTiles } from '../modules/footprint';
import type { ModuleDef, ShipTemplate } from '../registry';
import type { MetricBands, MetricId } from './types';

/**
 * Geometric diagnostics of a layout. They describe the architecture (how compact, how full of equipment, how much of
 * it is corridor, how much hangs on narrow links); factions set bands to reject outliers, nothing optimises them.
 */
export function layoutMetrics(t: ShipTemplate, hallTile: (x: number, y: number) => boolean, defs: Record<string, ModuleDef>): Record<MetricId, number> {
  const h = t.rows.length;
  const w = Math.max(...t.rows.map((r) => r.length));
  const at = (x: number, y: number): string => t.rows[y]?.[x] ?? '.';
  let x0 = w; let y0 = h; let x1 = 0; let y1 = 0;
  let filled = 0; let floor = 0; let halls = 0; let narrow = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = at(x, y);
      if (c === '.') continue;
      filled++;
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
      if (c !== '_') continue;
      floor++;
      if (!hallTile(x, y)) continue;
      halls++;
      const open = (dx: number, dy: number): boolean => at(x + dx, y + dy) === '_' || at(x + dx, y + dy) === 'D';
      if ((!open(0, -1) && !open(0, 1)) || (!open(-1, 0) && !open(1, 0))) narrow++;
    }
  }
  const used = new Set<number>();
  for (const m of t.modules ?? []) {
    const d = defs[m.def];
    if (d && m.def !== 'module.light') for (const p of footprintTiles(d, m.x, m.y, m.rot)) if (at(p.x, p.y) === '_') used.add(p.y * w + p.x);
  }
  const bw = x1 - x0 + 1;
  const bh = y1 - y0 + 1;
  const r = (v: number): number => Math.round(v * 1000) / 1000;
  return {
    compactness: r(filled / (bw * bh)),
    occupancy: r(used.size / Math.max(1, floor - halls)),
    corridorRatio: r(halls / Math.max(1, floor)),
    narrowLinks: r(narrow / Math.max(1, halls)),
    aspect: r(bw / bh),
  };
}

/** The first metric outside its band, or null. */
export function metricViolation(m: Record<MetricId, number>, bands: MetricBands | undefined): string | null {
  for (const [k, band] of Object.entries(bands ?? {}) as [MetricId, readonly [number, number]][]) {
    if (m[k] < band[0] || m[k] > band[1]) return `metric ${k} ${m[k]} outside ${band[0]}..${band[1]}`;
  }
  return null;
}

/** Hull mask of a template resampled to a fixed grid (for silhouette comparisons). */
export function silhouetteMask(rows: string[], gw = 32, gh = 16): Uint8Array {
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const out = new Uint8Array(gw * gh);
  for (let j = 0; j < gh; j++) {
    for (let i = 0; i < gw; i++) {
      const c = rows[Math.floor(((j + 0.5) * h) / gh)]?.[Math.floor(((i + 0.5) * w) / gw)] ?? '.';
      out[j * gw + i] = c === '.' ? 0 : 1;
    }
  }
  return out;
}

/** 1 - IoU of two silhouette masks (0 same shape, 1 disjoint). Proportions are compared via the aspect separately. */
export function silhouetteDistance(a: Uint8Array, b: Uint8Array): number {
  let inter = 0;
  let union = 0;
  for (let i = 0; i < a.length; i++) { if (a[i] && b[i]) inter++; if (a[i] || b[i]) union++; }
  return union === 0 ? 0 : 1 - inter / union;
}

/** Normalised edit distance between two section profiles ('C B4 K3 D2'), the architectural difference. */
export function profileDistance(a: string, b: string): number {
  const x = a.split(' ');
  const y = b.split(' ');
  const d = Array.from({ length: x.length + 1 }, (_, i) => Array.from({ length: y.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= x.length; i++) {
    for (let j = 1; j <= y.length; j++) {
      const sub = x[i - 1] === y[j - 1] ? 0 : x[i - 1]?.[0] === y[j - 1]?.[0] ? 0.5 : 1;
      (d[i] as number[])[j] = Math.min((d[i - 1] as number[])[j]! + 1, (d[i] as number[])[j - 1]! + 1, (d[i - 1] as number[])[j - 1]! + sub);
    }
  }
  return (d[x.length] as number[])[y.length]! / Math.max(x.length, y.length);
}

/** Mean pairwise value of `dist` over items. */
export function meanPairwise<T>(items: T[], dist: (a: T, b: T) => number): number {
  let s = 0;
  let n = 0;
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) { s += dist(items[i] as T, items[j] as T); n++; }
  return n === 0 ? 0 : s / n;
}
