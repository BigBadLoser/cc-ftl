import type { Rng } from '../../rng';

/**
 * Hull silhouettes (SHIPGEN_V4, outline first): a type's outline as data, drawn before any room. The hull runs bow
 * (x = 0) to stern along a centre row (y = 0), mirrored about it, so a corridor three wide centres on it. The parts are
 * the ones settled on the option sheets (docs/SHIPGEN_V4.md, "Hull shape decisions"): a nose (or a command pod), body
 * sections joined by 2:1 tapers, an optional split (a launch lane open out of the stern), gun mounts (swept wings or
 * embrasures cut into the side), swept wings at the rear, and a stern.
 *
 * The outline is held as edges, one half-width per column, so every part is a change to an edge and a final pass can
 * take out one-tile spikes and notches wherever parts meet.
 */

export type Range = readonly [number, number];

/** Nose styles, from the sheets: stepped (A2), round (D1, D2), round onto a straight cheek (DG), steep then gentle (AD). */
export type NoseStyle = 'stepped' | 'round' | 'cheek' | 'steep';

export interface Nose { style: NoseStyle | readonly NoseStyle[]; len: Range; /** Half-width of the flat front. */ front: Range }

/** A command pod at the bow: flat-fronted and narrower than the body, tapering back into it. */
export interface Pod { len: Range; half: Range }

/**
 * A stretch of body at one half-width, reached from the one before by a taper of `taper` tiles along per tile out
 * (default 2; 1 is a hard 45-degree shoulder).
 */
export interface Section { len: Range; half: Range; taper?: number; chance?: number }

/** A body part: one section, or a choice of sections picked per seed (how a recipe moves its masses between seeds). */
export type Part = Section | readonly Section[];

/** A launch lane open out of the stern, from a V at `at` (fraction of the body) to the stern. */
export interface Split { at: Range; lane: Range; /** How the lane ends inside the hull, picked per seed: squared off or rounded. */ end?: readonly ('square' | 'round')[] }

/** Optional parts carry a chance (default 1), so one profile varies between seeds. */
interface Optional { chance?: number }

/**
 * Gun mounts. A wing pair is a swept blister (3a; `cut` sweeps its trailing edge forward too, 3d; `rake` 3 is the long
 * root, 3c). Embrasures are notches cut into a straight side (5a); the hull left between two notches is a gun's blister,
 * at least `tooth` long, so each has room for a gun bay behind it.
 */
export type Mount = Optional & (
  | { kind: 'wing'; count: Range; len: Range; reach: Range; rake?: number; cut?: boolean; span: Range }
  | { kind: 'embrasure'; count: Range; len: Range; depth: Range; tooth: number; span: Range });

/**
 * Sterns: a flat drive bank (S1), a flared drive section (S7), quarter flares (S2), drive pods on pylons (S3), a tapered
 * tail (S4). Quarters and pylons stand `aft` tiles past the stern.
 */
export interface Stern { kind: 'bank' | 'flare' | 'quarters' | 'pylons' | 'tail'; len: Range; out: Range; /** Tiles along per tile out (flare, tail). */ rate?: number; aft?: Range }

export interface Profile {
  id: string;
  nose?: Nose;
  pod?: Pod;
  sections: readonly Part[];
  split?: Split & Optional;
  mounts?: readonly Mount[];
  /** Swept wings at the rear: the leading edge raked 2:1, the trailing edge swept forward over `sweep` tiles. */
  rearWings?: { len: Range; reach: Range; sweep?: Range } & Optional;
  /** One of these, picked per seed. */
  stern: Stern | readonly Stern[];
}

export interface Silhouette {
  /** Rows north to south; row `axis` is the centre row. '#': hull, '>': where the drives exhaust. */
  rows: string[];
  axis: number;
  length: number;
  /** The body's half-width per column, before the stern's flare, wings and pods: what an outline scales (the rest keeps its size in tiles). */
  body: number[];
  /** A gun battery (with `drawSilhouette`'s `guns`): how many sites, and the straight stretches it may stand on, best first. */
  battery?: { guns: number; runs: [number, number][]; /** A gun room's floor columns and rows (set by the outline). */ w?: number; h?: number };
}

