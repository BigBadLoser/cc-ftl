import type { Builder } from './builder';
import type { RoomSpec } from './plan';
import type { AccessKind, AsmRecord, CompDebug, JoinKind, JoinRecord, PortRecord, RoomRole } from './types';

/**
 * The generic 2D arranger. Assemblies are BLOCKS: a local tile drawing (walls, doors, one private char per room) with
 * typed PORTS on its outline. The arranger places blocks anywhere on a 2D plane by joining a free port of a placed
 * block to a free port of a new one (opposite sides, shared wall line, overlapping segments), and checks feasibility
 * before anything is final: no floor overlap, walls only on walls, and engine faces (rays east of an engine) kept
 * clear by everything placed before or after. Any faction composes ships from it; the grammar decides what attaches
 * where, the arranger decides whether and how it fits.
 */

export type Side = 'n' | 's' | 'e' | 'w';
const OPP: Record<Side, Side> = { n: 's', s: 'n', e: 'w', w: 'e' };

/** A port: a stretch of the block's outline wall. Side n/s: row y, columns x..x+len-1; e/w: column x, rows y..y+len-1. */
export interface BlockPort {
  id: string;
  side: Side;
  x: number;
  y: number;
  len: number;
  access: AccessKind;
  /** Reusable for several attachments (crawl and truss sides that carry many pods). */
  multi?: boolean;
}

export interface Block {
  kind: string;
  label: string;
  access: AccessKind;
  rows: string[];
  /** Room chars to their role and contents. */
  legend: Map<string, { role: RoomRole; spec?: RoomSpec }>;
  ports: BlockPort[];
  /** Engine faces: column x (the hull wall), rows y0..y1; nothing may ever stand east of them. */
  faceE: { x: number; y0: number; y1: number }[];
  /** Where the block's row 0 / column 0 sat in the frame it was drawn in (its own axis rows -1 / 0). */
  origin: { x: number; y: number };
  /** Space cells that must stay open (outside gun mounts and airlocks), so later blocks never bury them. */
  exposed: { x: number; y: number }[];
  /** Where the block was built (salvage donors: navy, civil, drone, mining; 'scrap' for improvised parts). */
  donor?: string;
}

interface Placed {
  block: Block;
  x: number;
  y: number;
  used: Set<string>;
}

export interface AttachOpts {
  /** Parent port side (and optional port id). */
  side: Side;
  parentPort?: string;
  childPort?: string;
  /** Preferred position along the shared wall: aligned at the start, centred, at the end, or anywhere (seeded). */
  align?: 'start' | 'mid' | 'end' | 'any';
  /** Extra shift of the child along the wall (positive = +x / +y). */
  shift?: number;
  kind?: JoinKind;
  /** Open at most this many door tiles on the join. */
  doors?: number;
}

const key = (x: number, y: number): number => (y + 4096) * 8192 + (x + 4096);
const isFloor = (c: string | undefined): boolean => c !== undefined && c !== '#' && c !== 'D' && c !== '.' && c !== '=';

/** A port id with its north/south marker swapped ('hn' <-> 'hs', 'rn0' <-> 'rs0'); ids track their sides. */
export const flipId = (id: string): string => id.replace(/[ns]/, (m) => (m === 'n' ? 's' : 'n'));

/** Block flipped top to bottom (mirror about the ship's long axis). */
export function mirrorBlock(b: Block): Block {
  const h = b.rows.length;
  const flip = (s: Side): Side => (s === 'n' ? 's' : s === 's' ? 'n' : s);
  return {
    ...b,
    rows: [...b.rows].reverse(),
    exposed: b.exposed.map((e) => ({ x: e.x, y: h - 1 - e.y })),
    ports: b.ports.map((p) => ({ ...p, id: p.side === 'n' || p.side === 's' ? flipId(p.id) : p.id, side: flip(p.side), y: p.side === 'e' || p.side === 'w' ? h - p.y - p.len : h - 1 - p.y })),
    faceE: b.faceE.map((f) => ({ x: f.x, y0: h - 1 - f.y1, y1: h - 1 - f.y0 })),
  };
}

/**
 * Block flipped east to west. Only for blocks without engine faces (engines always face +x); callers keep
 * directional pieces (bows, drives) as built.
 */
