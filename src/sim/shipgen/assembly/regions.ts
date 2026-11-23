import type { RoomSpec } from '../plan';
import type { RoomRole } from '../types';
import { addDoors } from './regionDoors';

/**
 * A station floor as owner regions on a tile grid, and the one wall writer that turns them into tiles.
 *
 * Layout code paints which region owns each tile (rooms, halls, solid wall, space) and never draws a wall itself.
 * `compile` then writes every wall by one rule: a tile becomes wall when it touches (8 ways) a region that outranks
 * its own. Space outranks everything, so a room's outer wall is the hull, with no gap and no second layer; halls
 * outrank rooms, so a corridor keeps its painted width; between two rooms the lower rank gives way, one tile thick.
 * Floor never touches space, even diagonally. Doors go on straight wall between a room and a region it may open onto.
 */

export const SPACE = -1;
/** Always wall: a margin that keeps a hall its width where it runs beside open space. */
export const SOLID = -2;
/** Tiles a band room may lack from its extent (where the hull's steps clip it) and still count as a rectangle beside another room. */
const CLIPPED = 4;

export interface Region {
  role: RoomRole;
  /** Halls are open to each other (no wall between two halls). */
  hall: boolean;
  spec?: RoomSpec;
  /** Regions this room may open a door onto (default: any hall). */
  access?: number[];
  doors: number; /** One door at its frontage's bow end, not the middle (fixtures fill the rest). */ doorFirst?: boolean;
  /** Its one door into an airlock's hall at its outer end, clear of the airlock (an offset cockpit's: its helm in line, outboard). */
  doorOut?: boolean;
  /** Doors in a wall running along this axis where it has any (a lane hull's forward rooms: onto the spine). */
  doorAlong?: 'x' | 'y';
  /** Wall rank among rooms: the lower gives way. Defaults to creation order. */
  rank: number;
  /** The department this region belongs to (flow planner), for sheets and the plan class. */
  dept?: string;
}

export interface Shape { x0: number; y0: number; x1: number; y1: number; n: number }

export class RegionGrid {
  readonly size: number;
  readonly own: Int16Array;
  readonly regions: Region[] = [];

  /** Tiles x and y run from -half to half - 1. */
  constructor(readonly half: number) {
    this.size = 2 * half;
    this.own = new Int16Array(this.size * this.size).fill(SPACE);
  }

  private idx(x: number, y: number): number {
    const i = x + this.half, j = y + this.half;
    return i < 0 || j < 0 || i >= this.size || j >= this.size ? -1 : j * this.size + i;
  }

  at(x: number, y: number): number {
    const k = this.idx(x, y);
    return k < 0 ? SPACE : (this.own[k] as number);
  }

  set(x: number, y: number, id: number): void {
    const k = this.idx(x, y);
    if (k < 0) return;
    const was = this.own[k] as number;
    if (was === id) return;
    if (was >= 0) (this.shapes[was] as Shape).n--;
    this.own[k] = id;
    if (id < 0) return;
    const sh = (this.shapes[id] ??= { x0: x, y0: y, x1: x, y1: y, n: 0 });
    sh.n++;
    sh.x0 = Math.min(sh.x0, x); sh.y0 = Math.min(sh.y0, y); sh.x1 = Math.max(sh.x1, x); sh.y1 = Math.max(sh.y1, y);
  }

  /** Each region's painted extent and tile count: a region is a plain rectangle when the two agree. */
  private shapes: Shape[] = [];

  /**
   * The region's extent when it is a plain rectangle (inclusive), else null; with `clipped`, also when it lacks no more
   * tiles than that (a band room whose corner the hull's step takes).
   */
  private boxOf(id: number, clipped = 0): Shape | null {
    const sh = this.shapes[id];
    return sh && sh.n >= (sh.x1 - sh.x0 + 1) * (sh.y1 - sh.y0 + 1) - clipped ? sh : null;
  }