const pick = (rng: Rng, r: Range): number => rng.int(r[0], r[1]);
const one = <T>(rng: Rng, v: T | readonly T[]): T => (Array.isArray(v) ? rng.pick(v as readonly T[]) : (v as T));
const has = (rng: Rng, o: Optional | undefined): boolean => o !== undefined && (o.chance === undefined || rng.chance(o.chance));

/** A nose's half-width at step i of n, from its flat front out to the body's half-width h. */
function noseHalf(style: NoseStyle, i: number, n: number, front: number, h: number): number {
  const t = i / n, span = h - front;
  switch (style) {
    case 'stepped': return front + Math.floor((span * Math.floor(i / 3) * 3) / n);
    case 'round': return front + Math.round(span * Math.sqrt(1 - (1 - t) ** 2));
    case 'cheek': return t < 0.6 ? front + Math.round((span - 2) * Math.sqrt(1 - (1 - t / 0.6) ** 2)) : t < 0.85 ? h - 2 : h - 1;
    case 'steep': return front + Math.round(span * Math.sqrt(t));
  }
}

/** The body's half-widths bow to stern: nose or pod, then the sections joined by their tapers. */
function body(rng: Rng, p: Profile): { outer: number[]; bodyStart: number } {
  const secs = p.sections
    .map((part) => one(rng, part))
    .filter((s) => s.chance === undefined || rng.chance(s.chance))
    .map((s) => ({ len: pick(rng, s.len), half: pick(rng, s.half), taper: s.taper ?? 2 }));
  const H0 = (secs[0] as { half: number }).half;
  const outer: number[] = [];
  if (p.pod) {
    const len = pick(rng, p.pod.len), half = pick(rng, p.pod.half);
    // Flat-fronted, its front corners chamfered so the pod never meets the dark at a right angle.
    for (let i = 0; i < len; i++) outer.push(Math.max(1, half - Math.max(0, 2 - i)));
    for (let h = half + 1; h <= H0; h++) outer.push(h, h);
  } else if (p.nose) {
    const len = pick(rng, p.nose.len), front = pick(rng, p.nose.front), style = one(rng, p.nose.style);
    // At most two tiles out per column, so no nose has a square shoulder; a nose that falls short runs on 2:1.
    let h = front - 2;
    for (let i = 0; i < len; i++) { h = Math.min(H0, noseHalf(style, i, len, front, H0), h + 2); outer.push(h); }
    while (h < H0) { h = Math.min(H0, h + 2); outer.push(h); }
  }
  const bodyStart = outer.length;
  let prev = H0;
  for (const s of secs) {
    const start = outer.length;
    while (prev < s.half) { prev++; for (let k = 0; k < s.taper; k++) outer.push(prev); }
    while (prev > s.half) { for (let k = 0; k < s.taper; k++) outer.push(prev); prev--; }
    while (outer.length - start < s.len) outer.push(s.half);
  }
  return { outer, bodyStart };
}

/**
 * Take out bumps and dents up to three columns wide (a run with both neighbours lower, or both higher), so no part
 * leaves a lone tile or a one-tile ledge where it meets another. Embrasures are wider than this and stay.
 */
function smooth(e: number[], lo = 0, hi = e.length): void {
  for (let pass = 0; pass < 3; pass++) {
    for (let x = lo + 1; x < hi - 1; x++) {
      const v = e[x] as number;
      let end = x;
      while (end + 1 < hi && e[end + 1] === v) end++;
      if (end + 1 >= hi || end - x + 1 > 3) { x = end; continue; }
      const a = e[x - 1] as number, c = e[end + 1] as number;
      const to = v > a && v > c ? Math.max(a, c) : v < a && v < c ? Math.min(a, c) : v;
      for (let k = x; k <= end; k++) e[k] = to;
      x = end;
    }
  }
}

/** Columns [x0, x1) where the body's side is straight, with `margin` straight tiles either side. */
const straight = (outer: number[], x0: number, x1: number, margin: number): boolean => {
  const a = Math.max(0, x0 - margin), b = Math.min(outer.length, x1 + margin);
  for (let x = a; x < b; x++) if (outer[x] !== outer[x0]) return false;
  return true;
};

