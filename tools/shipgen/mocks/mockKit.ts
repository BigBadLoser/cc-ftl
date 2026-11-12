/**
 * Hand-designed station skeleton mocks (dev tool, not shipped). A mock paints owner regions on a tile grid; one compiler
 * then writes every wall (the lower-priority side of each boundary gives up its tile, space outranks everything, so a
 * room's outer wall IS the hull) and every door. The result is a GenResult, so the original labels.ts and views.ts draw
 * it and the station checks run on it unchanged. No furniture: these are skeletons.
 */
import type { GenResult, GenRoom, RoomRole } from '../../../src/sim';
import { deptOf } from '../../../src/sim/shipgen/stationDepartments';
import type { RoomSpec } from '../../../src/sim/shipgen/plan';

/** A mock's result: a GenResult plus each room's department and target floor area (the program's size for it). */
export type MockResult = GenResult & { depts: string[]; targets: (number | undefined)[] };
/** A room in a band or strip: role, share (degrees or weight), optional target floor area and department. */
export type Part = [RoomRole, number, number?, string?];

export interface MockRegion {
  role: RoomRole;
  /** Halls are open to each other (no wall between two halls) and outrank rooms, so their painted width is their width. */
  hall: boolean;
  /** Regions this room may open a door onto (default: any hall). */
  access?: number[];
  doors: number;
  /** The game's department (stationDepartments.deptOf by role unless given). */
  dept: string;
  /** Floor area the program asks for, when known. */
  target?: number;
}

const SPACE = -1;

export class Mock {
  readonly own: Int16Array;
  readonly regions: MockRegion[] = [];
  readonly cx: number;
  readonly cy: number;

  constructor(readonly w: number, readonly h: number, cx = w / 2, cy = h / 2) {
    this.own = new Int16Array(w * h).fill(SPACE);
    this.cx = cx;
    this.cy = cy;
  }

  room(role: RoomRole, o: { access?: number[]; doors?: number; dept?: string; target?: number } = {}): number {
    const dept = o.dept ?? deptOf({ role } as RoomSpec);
    this.regions.push({ role, hall: false, access: o.access, doors: o.doors ?? 1, dept, target: o.target });
    return this.regions.length - 1;
  }

  hall(role: RoomRole = 'hall'): number {
    this.regions.push({ role, hall: true, doors: 0, dept: role === 'hall' ? 'circulation' : 'commons' });
    return this.regions.length - 1;
  }