  /**
   * Whether region `b` outranks region `a` where they touch: the one that gives way takes the wall between them. Space
   * outranks everything and halls outrank rooms. Between two rooms side by side (rectangles, or but for a few tiles the
   * hull's steps clip), the one whose shared side runs on past the other's end into open space gives way: it walls that
   * stretch anyway, so its wall runs straight, where the other giving way would leave it a lip of floor beside the
   * other room. When both do (rooms meeting corner to corner, each running on past the other's end), both give way:
   * the one that kept its floor along the overlap would have a one-tile alcove in a side it otherwise walls against
   * space. The wall is then two thick where they overlap, and the assembler takes back an element that builds that, so
   * the join is not made. When neither does, between rectangles the one whose shared side is longer gives way: it walls
   * that side against open space past the other's end anyway, so the wall runs straight and neither room is left with a
   * notch. Otherwise (and on a tie) the lower rank gives way.
   */
  private over(b: number, a: number): boolean {
    const pb = this.prio(b), pa = this.prio(a);
    if (a < 0 || b < 0 || (this.regions[a] as Region).hall || (this.regions[b] as Region).hall) return pb > pa;
    const near = (P: Shape, Q: Shape): [boolean, boolean] => [(P.x1 + 1 === Q.x0 || Q.x1 + 1 === P.x0) && P.y0 <= Q.y1 && Q.y0 <= P.y1, (P.y1 + 1 === Q.y0 || Q.y1 + 1 === P.y0) && P.x0 <= Q.x1 && Q.x0 <= P.x1];
    const Ar = this.boxOf(a, CLIPPED), Br = this.boxOf(b, CLIPPED);
    if (Ar && Br) {
      const [sbs, st] = near(Ar, Br);
      if (sbs || st) {
        const ea = this.bare(Ar, Br, st), eb = this.bare(Br, Ar, st);
        if (ea !== eb || ea) return ea;
      }
    }
    const A = this.boxOf(a), B = this.boxOf(b);
    if (A && B) {
      const [sideBySide, stacked] = near(A, B);
      const la = sideBySide ? A.y1 - A.y0 : stacked ? A.x1 - A.x0 : 0, lb = sideBySide ? B.y1 - B.y0 : stacked ? B.x1 - B.x0 : 0;
      if (la !== lb) return la > lb;
    }
    return pb > pa;
  }

  /**
   * Whether room P's side against Q (stacked: P's row facing Q's; else its column) runs on past Q's end into open
   * space: a tile of it beyond Q, P's own corners aside, with space straight across.
   */
  private bare(P: Shape, Q: Shape, stacked: boolean): boolean {
    const [p0, p1, q0, q1] = stacked ? [P.x0, P.x1, Q.x0, Q.x1] : [P.y0, P.y1, Q.y0, Q.y1];
    const out = stacked ? (P.y1 < Q.y0 ? P.y1 + 1 : P.y0 - 1) : P.x1 < Q.x0 ? P.x1 + 1 : P.x0 - 1;
    for (let t = p0 + 1; t < p1; t++) if ((t < q0 || t > q1) && (stacked ? this.at(t, out) : this.at(out, t)) === SPACE) return true;
    return false;
  }

  room(role: RoomRole, o: { spec?: RoomSpec; access?: number[]; doors?: number; rank?: number; dept?: string; doorFirst?: boolean; doorAlong?: 'x' | 'y' } = {}): number {
    const id = this.regions.length;
    this.regions.push({ role, hall: false, doors: o.doors ?? 1, rank: o.rank ?? id, ...(o.spec ? { spec: o.spec } : {}), ...(o.access ? { access: o.access } : {}), ...(o.doorFirst ? { doorFirst: true } : {}), ...(o.doorAlong ? { doorAlong: o.doorAlong } : {}), ...(o.dept ?? o.spec?.dept ? { dept: o.dept ?? o.spec?.dept } : {}) });
    return id;
  }

  /** Regions of modules that stand apart on open ground, reached suited from outside, not walked to inside (`stranded` leaves them). */
  readonly apart = new Set<number>();
  /** The airlock rooms among them: where a walk inside such a module starts. */
  readonly entries = new Set<number>();
  /** The rooms of each module standing apart, one list a module (their cable to the base: groundTurrets.ts). */
  readonly apartModules: number[][] = [];
  /** Airlock rooms for the crew's walks outside (not berths for ships). */
  readonly crewLocks = new Set<number>();
  /** A prefab base's tube floor tiles (x, y): drawn as glass tubes (sim/tube.ts). */
  readonly tubes: [number, number][] = [];

  /** A hall; with a spec, a fixture that stands in one (an airlock unit on a quay): open to the halls round it, and a room of the program. */
  hall(role: RoomRole = 'hall', dept?: string, spec?: RoomSpec): number {
    this.regions.push({ role, hall: true, doors: 0, rank: 0, ...(dept ? { dept } : {}), ...(spec ? { spec } : {}) });
    return this.regions.length - 1;
  }

