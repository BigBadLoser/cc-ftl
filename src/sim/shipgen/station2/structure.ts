import { DIRS8, Grid, K, wrap } from './grid';
import { blockOrigin, type CoreBlock } from './core';
import { DIR_V, type Template } from './template';

/**
 * Rasterise a template at hull radius R (docs/STATIONGEN2.md section 3.3): the hull disc with flat harbour faces, the
 * public circulation (rings, spokes, streets, the centre), courts and open space. What is left inside the hull falls
 * into regions (connected parcels of free floor) that departments are given. Every tile inside the hull is circulation,
 * court, open space, solid, or a region's.
 */

export interface Region {
  id: number;
  tiles: number[];
  /** Touches the hull. */
  hull: boolean;
  /** Tiles beside public circulation or a court. */
  front: number;
  /** Mean radius and the angle of its centroid. */
  r: number;
  a: number;
  /** The band it lies in (0 the outer band). */
  band: number;
}

export interface Face {
  dir: 0 | 2 | 4 | 6;
  /** The hull row's distance from the centre along the face's direction. */
  line: number;
  /** Half the dock bank's width (tiles either side of the axis). */
  half: number;
  docks: number;
}

export interface Structure {
  g: Grid;
  t: Template;
  R: number;
  /** Each ring's outer and inner floor radius. */
  ringR: { ro: number; ri: number }[];
  faces: Face[];
  regions: Region[];
  /** Tiles left open on purpose (inside the silhouette). */
  open: number[];
}

/** Floor width of a harbour's dock bank: four tiles a dock (three and a dividing wall) plus the end wall. */
export const bankWidth = (docks: number): number => docks * 4 + 1;

/** True if angle `a` lies on the arc from a0 clockwise over span. */
export const onArc = (a: number, a0: number, span: number): boolean => {
  const d = wrap(a - a0);
  return (d < 0 ? d + 2 * Math.PI : d) <= span + 1e-9;
};

/** A core block's floor on the grid: its rooms, corridor (with its end walls) and post; floor no room needs is left out. */
export function blockSet(g: Grid, b: CoreBlock): Set<number> {
  const [x0, y0] = blockOrigin(b);
  const out = new Set<number>();
  const c = b.corridor;
  for (const r of [...b.rects, b.post, { x: c.x - 1, y: c.y, w: c.w + 2, h: c.h }]) {
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) out.add(g.idx(x0 + x, y0 + y));
  }
  return out;
}