/**
 * PROTOTYPE (#581): where a battery of `guns` gun sites may stand: the side's straight stretches clear of the stern by a
 * drive's length, the widest first (the longer of a width first). The sites and their notches are cut at the outline's
 * scale (`outlineShip`), so a blister is a gun bay's length.
 */
function batteryRuns(outer: number[], bodyStart: number, sternFrom: number): [number, number][] {
  const runs: [number, number][] = [];
  for (let x = bodyStart; x < sternFrom - 6;) {
    let e = x;
    while (e < sternFrom - 6 && outer[e] === outer[x]) e++;
    if (e - x >= 4) runs.push([x, e]);
    x = e;
  }
  return runs.sort((p, q) => (outer[q[0]] as number) - (outer[p[0]] as number) || (q[1] - q[0]) - (p[1] - p[0]));
}

function addMounts(rng: Rng, p: Profile, outer: number[], top: number[], bodyStart: number, sternFrom: number, sites = false): void {
  const L = outer.length;
  const pos = (f: number): number => bodyStart + Math.floor(f * (L - bodyStart));
  for (const m of p.mounts ?? []) {
    if (!has(rng, m)) continue;
    const len = pick(rng, m.len);
    const a = pos(m.span[0]);
    let b = Math.min(pos(m.span[1]), sternFrom) - len;
    if (b < a) { if (a + len > sternFrom) continue; b = a; }
    if (sites && m.kind === 'embrasure') continue;
    if (m.kind === 'wing') {
      const n = pick(rng, m.count), reach = pick(rng, m.reach), rake = m.rake ?? 2;
      for (let i = 0; i < n; i++) {
        const x0 = n === 1 ? Math.floor((a + b) / 2) : Math.round(a + ((b - a) * i) / (n - 1));
        const side = Math.min(...outer.slice(x0, x0 + len));
        for (let k = 0; k < len; k++) {
          let r = Math.min(reach, Math.floor(k / rake) + 1);
          // A cut trailing edge sweeps forward 2:1 from the tip, ending a full step out so no lone tile is left.
          if (m.cut) r = Math.min(r, Math.floor((len - 1 - k) / 2) + 2);
          const x = x0 + k;
          top[x] = Math.max(top[x] as number, side + r);
        }
      }
    } else {
      // Embrasures: notches on a straight stretch, each blister between them at least a tooth long.
      const depth = pick(rng, m.depth);
      let n = pick(rng, m.count);
      const fits = (k: number): number[] | null => {
        const run = k * len + (k - 1) * m.tooth;
        if (run > b + len - a) return null;
        // Any straight placement inside the span, picked per seed, so the battery moves along the hull between seeds.
        const ok: number[] = [];
        for (let x0 = a; x0 + run <= b + len; x0++) if (straight(outer, x0, x0 + run, m.tooth)) ok.push(x0);
        if (ok.length === 0) return null;
        const x0 = rng.pick(ok);
        return Array.from({ length: k }, (_, i) => x0 + i * (len + m.tooth));
      };
      let xs = fits(n);
      while (!xs && n > 1) xs = fits(--n);
      for (const x0 of xs ?? []) for (let x = x0; x < x0 + len; x++) top[x] = (outer[x] as number) - depth;
    }
  }
}