  /** The compiled floor cropped to its extent, with the region of every floor tile: for sheets and the plan class. */
  snapshot(cell: string[] = this.compile(), include?: readonly [number, number, number, number]): { rows: string[]; roomOf: Int16Array; width: number; height: number; x0: number; y0: number } {
    const { size, half } = this;
    let x0 = size, y0 = size, x1 = -1, y1 = -1;
    for (let k = 0; k < cell.length; k++) if (cell[k] !== '.') { x0 = Math.min(x0, k % size); x1 = Math.max(x1, k % size); y0 = Math.min(y0, Math.floor(k / size)); y1 = Math.max(y1, Math.floor(k / size)); }
    // Open ground that belongs to it (a prefab base's shuttle pad) is inside its extent too.
    if (include) { x0 = Math.min(x0, include[0] + half); y0 = Math.min(y0, include[1] + half); x1 = Math.max(x1, include[2] - 1 + half); y1 = Math.max(y1, include[3] - 1 + half); }
    x0--; y0--; x1++; y1++; // a tile of space all round, as the generator's templates have
    const width = x1 - x0 + 1, height = y1 - y0 + 1;
    const rows: string[] = [];
    const roomOf = new Int16Array(width * height).fill(-1);
    for (let y = y0; y <= y1; y++) {
      let row = '';
      for (let x = x0; x <= x1; x++) {
        const k = y * size + x, c = cell[k] ?? '.';
        row += c;
        if (c === '_') roomOf[(y - y0) * width + x - x0] = this.own[k] as number;
      }
      rows.push(row);
    }
    return { rows, roomOf, width, height, x0: x0 - half, y0: y0 - half };
  }

  /** Paint `id` where `pred` holds. */
  paint(id: number, pred: (x: number, y: number) => boolean): void {
    for (let y = -this.half; y < this.half; y++) for (let x = -this.half; x < this.half; x++) if (pred(x, y)) this.set(x, y, id);
  }

  /** Paint the box x0 <= x < x1, y0 <= y < y1 (where `only` holds, when given). */
  rect(id: number, x0: number, y0: number, x1: number, y1: number, only?: (x: number, y: number) => boolean): void {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (!only || only(x, y)) this.set(x, y, id);
  }

  private readonly gates: [number, number][] = [];

  /** The grid as it stands, to come back to with `reset` after a trial placement. */
  mark(): { own: Int16Array; regions: number; gates: number; beams: number[]; shapes: Shape[] } {
    return { own: this.own.slice(), regions: this.regions.length, gates: this.gates.length, beams: [...this.beams], shapes: this.shapes.map((sh) => ({ ...sh })) };
  }

  reset(m: { own: Int16Array; regions: number; gates: number; beams: number[]; shapes: Shape[] }): void {
    this.own.set(m.own);
    this.shapes = m.shapes.map((sh) => ({ ...sh }));
    this.regions.length = m.regions;
    this.gates.length = m.gates;
    this.beams.clear();
    for (const k of m.beams) this.beams.add(k);
  }

  /** A door forced at a wall tile between two halls (a checkpoint: the only way through a solid line). */
  gate(x: number, y: number): void {
    this.gates.push([x, y]);
  }

  /** Open beams: structure in open space (the game's truss tile, '='). They stand on space and change no wall. */
  private readonly beams = new Set<number>();

  /** A beam tile, where there is open space. */
  beam(x: number, y: number): void {
    const k = this.idx(x, y);
    if (k >= 0 && this.own[k] === SPACE) this.beams.add(k);
  }

  /** A hall box with a solid margin round it, so it keeps its width beside open space; rooms painted later replace the margin. */
  street(id: number, x0: number, y0: number, x1: number, y1: number): void {
    for (let y = y0 - 1; y < y1 + 1; y++) for (let x = x0 - 1; x < x1 + 1; x++) {
      const cur = this.at(x, y);
      if (cur === SPACE) this.set(x, y, SOLID);
    }
    this.rect(id, x0, y0, x1, y1);
  }