export function rasterise(t: Template, R: number): Structure | string {
  const g = new Grid(R + 3);
  const n = g.kind.length;
  const faces: Face[] = t.harbours.map((h) => {
    const half = Math.ceil(bankWidth(h.docks) / 2);
    return { dir: h.dir, line: Math.floor(Math.sqrt((R + 0.5) ** 2 - (half + 1) ** 2)), half, docks: h.docks };
  });
  const along = (i: number, dir: number): number => {
    const [dx, dy] = DIR_V[dir] as [number, number];
    return g.x(i) * dx + g.y(i) * dy;
  };
  for (let i = 0; i < n; i++) {
    const inside = g.r(i) <= R + 0.5 && faces.every((f) => along(i, f.dir) <= f.line);
    g.set(i, inside ? K.Free : K.Space);
  }
  // Rings, from the hull inward.
  const ringR: { ro: number; ri: number }[] = [];
  let edge = R + 0.5;
  t.rings.forEach((ring, k) => {
    const ro = edge - (t.bands[k] as number);
    ringR.push({ ro, ri: ro - ring.w });
    edge = ro - ring.w;
  });
  const innerEdge = edge - (t.kind === 'wheel' ? (t.bands[t.rings.length] as number) : 0);
  const free = (i: number): boolean => g.kind[i] === K.Free;
  // A core block: the inner ring runs round its floor (rooms, corridor, post), two tiles wide.
  const core = t.block ? blockSet(g, t.block) : null;
  if (core && t.block) {
    const half = Math.min(t.block.w, t.block.h) / 2;
    ringR[1] = { ro: half + 2, ri: half };
  }
  // Open sectors: the innermost zone (wheel: inside the rim's inner band).
  const lastRi = (ringR[ringR.length - 1] as { ri: number }).ri;
  for (let i = 0; i < n; i++) {
    if (!free(i) || g.r(i) > (t.kind === 'wheel' ? innerEdge : lastRi)) continue;
    if (t.open.some(([a0, span]) => onArc(g.a(i), a0, span))) g.set(i, K.Open);
  }
  t.rings.forEach((ring, k) => {
    const { ro, ri } = ringR[k] as { ro: number; ri: number };
    if (core && k === 1) {
      for (let i = 0; i < n; i++) {
        if (g.kind[i] === K.Space || core.has(i)) continue;
        const x = g.x(i), y = g.y(i);
        let near = false;
        for (let dy = -2; dy <= 2 && !near; dy++) for (let dx = -2; dx <= 2 && !near; dx++) near = core.has(g.idx(x + dx, y + dy));
        if (near) g.set(i, K.Hall);
      }
      return;
    }
    for (let i = 0; i < n; i++) {
      const r = g.r(i);
      if (g.kind[i] === K.Space || r > ro || r <= ri) continue;
      if (ring.arc && !onArc(g.a(i), ring.arc.a0, ring.arc.span)) continue;
      if (ring.gaps?.some(([a, sp]) => Math.abs(wrap(g.a(i) - a)) <= sp / 2)) continue;
      g.set(i, K.Hall);
    }
  });
  // Annular centre: a court ring round a small hub (the spokes cross it).
  if (t.centre === 'annular') for (let i = 0; i < n; i++) if (g.r(i) <= t.rc + 0.5) g.set(i, K.Court);
  for (const s of t.spokes) {
    const [dx, dy] = DIR_V[s.dir] as [number, number];
    const ro = (ringR[s.reach] as { ro: number }).ro;
    const r0 = s.from < 0 ? 0 : (ringR[s.from] as { ri: number }).ri;
    for (let i = 0; i < n; i++) {
      if (g.kind[i] === K.Space || g.r(i) > ro || g.r(i) < r0 || core?.has(i)) continue;
      const x = g.x(i), y = g.y(i);
      if (x * dx + y * dy < 0) continue;
      const cross = dx !== 0 && dy !== 0 ? x * dy - y * dx : dx === 0 ? x : y;
      if (Math.abs(cross) <= s.hw) g.set(i, K.Hall);
    }
  }
  for (const c of t.chords) {
    const ro = (ringR[c.reach] as { ro: number }).ro;
    for (let i = 0; i < n; i++) {
      if (g.kind[i] === K.Space || g.r(i) > ro) continue;
      if (Math.abs((c.horiz ? g.y(i) : g.x(i)) - c.off) <= c.hw) g.set(i, K.Hall);
    }
  }
  for (let i = 0; i < n; i++) {
    const r = g.r(i);
    if (t.centre === 'rotunda' && r <= t.rc + 0.5) g.set(i, K.Court);
    else if ((t.centre === 'hub' || t.centre === 'annular') && r <= (t.centre === 'annular' ? 2.5 : t.rc + 0.5)) g.set(i, K.Hall);
  }
  // Corridors across open space get walls of their own.
  for (let i = 0; i < n; i++) {
    if (g.kind[i] !== K.Open) continue;
    if (g.nb(i, DIRS8).some((j) => g.kind[j] === K.Hall || g.kind[j] === K.Court)) g.set(i, K.Solid);
  }
  for (let i = 0; i < n; i++) g.pub[i] = g.kind[i] === K.Hall ? 1 : g.kind[i] === K.Court ? 2 : 0;
  // The public network (halls and courts) must be one piece.
  const pub = g.tiles((k) => k === K.Hall || k === K.Court);
  if (g.components(pub).length !== 1) return 'circulation in pieces';
  const regions: Region[] = [];
  const bandOf = (r: number): number => {
    for (let k = 0; k < ringR.length; k++) if (r > (ringR[k] as { ro: number }).ro) return k;
    return ringR.length;
  };
  for (const comp of g.components(g.tiles((k) => k === K.Free))) {
    if (comp.length < 12) { for (const i of comp) g.set(i, K.Solid); continue; }
    const id = regions.length;
    let sx = 0, sy = 0, sr = 0, front = 0, hull = false;
    for (const i of comp) {
      g.id[i] = id;
      sx += g.x(i); sy += g.y(i); sr += g.r(i);
      if (g.nb(i).some((j) => g.kind[j] === K.Hall || g.kind[j] === K.Court)) front++;
      if (!hull && g.nb(i, DIRS8).some((j) => g.kind[j] === K.Space)) hull = true;
    }
    const r = sr / comp.length;
    regions.push({ id, tiles: comp, hull, front, r, a: Math.atan2(sy, sx), band: core?.has(comp[0] as number) ? 2 : bandOf(r) });
  }
  return { g, t, R, ringR, faces, regions, open: g.tiles((k) => k === K.Open) };
}