export function mirrorX(b: Block): Block {
  if (b.faceE.length > 0) return b;
  const W = Math.max(...b.rows.map((r) => r.length));
  const flip = (s: Side): Side => (s === 'e' ? 'w' : s === 'w' ? 'e' : s);
  return {
    ...b,
    rows: b.rows.map((r) => [...r.padEnd(W, '.')].reverse().join('')),
    exposed: b.exposed.map((e) => ({ x: W - 1 - e.x, y: e.y })),
    ports: b.ports.map((p) => ({ ...p, side: flip(p.side), x: p.side === 'n' || p.side === 's' ? W - p.x - p.len : W - 1 - p.x })),
  };
}

const unkey = (k: number): { x: number; y: number } => ({ x: (k % 8192) - 4096, y: Math.floor(k / 8192) - 4096 });

export class Arranger {
  private readonly occ = new Map<number, string>();
  readonly placed: Placed[] = [];
  readonly joins: JoinRecord[] = [];
  readonly ports: PortRecord[] = [];
  private readonly rays: { x: number; y0: number; y1: number }[] = [];
  private readonly open = new Set<number>();
  private readonly doorTiles: { x: number; y: number }[] = [];
  private readonly history: { parent: number; port: string }[] = [];

  constructor(readonly rand: () => number, readonly axis2 = 0) {}

  private at(x: number, y: number): string | undefined {
    return this.occ.get(key(x, y));
  }

  /** Feasibility of a block at (X, Y): floor on empty tiles only, walls on empty or walls, engine faces clear. */
  canPlace(b: Block, X: number, Y: number): boolean {
    for (let j = 0; j < b.rows.length; j++) {
      const row = b.rows[j] as string;
      for (let i = 0; i < row.length; i++) {
        const c = row[i] as string;
        if (c === '.') continue;
        const x = X + i;
        const y = Y + j;
        const e = this.at(x, y);
        if (e !== undefined && (isFloor(c) || isFloor(e))) return false;
        for (const r of this.rays) if (x > r.x && y >= r.y0 && y <= r.y1) return false;
        if (this.open.has(key(x, y))) return false;
      }
    }
    for (const e of b.exposed) if (this.occ.has(key(X + e.x, Y + e.y))) return false;
    for (const f of b.faceE) {
      for (const [k, c] of this.occ) {
        if (c === undefined) continue;
        const x = (k % 8192) - 4096;
        const y = Math.floor(k / 8192) - 4096;
        if (x > X + f.x && y >= Y + f.y0 && y <= Y + f.y1) return false;
      }
    }
    return true;
  }

  /** Place a root block with its own axis on the ship's axis. */
  placeRoot(b: Block, x = 0): number {
    return this.place(b, b.origin.x + x, b.origin.y);
  }

  place(b: Block, X: number, Y: number): number {
    for (let j = 0; j < b.rows.length; j++) {
      const row = b.rows[j] as string;
      for (let i = 0; i < row.length; i++) {
        const c = row[i] as string;
        if (c === '.') continue;
        const k = key(X + i, Y + j);
        const cur = this.occ.get(k);
        if (!isFloor(cur) && cur !== 'D' && !(c === '=' && cur === '#')) this.occ.set(k, c === 'D' ? 'D' : isFloor(c) ? c : c === '=' ? '=' : '#');
      }
    }
    for (const f of b.faceE) this.rays.push({ x: X + f.x, y0: Y + f.y0, y1: Y + f.y1 });
    for (const e of b.exposed) this.open.add(key(X + e.x, Y + e.y));
    this.placed.push({ block: b, x: X, y: Y, used: new Set() });
    return this.placed.length - 1;
  }