  /**
   * The owner as the wall rule sees it: open space in an inner corner of the outline (ground on two sides at a right angle
   * and between them, space on the other two) is wall. The corner is then walled square, where otherwise the floor tile
   * across the corner would give way and leave a notch in its room.
   */
  private wallOwner(x: number, y: number): number {
    const a = this.at(x, y);
    if (a !== SPACE) return a;
    if (this.at(x - 1, y) === SPACE && this.at(x + 1, y) === SPACE && this.at(x, y - 1) === SPACE && this.at(x, y + 1) === SPACE) return SPACE;
    for (let dx = -1; dx <= 1; dx += 2) for (let dy = -1; dy <= 1; dy += 2) {
      if (this.at(x + dx, y) === SPACE || this.at(x, y + dy) === SPACE || this.at(x - dx, y) !== SPACE || this.at(x, y - dy) !== SPACE) continue;
      // Only where the tile across the corner is floor but for this one: a corner it shares with walls anyway stays open.
      const cx = x + dx, cy = y + dy, c = this.at(cx, cy);
      if (c < 0) continue;
      const hallC = (this.regions[c] as Region).hall;
      let wall = false;
      for (let ey = -1; ey <= 1 && !wall; ey++) for (let ex = -1; ex <= 1 && !wall; ex++) {
        if (ex === -dx && ey === -dy) continue;
        const b = this.at(cx + ex, cy + ey);
        if (b === c || b === SOLID) continue;
        if (b !== SPACE && hallC && (this.regions[b] as Region).hall) continue;
        wall = this.over(b, c);
      }
      if (!wall) return SOLID;
    }
    return SPACE;
  }

  /** `wallOwner` over the window of w x h tiles from (ox, oy), row-major: tiles with no ground beside them skip the corner test. */
  private owners(ox: number, oy: number, w: number, h: number): Int32Array {
    const rw = w + 2, raw = new Int32Array(rw * (h + 2));
    raw.fill(SPACE);
    const { size, half, own } = this;
    const i0 = Math.max(0, ox - 1 + half), i1 = Math.min(size, ox + w + 1 + half);
    for (let j = 0; j < h + 2; j++) {
      const gj = oy - 1 + j + half;
      if (gj < 0 || gj >= size) continue;
      for (let gi = i0; gi < i1; gi++) raw[j * rw + gi - (ox - 1 + half)] = own[gj * size + gi] as number;
    }
    const wo = new Int32Array(w * h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const k = (j + 1) * rw + i + 1, a = raw[k] as number;
      wo[j * w + i] = a !== SPACE || (raw[k - 1] === SPACE && raw[k + 1] === SPACE && raw[k - rw] === SPACE && raw[k + rw] === SPACE) ? a : this.wallOwner(ox + i, oy + j);
    }
    return wo;
  }

  private prio(id: number): number {
    if (id === SPACE) return Infinity;
    if (id === SOLID) return -Infinity;
    const r = this.regions[id] as Region;
    return r.hall ? 1e6 : r.rank;
  }

  /** Every tile as '.', '#', '_' or 'D' (row-major over the grid). */
  compile(): string[] {
    const { size, half } = this;
    const cell = new Array<string>(size * size).fill('.');
    // Only the painted extent (a tile round it, for inner-corner walls) can hold floor or wall: scan that, not the grid.
    let bx0 = size, by0 = size, bx1 = -1, by1 = -1;
    for (let k = 0; k < this.own.length; k++) {
      if (this.own[k] === SPACE) continue;
      const i = k % size, j = (k - i) / size;
      if (i < bx0) bx0 = i;
      if (i > bx1) bx1 = i;
      if (j < by0) by0 = j;
      if (j > by1) by1 = j;
    }
    if (bx1 < 0) return cell;
    // Wall owners over the extent plus two tiles; beyond it the owner is space.
    const ox = bx0 - 2 - half, oy = by0 - 2 - half, w = bx1 - bx0 + 5, h = by1 - by0 + 5;
    const wo = this.owners(ox, oy, w, h);
    const ownerAt = (x: number, y: number): number => { const i = x - ox, j = y - oy; return i < 0 || j < 0 || i >= w || j >= h ? SPACE : (wo[j * w + i] as number); };
    for (let y = oy + 1; y < oy + h - 1; y++) for (let x = ox + 1; x < ox + w - 1; x++) {
      if (x < -half || y < -half || x >= half || y >= half) continue;
      const a = ownerAt(x, y);
      if (a === SPACE) continue;
      let wall = a === SOLID;
      const hallA = a >= 0 && (this.regions[a] as Region).hall;
      for (let dy = -1; dy <= 1 && !wall; dy++) for (let dx = -1; dx <= 1 && !wall; dx++) {
        const b = ownerAt(x + dx, y + dy);
        if (b === a || b === SOLID) continue;
        if (b !== SPACE && hallA && (this.regions[b] as Region).hall) continue;
        if (this.over(b, a)) wall = true;
      }
      cell[(y + half) * size + x + half] = wall ? '#' : '_';
    }
    this.regions.forEach((rg, id) => { const sh = this.shapes[id]; if (!rg.hall && rg.doors > 0 && sh) addDoors(cell, id, rg, sh, this); });
    for (const [x, y] of this.gates) {
      const k = this.idx(x, y);
      if (k >= 0 && cell[k] === '#') cell[k] = 'D';
    }
    for (const k of this.beams) if (cell[k] === '.') cell[k] = '=';
    return cell;
  }

