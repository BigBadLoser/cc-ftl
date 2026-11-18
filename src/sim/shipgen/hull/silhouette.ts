import type { Rng } from '../../rng';

/**
 * Hull silhouettes (SHIPGEN_V4, outline first): a type's outline as data, drawn before any room. The hull runs bow
 * (x = 0) to stern along a centre row (y = 0), mirrored about it, so a corridor three wide centres on it. The parts are
 * the ones settled on the option sheets (docs/SHIPGEN_V4.md, "Hull shape decisions"): a nose (or a command pod), body
 * sections joined by 2:1 tapers, an optional split (a launch lane open out of the stern), gun mounts (swept wings or
 * embrasures cut into the side), swept wings at the rear, and a stern.
 */

export type Range = readonly [number, number];

/** Nose styles, from the sheets: stepped (A2), round (D1, D2), round onto a straight cheek (DG), steep then gentle (AD). */
export type NoseStyle = 'stepped' | 'round' | 'cheek' | 'steep';

export interface Nose { style: NoseStyle; len: Range; /** Half-width of the flat front. */ front: Range }

/** A command pod at the bow: flat-fronted and narrower than the body, tapering back into it. */
export interface Pod { len: Range; half: Range }

export interface Section { len: Range; half: Range }

/** A launch lane open out of the stern, from a V at `at` (fraction of the body) to the stern. */
export interface Split { at: Range; lane: Range }

/** Gun mounts: a swept wing pair (3a; `cut` trims its trailing edge, 3d; `rake` 3 is the long root, 3c) or embrasures cut into the side (5a). */
export type Mount =
  | { kind: 'wing'; count: Range; len: Range; reach: Range; rake?: number; cut?: boolean; span: Range }
  | { kind: 'embrasure'; count: Range; len: Range; depth: Range; span: Range };

/** Sterns: a flat drive bank (S1), a flared drive section (S7), quarter flares (S2), drive pods on pylons (S3), a tapered tail (S4). */
export interface Stern { kind: 'bank' | 'flare' | 'quarters' | 'pylons' | 'tail'; len: Range; out: Range; /** Tiles along per tile out (flare, tail). */ rate?: number }

export interface Profile {
  id: string;
  nose?: Nose;
  pod?: Pod;
  sections: readonly Section[];
  split?: Split;
  mounts?: readonly Mount[];
  /** Swept wings at the rear, their trailing edge at the stern. */
  rearWings?: { len: Range; reach: Range };
  stern: Stern;
}

export interface Silhouette {
  /** Rows north to south; row `axis` is the centre row. '#': hull, '=': beam, '>': where the drives exhaust. */
  rows: string[];
  axis: number;
  length: number;
}

const pick = (rng: Rng, r: Range): number => rng.int(r[0], r[1]);

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