  /** Paint `id` (or space, -1) where `pred` holds; r is the distance from the centre, a the angle in degrees (0 = east, clockwise). */
  paint(id: number, pred: (x: number, y: number, r: number, a: number) => boolean): this {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const dx = x + 0.5 - this.cx, dy = y + 0.5 - this.cy;
      const a = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
      if (pred(x, y, Math.hypot(dx, dy), a)) this.own[y * this.w + x] = id;
    }
    return this;
  }

  rect(id: number, x: number, y: number, w: number, h: number): this {
    return this.paint(id, (tx, ty) => tx >= x && tx < x + w && ty >= y && ty < y + h);
  }

  /**
   * Annulus sector r0 <= r < r1, angles a0..a1 (degrees, may wrap past 360). With `sides`, r is measured to a regular
   * polygon with a flat face centred on each axis (r is then the apothem), for faceted hulls and rings.
   */
  arc(id: number, r0: number, r1: number, a0 = 0, a1 = 360, sides = 0): this {
    const inArc = (a: number): boolean => (a1 - a0 >= 360 ? true : a0 <= a1 ? a >= a0 && a < a1 : a >= a0 || a < a1 % 360);
    return this.paint(id, (_x, _y, r, a) => {
      const p = polyR(r, a, sides);
      return p >= r0 && p < r1 && inArc(a1 > 360 && a < a0 ? a + 360 : a);
    });
  }

  /**
   * A ring r0 <= r < r1 on a coarse lattice: a tile is in when the centre of its k x k cell is (cells aligned on the
   * centre). The outline then steps k tiles at a time, never one, so a straight wall can meet it anywhere.
   */
  coarse(id: number, r0: number, r1: number, k: number): this {
    return this.paint(id, (x, y) => {
      const dx = (Math.floor((x - this.cx) / k) + 0.5) * k, dy = (Math.floor((y - this.cy) / k) + 0.5) * k;
      const r = Math.hypot(dx, dy);
      return r >= r0 && r < r1;
    });
  }

  /** Only repaint tiles currently owned by `from` (e.g. split a band into rooms). */
  within(from: number, id: number, pred: (x: number, y: number, r: number, a: number) => boolean): this {
    return this.paint(id, (x, y, r, a) => this.own[y * this.w + x] === from && pred(x, y, r, a));
  }

  private slices: { tiles: number[]; keys: number[]; ids: number[]; cuts: number[] }[] = [];

  /**
   * Split the tiles of `band` with angle in a0..a1 into rooms, cut by straight lines across the band: horizontal cuts
   * where the band runs north-south, vertical where it runs east-west (or `axis`). Chunks start equal by tile count;
   * clean() then slides each cut to where its wall meets the curves without a 2x2 block.
   */
  slice(band: number, a0: number, a1: number, roles: (RoomRole | Part)[], o: { axis?: 'x' | 'y'; access?: number[] } = {}): number[] {
    const parts: Part[] = roles.map((r) => (typeof r === 'string' ? [r, 1] : r));
    const mid = (((a0 + a1) / 2) * Math.PI) / 180;
    const axis = o.axis ?? (Math.abs(Math.cos(mid)) > Math.abs(Math.sin(mid)) ? 'y' : 'x');
    const inArc = (a: number): boolean => (a0 <= a1 ? a >= a0 && a < a1 : a >= a0 || a < a1);
    const tiles: number[] = [], keys: number[] = [];
    this.paint(band, (x, y, _r, a) => {
      const own = this.own[y * this.w + x] === band;
      if (own && inArc(a % 360)) { tiles.push(y * this.w + x); keys.push(axis === 'y' ? y : x); }
      return own;
    });
    const sorted = [...keys].sort((p, q) => p - q);
    const ids = parts.map(([role, , target, dept]) => this.room(role, { access: o.access, target, dept }));
    const total = parts.reduce((t, p) => t + p[1], 0);
    let acc = 0;
    const cuts = parts.slice(0, -1).map((p) => { acc += p[1]; return sorted[Math.max(0, Math.floor((acc / total) * sorted.length) - 1)] ?? 0; });
    const s = { tiles, keys, ids, cuts };
    this.slices.push(s);
    this.applySlice(s);
    return ids;
  }

  private applySlice(s: { tiles: number[]; keys: number[]; ids: number[]; cuts: number[] }): void {
    s.tiles.forEach((t, i) => {
      const key = s.keys[i] as number;
      let k = 0;
      while (k < s.cuts.length && key > (s.cuts[k] as number)) k++;
      this.own[t] = s.ids[k] as number;
    });
  }

  private bands: { tiles: number[]; ids: number[]; cuts: { a: number; axis: 'x' | 'y'; c: number }[]; fixed: Set<number> }[] = [];

  /**
   * Rooms around a band, clockwise from angle `start`: each [role, degrees]. Every boundary is a straight cut across
   * the band (vertical near north and south, horizontal near east and west), never a radial staircase. Keep cuts off
   * the diagonals (about 30-60 degrees from an axis): there both curves step one tile at a time and any straight wall
   * meeting them makes a 2x2 block, so a room should span the whole diagonal stretch instead.
   */
  around(band: number, start: number, rooms: Part[], o: { access?: number[] } = {}): number[] {
    const tiles: number[] = [];
    for (let i = 0; i < this.own.length; i++) if (this.own[i] === band) tiles.push(i);
    let rs = 0, n = 0;
    for (const t of tiles) { rs += Math.hypot((t % this.w) + 0.5 - this.cx, Math.floor(t / this.w) + 0.5 - this.cy); n++; }
    const rm = rs / Math.max(1, n);
    let a = start;
    const cuts = rooms.map(([, deg]) => {
      const th = (a * Math.PI) / 180;
      const axis: 'x' | 'y' = Math.abs(Math.sin(th)) > Math.abs(Math.cos(th)) ? 'x' : 'y';
      const c = Math.round(axis === 'x' ? this.cx + rm * Math.cos(th) : this.cy + rm * Math.sin(th));
      a += deg;
      return { a: a - deg, axis, c };
    });
    const ids = rooms.map(([role, , target, dept]) => this.room(role, { access: o.access, target, dept }));
    const b = { tiles, ids, cuts, fixed: new Set<number>() };
    this.bands.push(b);
    this.applyBand(b);
    // A part with no floor stands in for something else (a wing, a spine): cuts beside it stay where they are.
    const empty = new Set(ids.filter((id) => !tiles.some((t) => this.own[t] === id)));
    ids.forEach((id, k) => { if (empty.has(id)) { b.fixed.add(k); b.fixed.add((k + 1) % ids.length); } });
    return ids;
  }

  private applyBand(b: { tiles: number[]; ids: number[]; cuts: { a: number; axis: 'x' | 'y'; c: number }[] }): void {
    const passed = (t: number, k: number): boolean => {
      const cut = b.cuts[k] as { a: number; axis: 'x' | 'y'; c: number };
      const x = t % this.w, y = Math.floor(t / this.w);
      const a = ((Math.atan2(y + 0.5 - this.cy, x + 0.5 - this.cx) * 180) / Math.PI + 360) % 360;
      const d = ((a - cut.a + 540) % 360) - 180;
      if (Math.abs(d) >= 45) return d > 0;
      const th = (cut.a * Math.PI) / 180;
      return cut.axis === 'x' ? (-Math.sin(th) > 0 ? x >= cut.c : x < cut.c) : (Math.cos(th) > 0 ? y >= cut.c : y < cut.c);
    };
    const n = b.cuts.length;
    for (const t of b.tiles) {
      let pick = 0;
      for (let k = 0; k < n; k++) if (passed(t, k) && !passed(t, (k + 1) % n)) { pick = k; break; }
      const id = b.ids[pick] as number;
      this.own[t] = this.regions[id]?.dept === 'void' ? SPACE : id; // a 'void' part opens the band to space
    }
  }

  /** Greedy: slide every cut up to `reach` tiles either way to minimise solid 2x2 wall blocks. */
  clean(reach = 3): this {
    const score = (): number => countBlocks(this.walls());
    let best = score();
    const knobs: { get: () => number; set: (v: number) => void; ok: (v: number) => boolean }[] = [];
    for (const s of this.slices) s.cuts.forEach((_, k) => knobs.push({
      get: () => s.cuts[k] as number,
      set: (v) => { s.cuts[k] = v; this.applySlice(s); },
      // Never squeeze a room under 3 floor tiles (4 with its wall) to save a wall block.
      ok: (v) => v >= (k > 0 ? (s.cuts[k - 1] as number) : Math.min(...s.keys) - 1) + 4 && v <= (k + 1 < s.cuts.length ? (s.cuts[k + 1] as number) : Math.max(...s.keys)) - 4,
    }));
    for (const b of this.bands) b.cuts.forEach((cut, k) => {
      if (b.fixed.has(k)) return;
      const home = cut.c, n = b.cuts.length;
      // Two tiles at most, and never within 4 tiles of a neighbouring parallel cut (a room under 3 floor tiles wide).
      const near = [b.cuts[(k + n - 1) % n], b.cuts[(k + 1) % n]].filter((o) => o && o !== cut && o.axis === cut.axis && Math.abs(((o.a - cut.a + 540) % 360) - 180) < 40);
      knobs.push({
        get: () => cut.c, set: (v) => { cut.c = v; this.applyBand(b); },
        ok: (v) => Math.abs(v - home) <= 2 && near.every((o) => Math.abs(v - (o as { c: number }).c) >= 4),
      });
    });
    for (let pass = 0; pass < 2; pass++) for (const kn of knobs) {
      const base = kn.get();
      let pick = base;
      for (let d = -reach; d <= reach; d++) {
        if (!d || !kn.ok(base + d)) continue;
        kn.set(base + d);
        const v = score();
        if (v < best) { best = v; pick = base + d; }
      }
      kn.set(pick);
    }
    return this;
  }

  private prio(id: number): number {
    if (id === SPACE) return 1e9;
    return this.regions[id]?.hall ? 1e6 + id : id;
  }

  /** The wall compiler: '#' where a tile borders a higher-priority region (space outranks all), '_' floor, '.' space. */
  walls(): string[][] {
    const { w, h, own } = this;
    const at = (x: number, y: number): number => (x < 0 || y < 0 || x >= w || y >= h ? SPACE : (own[y * w + x] as number));
    const cell: string[][] = [];
    for (let y = 0; y < h; y++) {
      const row: string[] = [];
      for (let x = 0; x < w; x++) {
        const a = at(x, y);
        if (a === SPACE) { row.push('.'); continue; }
        let wall = false;
        for (let dy = -1; dy <= 1 && !wall; dy++) for (let dx = -1; dx <= 1 && !wall; dx++) {
          const b = at(x + dx, y + dy);
          if (b === a) continue;
          if (b !== SPACE && this.regions[a]?.hall && this.regions[b]?.hall) continue;
          if (this.prio(b) > this.prio(a)) wall = true;
        }
        row.push(wall ? '#' : '_');
      }
      cell.push(row);
    }
    return cell;
  }

  build(title: string): MockResult {
    const { w, h, own } = this;
    const at = (x: number, y: number): number => (x < 0 || y < 0 || x >= w || y >= h ? SPACE : (own[y * w + x] as number));
    const cell = this.walls();
    const floorOf = (x: number, y: number): number => (cell[y]?.[x] === '_' ? at(x, y) : -2);
    // Doors: a straight wall tile with this room's floor on one side and an allowed region's floor opposite.
    this.regions.forEach((rg, id) => {
      if (rg.hall || rg.doors <= 0) return;
      const ok = (b: number): boolean => b >= 0 && b !== id && (rg.access ? rg.access.includes(b) : !!this.regions[b]?.hall);
      const cands: { x: number; y: number }[] = [];
      for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
        if (cell[y]?.[x] !== '#') continue;
        const n = floorOf(x, y - 1), s = floorOf(x, y + 1), e = floorOf(x + 1, y), wv = floorOf(x - 1, y);
        const straightH = cell[y]?.[x - 1] === '#' && cell[y]?.[x + 1] === '#';
        const straightV = cell[y - 1]?.[x] === '#' && cell[y + 1]?.[x] === '#';
        if (straightH && ((n === id && ok(s)) || (s === id && ok(n)))) cands.push({ x, y });
        else if (straightV && ((e === id && ok(wv)) || (wv === id && ok(e)))) cands.push({ x, y });
      }
      if (!cands.length) return;
      const mx = cands.reduce((s, c) => s + c.x, 0) / cands.length, my = cands.reduce((s, c) => s + c.y, 0) / cands.length;
      cands.sort((p, q) => Math.hypot(p.x - mx, p.y - my) - Math.hypot(q.x - mx, q.y - my));
      const placed: { x: number; y: number }[] = [];
      for (const c of rg.doors === 1 ? cands : [...cands].reverse()) {
        if (placed.length >= rg.doors) break;
        if (placed.some((p) => Math.abs(p.x - c.x) + Math.abs(p.y - c.y) < 4)) continue;
        placed.push(c);
        (cell[c.y] as string[])[c.x] = 'D';
      }
    });
    const roomOf = new Int16Array(w * h).fill(-1);
    for (let i = 0; i < w * h; i++) if (cell[Math.floor(i / w)]?.[i % w] === '_') roomOf[i] = own[i] as number;
    const rooms = this.regions.map((rg) => ({ role: rg.role }) as unknown as GenRoom);
    return {
      template: { rows: cell.map((r) => r.join('')), modules: [] } as unknown as GenResult['template'],
      rooms, roomOf, width: w, height: h, role: 'station', archetype: 'station' as GenResult['archetype'],
      topology: `mock ${title}`, attempts: 1, problems: [], failures: [],
      depts: this.regions.map((rg) => rg.dept), targets: this.regions.map((rg) => rg.target),
    };
  }
}