  /** Candidate placements of `child` against `parent` through one port pair, best first. */
  private candidates(parent: number, child: Block, o: AttachOpts): { X: number; Y: number; pp: BlockPort; cp: BlockPort; tiles: { x: number; y: number }[] }[] {
    const P = this.placed[parent] as Placed;
    const out: { X: number; Y: number; pp: BlockPort; cp: BlockPort; tiles: { x: number; y: number }[]; score: number }[] = [];
    const pports = P.block.ports.filter((p) => p.side === o.side && !P.used.has(p.id) && (!o.parentPort || p.id === o.parentPort));
    const cports = child.ports.filter((p) => p.side === OPP[o.side] && (!o.childPort || p.id === o.childPort));
    const horiz = o.side === 'n' || o.side === 's';
    for (const pp of pports) {
      for (const cp of cports) {
        // Walls coincide on the port line; slide along it while the segments overlap.
        const wx = P.x + pp.x;
        const wy = P.y + pp.y;
        const lo = -(cp.len - 1);
        const hi = pp.len - 1;
        for (let d = lo; d <= hi; d++) {
          const X = horiz ? wx + d - cp.x + (o.shift ?? 0) : wx - cp.x;
          const Y = horiz ? wy - cp.y : wy + d - cp.y + (o.shift ?? 0);
          const tiles = this.sharedOpenings(P, pp, child, cp, X, Y);
          if (tiles.length === 0 && o.doors !== 0) continue;
          const t = (d - lo) / Math.max(1, hi - lo);
          const pref = o.align === 'start' ? -t : o.align === 'end' ? t : o.align === 'mid' || !o.align ? -Math.abs(t - 0.5) : this.rand();
          out.push({ X, Y, pp, cp, tiles, score: pref });
        }
      }
    }
    return out.sort((a, b) => b.score - a.score);
  }

  /** Tiles on the shared wall where floor lies on both sides (door candidates), given the child at (X, Y). */
  private sharedOpenings(P: Placed, pp: BlockPort, child: Block, cp: BlockPort, X: number, Y: number): { x: number; y: number }[] {
    const out: { x: number; y: number }[] = [];
    const horiz = pp.side === 'n' || pp.side === 's';
    const inP = pp.side === 'n' ? [0, 1] : pp.side === 's' ? [0, -1] : pp.side === 'e' ? [-1, 0] : [1, 0];
    for (let i = 0; i < pp.len; i++) {
      const x = P.x + pp.x + (horiz ? i : 0);
      const y = P.y + pp.y + (horiz ? 0 : i);
      const ci = horiz ? x - X - cp.x : y - Y - cp.y;
      if (ci < 0 || ci >= cp.len) continue;
      const pin = this.at(x + (inP[0] as number), y + (inP[1] as number));
      const cin = child.rows[y - Y - (inP[1] as number)]?.[x - X - (inP[0] as number)];
      if (isFloor(pin) && isFloor(cin)) out.push({ x, y });
    }
    return out;
  }

  /** Join `child` to placed block `parent` through a port pair; null when no feasible placement exists. */
  attach(parent: number, child: Block, o: AttachOpts): number | null {
    for (const c of this.candidates(parent, child, o)) {
      if (!this.canPlace(child, c.X, c.Y)) continue;
      return this.commit(parent, child, c, o);
    }
    return null;
  }

  /**
   * Attach `child`, and the mirror image of `partner` (same outline, its own contents; default the child itself) to the
   * mirror parent at the mirrored position: both or neither.
   */
  attachMirrored(parent: number, mparent: number, child: Block, o: AttachOpts, partner: Block = child): [number, number] | null {
    const mchild = mirrorBlock(partner);
    const mside: Side = o.side === 'n' ? 's' : o.side === 's' ? 'n' : o.side;
    const vertical = o.side === 'n' || o.side === 's';
    const mo: AttachOpts = {
      ...o, side: mside,
      ...(o.parentPort ? { parentPort: vertical ? flipId(o.parentPort) : o.parentPort } : {}),
      ...(o.childPort ? { childPort: vertical ? flipId(o.childPort) : o.childPort } : {}),
    };
    for (const c of this.candidates(parent, child, o)) {
      const mY = this.axis2 - (c.Y + child.rows.length - 1);
      if (!this.canPlace(child, c.X, c.Y)) continue;
      const a = this.commit(parent, child, c, o);
      const mc = this.candidates(mparent, mchild, mo).find((m) => m.X === c.X && m.Y === mY);
      if (mc && this.canPlace(mchild, mc.X, mc.Y)) return [a, this.commit(mparent, mchild, mc, mo)];
      this.undo();
    }
    return null;
  }

