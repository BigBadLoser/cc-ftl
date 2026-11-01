/**
 * The station v2 tile grid (docs/STATIONGEN2.md section 3.3): a square of tiles round the station's centre, each tile
 * of one kind (outside, deliberate open space, solid, public circulation, court, free parcel floor, room) and an owner
 * id. Coordinates are relative to the centre tile (0, 0); north is -y.
 */

export const K = {
  /** Outside the hull. */
  Space: 0,
  /** Open space inside the silhouette, left on purpose (a wheel's quarters, an open sector). */
  Open: 1,
  /** Solid structure (a wall the template draws: a corridor's wall across open space). */
  Solid: 2,
  /** Public circulation (rings, spokes, streets, the hub). */
  Hall: 3,
  /** A court (rotunda, sector plaza): open floor, a planned room. */
  Court: 4,
  /** Parcel floor not yet given to a room (id: region). */
  Free: 5,
  /** A room's tile (id: room). */
  Room: 6,
} as const;
export type K = (typeof K)[keyof typeof K];

export const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
export const DIRS8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]] as const;

export class Grid {
  readonly S: number;
  readonly o: number;
  readonly kind: Uint8Array;
  readonly id: Int32Array;
  /** Public floor, kept when its tiles become rooms: 1 circulation, 2 a court. */
  readonly pub: Uint8Array;

  constructor(half: number) {
    this.o = half;
    this.S = 2 * half + 1;
    this.kind = new Uint8Array(this.S * this.S);
    this.id = new Int32Array(this.S * this.S).fill(-1);
    this.pub = new Uint8Array(this.S * this.S);
  }

  /** Tile index of (x, y), -1 off the grid. */
  idx(x: number, y: number): number {
    const gx = x + this.o, gy = y + this.o;
    return gx < 0 || gy < 0 || gx >= this.S || gy >= this.S ? -1 : gy * this.S + gx;
  }

  x(i: number): number { return (i % this.S) - this.o; }
  y(i: number): number { return Math.floor(i / this.S) - this.o; }
  /** Distance of a tile's centre from the station's centre. */
  r(i: number): number { return Math.hypot(this.x(i), this.y(i)); }
  /** Angle of a tile about the centre, 0 east, growing clockwise on screen (north is -pi/2). */
  a(i: number): number { return Math.atan2(this.y(i), this.x(i)); }

  k(x: number, y: number): K {
    const i = this.idx(x, y);
    return i < 0 ? K.Space : (this.kind[i] as K);
  }

  set(i: number, k: K, id = -1): void {
    this.kind[i] = k;
    this.id[i] = id;
  }

  /** Every tile index whose kind passes `p`. */
  tiles(p: (k: K, i: number) => boolean): number[] {
    const out: number[] = [];
    for (let i = 0; i < this.kind.length; i++) if (p(this.kind[i] as K, i)) out.push(i);
    return out;
  }

  /** Neighbour indices (4 or 8), on the grid only. */
  nb(i: number, dirs: readonly (readonly [number, number])[] = DIRS4): number[] {
    const x = this.x(i), y = this.y(i);
    const out: number[] = [];
    for (const [dx, dy] of dirs) {
      const j = this.idx(x + dx, y + dy);
      if (j >= 0) out.push(j);
    }
    return out;
  }

  /** Connected components (4-connected) of the tiles in `set`. */
  components(set: readonly number[]): number[][] {
    const mine = new Set(set);
    const seen = new Set<number>();
    const out: number[][] = [];
    for (const s of set) {
      if (seen.has(s)) continue;
      const comp: number[] = [];
      const stack = [s];
      seen.add(s);
      while (stack.length > 0) {
        const j = stack.pop() as number;
        comp.push(j);
        for (const n of this.nb(j)) if (mine.has(n) && !seen.has(n)) { seen.add(n); stack.push(n); }
      }
      out.push(comp);
    }
    return out;
  }
}

/** An axis-aligned rectangle of tiles (x, y: top-left, relative to the centre). */
export interface TileRect { x: number; y: number; w: number; h: number }

/**
 * Every top-left position where a w x h rectangle lies wholly inside `mask` (a tile set), by a summed-area table over
 * the mask's bounding box.
 */
export function rectSpots(g: Grid, mask: ReadonlySet<number>, w: number, h: number): TileRect[] {
  if (mask.size < w * h) return [];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const i of mask) { const x = g.x(i), y = g.y(i); x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const W = x1 - x0 + 2, H = y1 - y0 + 2;
  const sum = new Int32Array(W * H);
  for (let y = 1; y < H; y++) {
    for (let x = 1; x < W; x++) {
      const v = mask.has(g.idx(x0 + x - 1, y0 + y - 1)) ? 1 : 0;
      sum[y * W + x] = v + (sum[(y - 1) * W + x] as number) + (sum[y * W + x - 1] as number) - (sum[(y - 1) * W + x - 1] as number);
    }
  }
  const out: TileRect[] = [];
  for (let y = 0; y + h < H; y++) {
    for (let x = 0; x + w < W; x++) {
      const s = (sum[(y + h) * W + x + w] as number) - (sum[y * W + x + w] as number) - (sum[(y + h) * W + x] as number) + (sum[y * W + x] as number);
      if (s === w * h) out.push({ x: x0 + x, y: y0 + y, w, h });
    }
  }
  return out;
}

/** The tile indices of a rectangle. */
export function rectTiles(g: Grid, r: TileRect): number[] {
  const out: number[] = [];
  for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) out.push(g.idx(x, y));
  return out;
}

/** Wrap an angle into [-pi, pi). */
export const wrap = (a: number): number => {
  let v = (a + Math.PI) % (2 * Math.PI);
  if (v < 0) v += 2 * Math.PI;
  return v - Math.PI;
};