/** With `guns`, that many gun sites stand in place of the profile's embrasures (PROTOTYPE, #581). */
export function drawSilhouette(rng: Rng, p: Profile, guns?: number): Silhouette {
  const { outer, bodyStart } = body(rng, p);
  const st = one(rng, p.stern), sLen = pick(rng, st.len), sOut = pick(rng, st.out), rate = st.rate ?? 2;
  const L = outer.length;
  // Flare and tail reshape the last stretch of the body itself; mounts stay clear of it.
  const shaped = st.kind === 'flare' || st.kind === 'tail';
  const pre = outer.slice();
  if (shaped) {
    for (let i = 0; i < sLen; i++) {
      const x = L - sLen + i, d = Math.min(sOut, Math.floor(i / rate) + 1);
      outer[x] = (outer[x] as number) + (st.kind === 'flare' ? d : -d);
    }
  }
  const rw = has(rng, p.rearWings) ? p.rearWings : undefined;
  const rwLen = rw ? pick(rng, rw.len) : 0;
  const sternFrom = L - Math.max(shaped || st.kind !== 'bank' ? sLen : 0, rwLen) - 2;
  const top = outer.slice();
  addMounts(rng, p, outer, top, bodyStart, sternFrom, guns !== undefined);
  if (rw) {
    const reach = pick(rng, rw.reach), sweep = rw.sweep ? pick(rng, rw.sweep) : 0;
    for (let k = 0; k < rwLen; k++) {
      const x = L - rwLen + k, back = rwLen - 1 - k;
      let r = Math.min(reach, Math.floor(k / 2) + 1);
      if (back < sweep) r = Math.min(r, reach - (sweep - back) + 1);
      top[x] = Math.max(top[x] as number, (outer[x] as number) + Math.max(1, r));
    }
  }
  smooth(top, 1, L);
  const battery = guns !== undefined ? { guns, runs: batteryRuns(outer, bodyStart, sternFrom) } : undefined;
  const inner = Array<number>(L).fill(-1);
  if (p.split && has(rng, p.split)) {
    const f = rng.int(Math.round(p.split.at[0] * 100), Math.round(p.split.at[1] * 100)) / 100;
    const x0 = bodyStart + Math.floor((L - bodyStart) * f), lane = pick(rng, p.split.lane);
    const end = p.split.end ? rng.pick(p.split.end) : 'square';
    for (let x = x0; x < L; x++) {
      const dx = x - x0;
      inner[x] = end === 'square' || dx >= lane ? lane : Math.floor(Math.sqrt(lane * lane - (lane - dx) ** 2));
    }
  }

  const aft = st.aft ? pick(rng, st.aft) : 2;
  const maxHalf = Math.max(...top) + 12;
  const axis = maxHalf;
  const grid = Array.from({ length: 2 * maxHalf + 1 }, () => Array<string>(L + aft + 8).fill('.'));
  const put = (x: number, y: number, c = '#'): void => { const row = grid[axis + y]; if (row && x >= 0 && x < row.length && (c === '#' || row[x] === '.')) row[x] = c; };
  const both = (x: number, y: number, c = '#'): void => { put(x, y, c); put(x, -y, c); };
  for (let x = 0; x < L; x++) for (let y = (inner[x] as number) + 1; y <= (top[x] as number); y++) both(x, y);
  // Quarter flares and pylon pods stand past the stern's sides.
  const half = top[L - 1] as number;
  if (st.kind === 'quarters') {
    for (let x = L - sLen; x < L + aft; x++) {
      const r = Math.min(sOut, Math.floor((x - (L - sLen)) / 2) + 1);
      for (let y = Math.max(2, half - 3); y <= half + r; y++) both(x, y);
    }
  }
  if (st.kind === 'pylons') {
    const pod = 3, gap = 2, y0 = half + gap + 1;
    for (let x = L - sLen; x < L + aft; x++) {
      const t = Math.min(pod - 1, Math.floor((x - (L - sLen)) / 2) + 1);
      for (let y = y0 + (pod - 1 - t); y < y0 + pod; y++) both(x, y);
    }
    // One enclosed passage from the hull out to each pod, wide enough to walk through.
    const cx = L - sLen + Math.floor((sLen - 4) / 2);
    for (let x = cx; x < cx + 4; x++) for (let y = half + 1; y < y0; y++) both(x, y);
  }
  // Where the drives exhaust: past the hull's last tile on every row that reaches the stern.
  for (const row of grid) {
    const last = row.lastIndexOf('#');
    if (last >= L - 2) row[last + 1] = '>';
  }
  const used = grid.map((r) => r.join(''));
  const ys = used.flatMap((r, y) => (/[#=]/.test(r) ? [y] : []));
  const y0 = Math.min(...ys), y1 = Math.max(...ys);
  const w = Math.max(...used.map((r) => Math.max(r.lastIndexOf('#'), r.lastIndexOf('>')))) + 1;
  const bodyHalf = top.map((t, x) => (x < sternFrom ? t : (pre[x] as number)));
  return { rows: used.slice(y0, y1 + 1).map((r) => r.slice(0, w)), axis: axis - y0, length: w, body: bodyHalf, ...(battery ? { battery } : {}) };
}