  private commit(parent: number, child: Block, c: { X: number; Y: number; pp: BlockPort; cp: BlockPort; tiles: { x: number; y: number }[] }, o: AttachOpts): number {
    const id = this.place(child, c.X, c.Y);
    if (!c.pp.multi) (this.placed[parent] as Placed).used.add(c.pp.id);
    this.history.push({ parent, port: c.pp.multi ? '' : c.pp.id });
    if (!c.cp.multi) (this.placed[id] as Placed).used.add(c.cp.id);
    const n = Math.min(o.doors ?? 2, c.tiles.length);
    const mid = Math.floor((c.tiles.length - n) / 2);
    const doors = c.tiles.slice(mid, mid + n);
    this.doorTiles.push(...doors);
    for (const t of doors) this.occ.set(key(t.x, t.y), 'D');
    this.joins.push({ kind: o.kind ?? 'frame', a: parent, b: id, tiles: doors.length > 0 ? doors : this.contact(c.pp, this.placed[parent] as Placed) });
    for (const t of doors) {
      this.ports.push({ asm: parent, x: t.x, y: t.y, dir: c.pp.side, access: c.pp.access, matched: true });
      this.ports.push({ asm: id, x: t.x, y: t.y, dir: c.cp.side, access: c.cp.access, matched: true });
    }
    return id;
  }

  /** The parent-port tiles (for joins without doors: grafts and beams). */
  private contact(pp: BlockPort, P: Placed): { x: number; y: number }[] {
    const horiz = pp.side === 'n' || pp.side === 's';
    return Array.from({ length: Math.min(pp.len, 3) }, (_, i) => ({ x: P.x + pp.x + (horiz ? i : 0), y: P.y + pp.y + (horiz ? 0 : i) }));
  }

  /** Remove the last attached block (and its join), restoring occupancy, rays and the parent's port. */
  private undo(): void {
    const last = this.placed.pop();
    const j = this.joins.pop();
    const h = this.history.pop();
    if (!last) return;
    if (h) this.placed[h.parent]?.used.delete(h.port);
    if (j) {
      this.doorTiles.splice(this.doorTiles.length - j.tiles.length, j.tiles.length);
      this.ports.splice(this.ports.length - 2 * j.tiles.length, 2 * j.tiles.length);
    }
    const keep = [...this.placed];
    this.occ.clear();
    this.rays.length = 0;
    this.open.clear();
    this.placed.length = 0;
    for (const p of keep) { const id = this.place(p.block, p.x, p.y); (this.placed[id] as Placed).used = p.used; }
    for (const t of this.doorTiles) this.occ.set(key(t.x, t.y), 'D');
  }

  /** Engine rays and kept-open cells in world coordinates (to freeze an arrangement into one block). */
  frozen(): { rays: { x: number; y0: number; y1: number }[]; open: { x: number; y: number }[] } {
    return { rays: this.rays.map((r) => ({ ...r })), open: [...this.open].map(unkey) };
  }

  /**
   * Patch plates: space cells in gaps of at most `maxGap` tiles between two hull walls (seams between misaligned
   * blocks) become plating. Kept-open cells and engine rays are never plated. Returns the plated cell count.
   */
  plate(maxGap: number, label = 'patch plates', donor = 'scrap'): number {
    const wall = (x: number, y: number): boolean => this.at(x, y) === '#';
    const free = (x: number, y: number): boolean => this.at(x, y) === undefined && !this.open.has(key(x, y)) && !this.rays.some((r) => x > r.x && y >= r.y0 && y <= r.y1);
    const s = this.stats();
    let x0 = Infinity; let y0 = Infinity;
    for (const k of this.occ.keys()) { const c = unkey(k); x0 = Math.min(x0, c.x); y0 = Math.min(y0, c.y); }
    const cells = new Set<number>();
    for (const [dx, dy] of [[1, 0], [0, 1]] as const) {
      for (let y = y0; y < y0 + s.h; y++) {
        for (let x = x0; x < x0 + s.w; x++) {
          if (!wall(x, y) || this.at(x + dx, y + dy) !== undefined) continue;
          let n = 1;
          while (n <= maxGap && this.at(x + dx * n, y + dy * n) === undefined) n++;
          if (n > maxGap || !wall(x + dx * n, y + dy * n)) continue;
          const run = Array.from({ length: n - 1 }, (_, i) => ({ x: x + dx * (i + 1), y: y + dy * (i + 1) }));
          if (run.every((c) => free(c.x, c.y))) for (const c of run) cells.add(key(c.x, c.y));
        }
      }
    }
    if (cells.size === 0) return 0;
    const pts = [...cells].map(unkey);
    const X = Math.min(...pts.map((p) => p.x));
    const Y = Math.min(...pts.map((p) => p.y));
    const W = Math.max(...pts.map((p) => p.x)) - X + 1;
    const H = Math.max(...pts.map((p) => p.y)) - Y + 1;
    const rows = Array.from({ length: H }, (_, j) => Array.from({ length: W }, (_, i) => (cells.has(key(X + i, Y + j)) ? '#' : '.')).join(''));
    this.place({ kind: 'plate', label: `${donor}: ${label}`, access: 'external', rows, legend: new Map(), ports: [], faceE: [], origin: { x: 0, y: 0 }, exposed: [], donor }, X, Y);
    return cells.size;
  }

