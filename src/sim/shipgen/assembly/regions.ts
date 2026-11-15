import type { Builder } from '../builder';
import { letterOf } from '../canvas';
import type { RoomSpec } from '../plan';
import type { RoomRole } from '../types';

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

export interface Region {
  role: RoomRole;
  /** Halls are open to each other (no wall between two halls). */
  hall: boolean;
  spec?: RoomSpec;
  /** Regions this room may open a door onto (default: any hall). */
  access?: number[];
  doors: number;
  /** Wall rank among rooms: the lower gives way. Defaults to creation order. */
  rank: number;
  /** The department this region belongs to (flow planner), for sheets and the plan class. */
  dept?: string;
}

interface Shape { x0: number; y0: number; x1: number; y1: number; n: number }

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

  /** The region's extent when it is a plain rectangle (inclusive), else null. */
  private boxOf(id: number): Shape | null {
    const sh = this.shapes[id];
    return sh && sh.n === (sh.x1 - sh.x0 + 1) * (sh.y1 - sh.y0 + 1) ? sh : null;
  }

  /**
   * Whether region `b` outranks region `a` where they touch: the one that gives way takes the wall between them. Space
   * outranks everything and halls outrank rooms. Between two rectangular rooms side by side, the one whose shared side
   * runs on past the other's end into open space gives way: it walls that stretch anyway, so its wall runs straight,
   * where the other giving way would leave it a lip of floor beside the other room. When neither (or both) does, the
   * one whose shared side is longer gives way: it walls that side against open space past the other's end anyway, so
   * the wall runs straight and neither room is left with a notch. Otherwise (and on a tie) the lower rank gives way.
   */
  private over(b: number, a: number): boolean {
    const pb = this.prio(b), pa = this.prio(a);
    if (a < 0 || b < 0 || (this.regions[a] as Region).hall || (this.regions[b] as Region).hall) return pb > pa;
    const A = this.boxOf(a), B = this.boxOf(b);
    if (A && B) {
      const sideBySide = (A.x1 + 1 === B.x0 || B.x1 + 1 === A.x0) && A.y0 <= B.y1 && B.y0 <= A.y1;
      const stacked = (A.y1 + 1 === B.y0 || B.y1 + 1 === A.y0) && A.x0 <= B.x1 && B.x0 <= A.x1;
      if (sideBySide || stacked) {
        const ea = this.bare(A, B, stacked), eb = this.bare(B, A, stacked);
        if (ea !== eb) return ea;
      }
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

  room(role: RoomRole, o: { spec?: RoomSpec; access?: number[]; doors?: number; rank?: number; dept?: string } = {}): number {
    const id = this.regions.length;
    this.regions.push({ role, hall: false, doors: o.doors ?? 1, rank: o.rank ?? id, ...(o.spec ? { spec: o.spec } : {}), ...(o.access ? { access: o.access } : {}), ...(o.dept ?? o.spec?.dept ? { dept: o.dept ?? o.spec?.dept } : {}) });
    return id;
  }

  /** A hall; with a spec, a fixture that stands in one (an airlock unit on a quay): open to the halls round it, and a room of the program. */
  hall(role: RoomRole = 'hall', dept?: string, spec?: RoomSpec): number {
    this.regions.push({ role, hall: true, doors: 0, rank: 0, ...(dept ? { dept } : {}), ...(spec ? { spec } : {}) });
    return this.regions.length - 1;
  }

  /** The compiled floor cropped to its extent, with the region of every floor tile: for sheets and the plan class. */
  snapshot(cell: string[] = this.compile()): { rows: string[]; roomOf: Int16Array; width: number; height: number; x0: number; y0: number } {
    const { size, half } = this;
    let x0 = size, y0 = size, x1 = -1, y1 = -1;
    for (let k = 0; k < cell.length; k++) if (cell[k] !== '.') { x0 = Math.min(x0, k % size); x1 = Math.max(x1, k % size); y0 = Math.min(y0, Math.floor(k / size)); y1 = Math.max(y1, Math.floor(k / size)); }
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
    for (const dx of [-1, 1]) for (const dy of [-1, 1]) {
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
    for (let y = -half; y < half; y++) for (let x = -half; x < half; x++) {
      const a = this.wallOwner(x, y);
      if (a === SPACE) continue;
      let wall = a === SOLID;
      const hallA = a >= 0 && (this.regions[a] as Region).hall;
      for (let dy = -1; dy <= 1 && !wall; dy++) for (let dx = -1; dx <= 1 && !wall; dx++) {
        const b = this.wallOwner(x + dx, y + dy);
        if (b === a || b === SOLID) continue;
        if (b !== SPACE && hallA && (this.regions[b] as Region).hall) continue;
        if (this.over(b, a)) wall = true;
      }
      cell[(y + half) * size + x + half] = wall ? '#' : '_';
    }
    this.regions.forEach((rg, id) => { if (!rg.hall && rg.doors > 0) this.addDoors(cell, id, rg); });
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

  /** Solid 2x2 wall blocks in the box x0 <= x < x1, y0 <= y < y1 as the grid stands, doors not counted. */
  blocks(x0: number, y0: number, x1: number, y1: number): number {
    let n = 0;
    for (let y = y0; y < y1; y++) {
      let left = this.wallAt(x0, y) && this.wallAt(x0, y + 1);
      for (let x = x0 + 1; x <= x1; x++) {
        const here = this.wallAt(x, y) && this.wallAt(x, y + 1);
        if (left && here) n++;
        left = here;
      }
    }
    return n;
  }

  /**
   * Rooms in the box x0 <= x < x1, y0 <= y < y1 whose floor, as the grid stands, is not one rectangle (a notch or a
   * bump where a wall took part of one edge), as region ids. Only rooms wholly inside the box are judged.
   */
  lumps(x0: number, y0: number, x1: number, y1: number): Set<number> {
    const box = new Map<number, [number, number, number, number, number, boolean]>();
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const a = this.at(x, y);
      if (a < 0 || (this.regions[a] as Region).hall) continue;
      let b = box.get(a);
      if (!b) box.set(a, (b = [x, y, x, y, 0, false]));
      if (x === x0 || y === y0 || x === x1 - 1 || y === y1 - 1) b[5] = true;
      if (this.wallAt(x, y)) continue;
      if (b[4] === 0) { b[0] = x; b[1] = y; b[2] = x; b[3] = y; }
      b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], y); b[4]++;
    }
    const out = new Set<number>();
    for (const [id, [bx0, by0, bx1, by1, n, edge]] of box) if (!edge && n > 0 && n !== (bx1 - bx0 + 1) * (by1 - by0 + 1)) out.add(id);
    return out;
  }

  /** Doors for one room: straight wall tiles with its floor on one side and an allowed region's floor opposite, spread along the frontage. */
  private addDoors(cell: string[], id: number, rg: Region): void {
    const { size, half } = this;
    const c = (x: number, y: number): string => (this.idx(x, y) < 0 ? '.' : (cell[(y + half) * size + x + half] as string));
    const floor = (x: number, y: number): number => (c(x, y) === '_' ? this.at(x, y) : -3);
    const ok = (b: number): boolean => b >= 0 && b !== id && (rg.access ? rg.access.includes(b) : (this.regions[b] as Region).hall);
    const cands: [number, number][] = [];
    for (let y = -half + 1; y < half - 1; y++) for (let x = -half + 1; x < half - 1; x++) {
      if (c(x, y) !== '#') continue;
      const n = floor(x, y - 1), s = floor(x, y + 1), e = floor(x + 1, y), w = floor(x - 1, y);
      const alongX = c(x - 1, y) === '#' && c(x + 1, y) === '#', alongY = c(x, y - 1) === '#' && c(x, y + 1) === '#';
      if ((alongX && ((n === id && ok(s)) || (s === id && ok(n)))) || (alongY && ((e === id && ok(w)) || (w === id && ok(e))))) cands.push([x, y]);
    }
    for (let k = 0; k < Math.min(rg.doors, cands.length); k++) {
      // The middle of the frontage for one door; evenly spread for more.
      const [x, y] = cands[Math.floor(((k + 0.5) * cands.length) / Math.min(rg.doors, cands.length))] as [number, number];
      cell[(y + half) * size + x + half] = 'D';
    }
  }

  /**
   * Floor that cannot be walked to from the first hall, as [x, y, region] of one tile a stranded region: a room with no
   * door, or a hall cut off from the rest. The fit-out places nothing solid while any floor is stranded.
   */
  stranded(cell: string[] = this.compile()): [number, number, number][] {
    const { size, half } = this;
    const walk = (k: number): boolean => cell[k] === '_' || cell[k] === 'D';
    const start = cell.findIndex((c, k) => c === '_' && (this.own[k] as number) >= 0 && (this.regions[this.own[k] as number] as Region).hall);
    if (start < 0) return [];
    const seen = new Uint8Array(cell.length);
    const stack = [start];
    seen[start] = 1;
    while (stack.length > 0) {
      const k = stack.pop() as number;
      for (const j of [k - 1, k + 1, k - size, k + size]) if (j >= 0 && j < cell.length && !seen[j] && walk(j)) { seen[j] = 1; stack.push(j); }
    }
    const out = new Map<number, [number, number, number]>();
    for (let k = 0; k < cell.length; k++) {
      if (cell[k] !== '_' || seen[k]) continue;
      const id = this.own[k] as number;
      if (!out.has(id)) out.set(id, [(k % size) - half, Math.floor(k / size) - half, id]);
    }
    return [...out.values()];
  }

  /** Stamp the compiled floor into a builder: one chunk a region (its spec with it), then every wall and door. */
  stamp(b: Builder): void {
    const { size, half } = this;
    const cell = this.compile();
    const rowsOf = (keep: (k: number) => string | null): { rows: string[]; x0: number; y0: number } | null => {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (let k = 0; k < cell.length; k++) {
        if (keep(k) === null) continue;
        const x = k % size, y = Math.floor(k / size);
        x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
      }
      if (x1 < x0) return null;
      const rows: string[] = [];
      for (let y = y0; y <= y1; y++) {
        let row = '';
        for (let x = x0; x <= x1; x++) row += keep(y * size + x) ?? '.';
        rows.push(row);
      }
      return { rows, x0: x0 - half, y0: y0 - half };
    };
    this.regions.forEach((rg, id) => {
      const letter = letterOf(rg.role);
      const f = rowsOf((k) => (cell[k] === '_' && this.own[k] === id ? letter : null));
      if (!f) return;
      const key = `flow${id}`;
      b.cv.stamp(f.rows, f.x0, f.y0, key);
      b.chunkRoles.set(`${key}:${letter}`, rg.role);
      if (rg.spec) b.chunkSpecs.set(`${key}:${letter}`, rg.spec);
    });
    const w = rowsOf((k) => (cell[k] === '#' || cell[k] === 'D' ? (cell[k] as string) : null));
    if (w) b.cv.stamp(w.rows, w.x0, w.y0, 'flowwalls');
  }
}