/** Distance measured to a regular `sides`-gon with a face centred on each axis (0 sides: a circle). */
export function polyR(r: number, a: number, sides: number): number {
  if (!sides) return r;
  const seg = 360 / sides;
  const phi = ((((a + seg / 2) % seg) + seg) % seg) - seg / 2;
  return r * Math.cos((phi * Math.PI) / 180);
}

function countBlocks(c: string[][]): number {
  let n = 0;
  for (let y = 0; y + 1 < c.length; y++) {
    const a = c[y] as string[], b = c[y + 1] as string[];
    for (let x = 0; x + 1 < a.length; x++) if (a[x] === '#' && a[x + 1] === '#' && b[x] === '#' && b[x + 1] === '#') n++;
  }
  return n;
}

/** Every solid 2x2 block of wall (top-left corners). */
export function wallBlocks(g: GenResult): { x: number; y: number }[] {
  const rows = g.template.rows, out: { x: number; y: number }[] = [];
  for (let y = 0; y + 1 < rows.length; y++) for (let x = 0; x + 1 < (rows[y]?.length ?? 0); x++) {
    if (rows[y]?.[x] === '#' && rows[y]?.[x + 1] === '#' && rows[y + 1]?.[x] === '#' && rows[y + 1]?.[x + 1] === '#') out.push({ x, y });
  }
  return out;
}