  /** Whether the tile compiles to wall (doors aside): the rule of `compile` for one tile. */
  private wallAt(x: number, y: number): boolean {
    const a = this.wallOwner(x, y);
    if (a === SPACE) return false;
    if (a === SOLID) return true;
    const hallA = (this.regions[a] as Region).hall;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const b = this.wallOwner(x + dx, y + dy);
      if (b === a || b === SOLID) continue;
      if (b !== SPACE && hallA && (this.regions[b] as Region).hall) continue;
      if (this.over(b, a)) return true;
    }
    return false;
  }

  /**
   * Whether the box x0 <= x < x1, y0 <= y < y1 holds more solid 2x2 wall blocks now than it did as `was` (a `mark`'s
   * tiles). The same answer as two `blocks` counts over the box, but only the tiles that changed are counted, with a
   * margin of the wall rule's reach (a tile's wall owner reads two tiles round it, its wall flag one more, a block one
   * more): nothing beyond that can differ.
   */
  moreBlocks(was: Int16Array, x0: number, y0: number, x1: number, y1: number): boolean {
    const { size, half, own } = this;
    let i0 = size, j0 = size, i1 = -1, j1 = -1;
    for (let k = 0; k < own.length; k++) {
      if (own[k] === was[k]) continue;
      const i = k % size, j = (k - i) / size;
      if (i < i0) i0 = i;
      if (i > i1) i1 = i;
      if (j < j0) j0 = j;
      if (j > j1) j1 = j;
    }
    if (i1 < 0) return false;
    const M = 4, bx0 = Math.max(x0, i0 - half - M), by0 = Math.max(y0, j0 - half - M), bx1 = Math.min(x1, i1 - half + M + 1), by1 = Math.min(y1, j1 - half + M + 1);
    if (bx0 >= bx1 || by0 >= by1) return false;
    const after = this.blocks(bx0, by0, bx1, by1);
    // The count as it was: the changed rows put back for a moment.
    const lo = j0 * size, hi = (j1 + 1) * size, now = own.slice(lo, hi);
    own.set(was.subarray(lo, hi), lo);
    const before = this.blocks(bx0, by0, bx1, by1);
    own.set(now, lo);
    return after > before;
  }

  /** Solid 2x2 wall blocks in the box x0 <= x < x1, y0 <= y < y1 as the grid stands, doors not counted. */
  blocks(x0: number, y0: number, x1: number, y1: number): number {
    // The wall rule over the box once (owners cached with a tile's margin), then the 2x2 count over the flags.
    const w = x1 - x0 + 3, h = y1 - y0 + 3, ox = x0 - 1, oy = y0 - 1;
    const wo = this.owners(ox, oy, w, h);
    const fw = x1 - x0 + 1, fh = y1 - y0 + 1;
    const wall = new Uint8Array(fw * fh);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const a = wo[(y - oy) * w + x - ox] as number;
      if (a === SPACE) continue;
      let is = a === SOLID;
      const hallA = a >= 0 && (this.regions[a] as Region).hall;
      for (let dy = -1; dy <= 1 && !is; dy++) for (let dx = -1; dx <= 1 && !is; dx++) {
        const b = wo[(y + dy - oy) * w + x + dx - ox] as number;
        if (b === a || b === SOLID) continue;
        if (b !== SPACE && hallA && (this.regions[b] as Region).hall) continue;
        if (this.over(b, a)) is = true;
      }
      if (is) wall[(y - y0) * fw + x - x0] = 1;
    }
    let n = 0;
    for (let y = y0; y < y1; y++) {
      let left = wall[(y - y0) * fw] === 1 && wall[(y + 1 - y0) * fw] === 1;
      for (let x = x0 + 1; x <= x1; x++) {
        const k = (y - y0) * fw + x - x0;
        const here = wall[k] === 1 && wall[k + fw] === 1;
        if (left && here) n++;
        left = here;
      }
    }
    return n;
  }
}
