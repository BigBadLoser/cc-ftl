/**
 * Station bench: rim protrusions against the hull circle. The hull circle is fitted robustly: Rc = median over 48 angle
 * bins of the outermost non-space tile's distance from the template centre, airlock footprints excluded (docks stick out
 * by design). A room (not role dock) tile protrudes when it lies farther than Rc + MARGIN. A room glued to the rim spans
 * several bins, so it is a plateau that a per-bin hull would follow; the median ignores it. Share = protruding tiles /
 * room-floor tiles.
 */
const BINS = 48, MARGIN = 2;

export function protrusionShare(W: number, H: number, rows: readonly string[], skip: Set<number>, room: number[]): number {
  const cx = W / 2, cy = H / 2;
  const binOf = (i: number): number => Math.floor(((Math.atan2(Math.floor(i / W) + 0.5 - cy, (i % W) + 0.5 - cx) + Math.PI) / (2 * Math.PI)) * BINS) % BINS;
  const dist = (i: number): number => Math.hypot((i % W) + 0.5 - cx, Math.floor(i / W) + 0.5 - cy);
  const outer = new Array<number>(BINS).fill(0);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if ((rows[y]?.[x] ?? '.') === '.' || skip.has(i)) continue;
    const b = binOf(i);
    outer[b] = Math.max(outer[b] as number, dist(i));
  }
  const med = (xs: number[]): number => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;
  const Rc = med(outer);
  const hit = room.filter((i) => dist(i) > Rc + MARGIN).length;
  return room.length ? hit / room.length : 0;
}

export interface Outline { spread: number; roughness: number; offenders: Record<string, number> }

/**
 * Outline of the station from the per-bin outer radius (48 bins around the template centre): the outermost non-space tile
 * per bin, airlock footprints and dock-role rooms excluded. A round hull is flat; rooms glued to the rim define a ragged
 * one.
 *   spread = (p90 - p10) / median of the bin radii;
 *   roughness = mean |r[i] - r[i+1]| over adjacent bins, circular, in tiles;
 *   offenders = role of the room owning the outermost tile (a wall tile belongs to the nearest floor tile within 3 tiles, inward ray first) in bins
 *   more than 1.5 tiles above the median, counted per role.
 */
export function outlineStats(W: number, H: number, rows: readonly string[], skip: Set<number>, roleAt: (i: number) => string | undefined): Outline {
  const cx = W / 2, cy = H / 2;
  const outer = new Array<number>(BINS).fill(0);
  const owner = new Array<string>(BINS).fill('');
  const isFloor = (x: number, y: number): boolean => { const f = rows[y]?.[x] ?? '.'; return f === '_' || f === 'D'; };
  /** A wall tile belongs to the nearest floor tile within 3 tiles: along the inward ray first, then any direction. */
  const own = (x: number, y: number): string | undefined => {
    if (isFloor(x, y)) return roleAt(y * W + x);
    const dx = cx - (x + 0.5), dy = cy - (y + 0.5), len = Math.hypot(dx, dy) || 1;
    for (let k = 1; k <= 3; k++) {
      const [fx, fy] = [Math.floor(x + 0.5 + (dx / len) * k), Math.floor(y + 0.5 + (dy / len) * k)];
      if (isFloor(fx, fy)) return roleAt(fy * W + fx);
    }
    let best: string | undefined, bd = Infinity;
    for (let oy = -3; oy <= 3; oy++) for (let ox = -3; ox <= 3; ox++) {
      const d = Math.hypot(ox, oy);
      if (d <= 3 && d < bd && isFloor(x + ox, y + oy)) { bd = d; best = roleAt((y + oy) * W + x + ox); }
    }
    return best;
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if ((rows[y]?.[x] ?? '.') === '.' || skip.has(i)) continue;
    const b = binOf(i);
    outer[b] = Math.max(outer[b] as number, dist(i));
  }
  const med = (xs: number[]): number => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;
  const Rc = med(outer);
  const hit = room.filter((i) => dist(i) > Rc + MARGIN).length;
  return room.length ? hit / room.length : 0;
}

export interface Outline { spread: number; roughness: number; offenders: Record<string, number> }

/**
 * Outline of the station from the per-bin outer radius (48 bins around the template centre): the outermost non-space tile
 * per bin, airlock footprints and dock-role rooms excluded. A round hull is flat; rooms glued to the rim define a ragged
 * one.
 *   spread = (p90 - p10) / median of the bin radii;
 *   roughness = mean |r[i] - r[i+1]| over adjacent bins, circular, in tiles;
 *   offenders = role of the room owning the outermost tile (a wall tile belongs to the nearest floor tile within 3 tiles, inward ray first) in bins
 *   more than 1.5 tiles above the median, counted per role.
 */
export function outlineStats(W: number, H: number, rows: readonly string[], skip: Set<number>, roleAt: (i: number) => string | undefined): Outline {
  const cx = W / 2, cy = H / 2;
  const outer = new Array<number>(BINS).fill(0);
  const owner = new Array<string>(BINS).fill('');
  const own = (x: number, y: number): string | undefined => {
    const c = rows[y]?.[x] ?? '.';
    if (c === '_' || c === 'D') return roleAt(y * W + x);
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const) {
      const f = rows[ny]?.[nx] ?? '.';
      if (f === '_' || f === 'D') return roleAt(ny * W + nx);
    }
    return undefined;
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if ((rows[y]?.[x] ?? '.') === '.' || skip.has(i)) continue;
    const role = own(x, y);
    if (role === 'dock') continue;
    const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
    const b = Math.floor(((Math.atan2(y + 0.5 - cy, x + 0.5 - cx) + Math.PI) / (2 * Math.PI)) * BINS) % BINS;
    if (d > (outer[b] as number)) { outer[b] = d; owner[b] = role ?? 'wall'; }
  }
  const used = outer.map((v, b) => ({ v, b })).filter((e) => e.v > 0);
  const sorted = used.map((e) => e.v).sort((a, b) => a - b);
  const q = (p: number): number => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] ?? 0;
  const median = q(0.5);
  let rough = 0, pairs = 0;
  for (let b = 0; b < BINS; b++) {
    const [p, n] = [outer[b] as number, outer[(b + 1) % BINS] as number];
    if (p > 0 && n > 0) { rough += Math.abs(p - n); pairs++; }
  }
  const offenders: Record<string, number> = {};
  for (const e of used) if (e.v > median + 1.5) offenders[owner[e.b] as string] = (offenders[owner[e.b] as string] ?? 0) + 1;
  return { spread: median ? (q(0.9) - q(0.1)) / median : 0, roughness: pairs ? rough / pairs : 0, offenders };
}