export function drawSilhouette(rng: Rng, p: Profile): Silhouette {
  const secs = p.sections.map((s) => ({ len: pick(rng, s.len), half: pick(rng, s.half) }));
  const H0 = (secs[0] as { half: number }).half;
  const outer: number[] = [];
  // Bow: a nose from its flat front out to the first section, or a command pod and a 2:1 taper into the body.
  if (p.pod) {
    const len = pick(rng, p.pod.len), half = pick(rng, p.pod.half);
    for (let i = 0; i < len; i++) outer.push(half);
    for (let h = half + 1; h <= H0; h++) outer.push(h, h);
  } else if (p.nose) {
    const len = pick(rng, p.nose.len), front = pick(rng, p.nose.front);
    for (let i = 0; i < len; i++) outer.push(Math.min(H0, noseHalf(p.nose.style, i, len, front, H0)));
  }
  const bodyStart = outer.length;
  let prev = H0;
  for (const s of secs) {
    const start = outer.length;
    for (let h = prev; h !== s.half; h += s.half > prev ? 1 : -1) outer.push(h + (s.half > prev ? 1 : 0), h + (s.half > prev ? 1 : 0));
    while (outer.length - start < s.len) outer.push(s.half);
    prev = s.half;
  }
  const st = p.stern, sLen = pick(rng, st.len), sOut = pick(rng, st.out), rate = st.rate ?? 2;
  // Flare and tail reshape the last stretch of the body itself.
  if (st.kind === 'flare' || st.kind === 'tail') {
    const L0 = outer.length;
    for (let i = 0; i < sLen; i++) {
      const x = L0 - sLen + i;
      const d = Math.min(sOut, Math.floor(i / rate) + 1);
      outer[x] = (outer[x] as number) + (st.kind === 'flare' ? d : -d);
    }
  }
  const L = outer.length;
  const inner = Array<number>(L).fill(-1);
  if (p.split) {
    const x0 = bodyStart + Math.floor(((L - bodyStart) * pick(rng, [Math.round(p.split.at[0] * 100), Math.round(p.split.at[1] * 100)])) / 100);
    const lane = pick(rng, p.split.lane);
    for (let x = x0; x < L; x++) inner[x] = Math.min(lane, Math.floor((x - x0) / 2));
  }
  const maxHalf = Math.max(...outer) + 12;
  const axis = maxHalf;
  const grid = Array.from({ length: 2 * maxHalf + 1 }, () => Array<string>(L + 12).fill('.'));
  const put = (x: number, y: number, c = '#'): void => { const row = grid[axis + y]; if (row && x >= 0 && x < row.length && (c === '#' || row[x] === '.')) row[x] = c; };
  const cut = (x: number, y: number): void => { const row = grid[axis + y]; if (row && x >= 0 && x < row.length) row[x] = '.'; };
  const both = (x: number, y: number, c = '#'): void => { put(x, y, c); put(x, -y, c); };
  for (let x = 0; x < L; x++) for (let y = 0; y <= (outer[x] as number); y++) if (y > (inner[x] as number)) both(x, y);
  // Mounts, along the body.
  const at = (span: Range, n: number, len: number, i: number): number => {
    const a = bodyStart + Math.floor(span[0] * (L - bodyStart)), b = bodyStart + Math.floor(span[1] * (L - bodyStart)) - len;
    return n === 1 ? Math.floor((a + b) / 2) : Math.round(a + ((b - a) * i) / (n - 1));
  };
  for (const m of p.mounts ?? []) {
    const n = pick(rng, m.count), len = pick(rng, m.len);
    for (let i = 0; i < n; i++) {
      const x0 = at(m.span, n, len, i);
      const side = Math.min(...outer.slice(x0, x0 + len));
      if (m.kind === 'wing') {
        const reach = pick(rng, m.reach), rake = m.rake ?? 2;
        for (let x = x0; x < x0 + len; x++) {
          const k = x - x0;
          let r = Math.min(reach, Math.floor(k / rake) + 1);
          if (m.cut && k >= len - 2) r = Math.max(1, r - (k - (len - 3)));
          for (let d = 1; d <= r; d++) both(x, side + d);
        }
      } else {
        const depth = pick(rng, m.depth);
        for (let x = x0; x < x0 + len; x++) for (let d = 0; d < depth; d++) { cut(x, side - d); cut(x, -(side - d)); }
      }
    }
  }
  // Swept wings at the rear: the leading edge raked 2:1, the trailing edge at the stern.
  if (p.rearWings) {
    const len = pick(rng, p.rearWings.len), reach = pick(rng, p.rearWings.reach);
    for (let x = L - len; x < L; x++) {
      const r = Math.min(reach, Math.floor((x - (L - len)) / 2) + 1);
      for (let d = 1; d <= r; d++) both(x, (outer[x] as number) + d);
    }
  }
  // Quarter flares and pylon pods stand past the stern's sides.
  const half = outer[L - 1] as number;
  if (st.kind === 'quarters') {
    for (let x = L - sLen; x < L + 2; x++) {
      const r = Math.min(sOut, Math.floor((x - (L - sLen)) / 2) + 1);
      for (let y = half - 3; y <= half + r; y++) both(x, y);
    }
  }
  if (st.kind === 'pylons') {
    const pod = 3, gap = 2, y0 = half + gap + 1;
    for (let x = L - sLen; x < L + 2; x++) {
      const t = Math.min(pod - 1, Math.floor((x - (L - sLen)) / 2) + 1);
      for (let y = y0 + (pod - 1 - t); y < y0 + pod; y++) both(x, y);
    }
    for (const bx of [L - sLen + 3, L - 4]) for (let x = bx; x < bx + 2; x++) for (let y = half + 1; y < y0; y++) both(x, y, '=');
  }
  // Where the drives exhaust: past the hull's last tile on every row that reaches the stern.
  for (const row of grid) {
    const last = row.lastIndexOf('#');
    if (last >= L - 2) row[last + 1] = '>';
  }
  const used = grid.map((r) => r.join(''));
  const ys = used.flatMap((r, y) => (/[#=]/.test(r) ? [y] : []));
  const y0 = Math.min(...ys), y1 = Math.max(...ys);
  const w = Math.max(...used.map((r) => r.search(/>?$/) >= 0 ? Math.max(r.lastIndexOf('#'), r.lastIndexOf('>')) : -1)) + 1;
  return { rows: used.slice(y0, y1 + 1).map((r) => r.slice(0, w)), axis: axis - y0, length: w };
}