  /** Take back the last attachment (a tube that led nowhere). */
  undoLast(): void {
    this.undo();
  }

  /** Free ports of a placed block on a side. */
  free(id: number, side: Side): BlockPort[] {
    const p = this.placed[id] as Placed;
    return p.block.ports.filter((x) => x.side === side && !p.used.has(x.id));
  }

  /** Overall bounds and filled tile count (for proportion scoring). */
  stats(): { w: number; h: number; filled: number } {
    let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
    for (const k of this.occ.keys()) {
      const x = (k % 8192) - 4096;
      const y = Math.floor(k / 8192) - 4096;
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
    return { w: x1 - x0 + 1, h: y1 - y0 + 1, filled: this.occ.size };
  }

  /** World bounds of a placed block. */
  bounds(id: number): { x: number; y: number; w: number; h: number } {
    const p = this.placed[id] as Placed;
    return { x: p.x, y: p.y, w: Math.max(...p.block.rows.map((r) => r.length)), h: p.block.rows.length };
  }

  /** Draw everything into the builder's canvas (rooms keep their roles and specs) and open the join doors. */
  stamp(b: Builder): void {
    this.placed.forEach((p, i) => {
      const k = `blk${i}`;
      b.cv.stamp(p.block.rows, p.x, p.y, k);
      for (const [ch, v] of p.block.legend) {
        b.chunkRoles.set(`${k}:${ch}`, v.role);
        if (v.spec) b.chunkSpecs.set(`${k}:${ch}`, v.spec);
      }
    });
    for (const t of this.doorTiles) b.cv.setDoor(t.x, t.y);
  }

  /** Debug export in the cropped frame. */
  debug(ox: number, oy: number, width: number, height: number, rows: string[], hallAt: (x: number, y: number) => boolean, profile: string): CompDebug {
    const assemblies: AsmRecord[] = this.placed.map((p, id) => {
      const r = this.bounds(id);
      return { id, kind: p.block.kind, label: p.block.label, access: p.block.access, x: r.x - ox, y: r.y - oy, w: r.w, h: r.h, ...(p.block.donor ? { donor: p.block.donor } : {}) };
    });
    const asmOf = new Int16Array(width * height).fill(-1);
    this.placed.forEach((p, id) => {
      p.block.rows.forEach((row, j) => {
        for (let i = 0; i < row.length; i++) {
          if (row[i] === '.') continue;
          const x = p.x + i - ox;
          const y = p.y + j - oy;
          if (x >= 0 && y >= 0 && x < width && y < height && (asmOf[y * width + x] === -1 || isFloor(row[i]))) asmOf[y * width + x] = id;
        }
      });
    });
    const traversal: CompDebug['traversal'] = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const c = rows[y]?.[x];
        if (c === 'D' || (c === '_' && hallAt(x, y))) traversal.push({ x, y, access: assemblies[asmOf[y * width + x] ?? -1]?.access ?? 'human' });
      }
    }
    const shift = <T extends { x: number; y: number }>(t: T): T => ({ ...t, x: t.x - ox, y: t.y - oy });
    return { assemblies, asmOf, ports: this.ports.map(shift), joins: this.joins.map((j) => ({ ...j, tiles: j.tiles.map(shift) })), traversal, profile };
  }
}