/** Rooms with no door, rooms whose floor is split, and painted regions with no floor left. */
export function roomProblems(g: GenResult): string[] {
  const out: string[] = [];
  const { width: w, height: h } = g;
  const rows = g.template.rows;
  g.rooms.forEach((rm, id) => {
    const tiles: number[] = [];
    for (let i = 0; i < w * h; i++) if (g.roomOf[i] === id) tiles.push(i);
    if (!tiles.length) return; // a placeholder band fully split into rooms
    const set = new Set(tiles), seen = new Set([tiles[0] as number]), q = [tiles[0] as number];
    for (let k = 0; k < q.length; k++) {
      const i = q[k] as number;
      for (const j of [i - 1, i + 1, i - w, i + w]) if (set.has(j) && !seen.has(j)) { seen.add(j); q.push(j); }
    }
    const cx = tiles.reduce((s, i) => s + (i % w), 0) / tiles.length, cy = tiles.reduce((s, i) => s + Math.floor(i / w), 0) / tiles.length;
    const where = `${rm.role} #${id} near ${Math.round(cx)},${Math.round(cy)}`;
    if (rm.role !== 'hall' && seen.size !== tiles.length) out.push(`${where}: floor split in ${tiles.length - seen.size}+ tiles`);
    if (rm.role === 'hall' || rm.role === 'plaza' || rm.role === 'garden') return; // open circulation
    const door = tiles.some((i) => [i - 1, i + 1, i - w, i + w].some((j) => rows[Math.floor(j / w)]?.[j % w] === 'D'));
    if (!door) out.push(`${where}: no door`);
  });
  return out;
}
