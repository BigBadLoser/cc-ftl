import type { Rng } from '../rng';
import { Canvas, chunkWidth, doorRows, letterOf } from './canvas';
import type { RoomSpec } from './plan';
import type { ChunkDef, RoomRole } from './types';

/** An axis-aligned box in canvas tiles, walls included. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A placed room or corridor. */
export interface Part extends Rect {
  key: string;
  role: RoomRole;
  spec?: RoomSpec;
}

export type Side = 'n' | 's' | 'e' | 'w';

/** Outer rect for an interior of w x h with its top-left interior tile at (x, y). */
export const box = (x: number, y: number, w: number, h: number): Rect => ({ x: x - 1, y: y - 1, w: w + 2, h: h + 2 });

/**
 * The structural stage's drawing kit: rooms and corridors as walled boxes sharing walls with their neighbours, doors
 * on shared walls, hand-made chunks (noses), and mirroring about the ship's long axis.
 */
export class Builder {
  cv = new Canvas();
  parts: Part[] = [];
  private n = 0;

  /** `axis2`: twice the y of the mirror axis (rows y and axis2 - y mirror each other). */
  constructor(readonly rng: Rng, public axis2 = 0) {}

  /** Throw away everything drawn (an arrangement is being revised). */
  reset(): void {
    this.cv = new Canvas();
    this.parts = [];
    this.chunkSpecs.clear();
  }

  /** Stamp a walled box with the role's floor; null (nothing drawn) if it clashes. */
  place(r: Rect, role: RoomRole, spec?: RoomSpec): Part | null {
    if (r.w < 3 || r.h < 3) return null;
    const letter = letterOf(role);
    const rows = Array.from({ length: r.h }, (_, j) =>
      Array.from({ length: r.w }, (_, i) => (j === 0 || i === 0 || j === r.h - 1 || i === r.w - 1 ? '#' : letter)).join(''));
    const key = `p${this.n++}`;
    if (!this.cv.stamp(rows, r.x, r.y, key)) return null;
    const part: Part = { ...r, key, role, ...(spec ? { spec } : {}) };
    this.parts.push(part);
    return part;
  }

  /** A room for a spec with its interior top-left at (x, y). */
  room(spec: RoomSpec, x: number, y: number): Part | null {
    return this.place(box(x, y, spec.w, spec.h), spec.role, spec);
  }

  /** Mirror a rect about the long axis. */
  mir(r: Rect): Rect {
    return { ...r, y: this.axis2 - (r.y + r.h - 1) };
  }

  /** Place a part and its mirror image (when `mirror`), joined by doors to their mirrored parents. */
  pair(r: Rect, role: RoomRole, spec: RoomSpec | undefined, parents: [Rect, Rect | null], mirror: boolean, spec2?: RoomSpec): Part[] {
    const out: Part[] = [];
    const a = this.place(r, role, spec);
    if (a) { this.door(parents[0], a); out.push(a); }
    if (mirror) {
      const b = this.place(this.mir(r), spec2?.role ?? role, spec2 ?? spec);
      if (b) { this.door(parents[1] ?? parents[0], b); out.push(b); }
    }
    return out;
  }

  /**
   * A door between two boxes that share a wall line: on a wall tile with floor on both sides. `pick` chooses the
   * middle of the shared stretch, a random tile, or the end nearest `low` / `high` coordinates.
   */
  door(a: Rect, b: Rect, pick: 'mid' | 'rand' | 'low' | 'high' = 'mid'): boolean {
    const cands: [number, number][] = [];
    const horiz = (y: number): void => {
      for (let x = Math.max(a.x, b.x) + 1; x <= Math.min(a.x + a.w, b.x + b.w) - 2; x++) {
        if (this.cv.at(x, y) === '#' && this.cv.at(x, y - 1) === '_' && this.cv.at(x, y + 1) === '_') cands.push([x, y]);
      }
    };
    const vert = (x: number): void => {
      for (let y = Math.max(a.y, b.y) + 1; y <= Math.min(a.y + a.h, b.y + b.h) - 2; y++) {
        if (this.cv.at(x, y) === '#' && this.cv.at(x - 1, y) === '_' && this.cv.at(x + 1, y) === '_') cands.push([x, y]);
      }
    };
    if (b.y + b.h - 1 === a.y) horiz(a.y);
    else if (a.y + a.h - 1 === b.y) horiz(b.y);
    else if (b.x + b.w - 1 === a.x) vert(a.x);
    else if (a.x + a.w - 1 === b.x) vert(b.x);
    if (cands.length === 0) return false;
    if (pick === 'mid' && cands.length % 2 === 0 && cands[0]?.[0] === cands[1]?.[0]) {
      // A vertical stretch with two middle tiles: take the one nearer the mirror axis (both when equally near), so
      // mirrored rooms get mirrored doors.
      const a = cands[cands.length / 2 - 1] as [number, number];
      const c = cands[cands.length / 2] as [number, number];
      const da = Math.abs(2 * a[1] - this.axis2);
      const dc = Math.abs(2 * c[1] - this.axis2);
      if (da <= dc) this.cv.setDoor(a[0], a[1]);
      if (dc <= da) this.cv.setDoor(c[0], c[1]);
      return true;
    }
    const i = pick === 'rand' ? this.rng.int(0, cands.length - 1) : pick === 'low' ? 0 : pick === 'high' ? cands.length - 1 : (cands.length - 1) >> 1;
    const [x, y] = cands[i] as [number, number];
    this.cv.setDoor(x, y);
    return true;
  }

  /**
   * Put a room against one side of a parent box, sharing its wall, `along` tiles from the parent's left/top outer
   * corner, and door it to the parent. For 'e' / 'w' the spec's w is the depth away from the parent.
   */
  attach(p: Rect, side: Side, spec: RoomSpec, along: number, pick: 'mid' | 'rand' | 'low' | 'high' = 'mid'): Part | null {
    const W = spec.w + 2;
    const H = spec.h + 2;
    const r: Rect =
      side === 'n' ? { x: p.x + along, y: p.y - H + 1, w: W, h: H }
        : side === 's' ? { x: p.x + along, y: p.y + p.h - 1, w: W, h: H }
          : side === 'w' ? { x: p.x - W + 1, y: p.y + along, w: W, h: H }
            : { x: p.x + p.w - 1, y: p.y + along, w: W, h: H };
    const part = this.place(r, spec.role, spec);
    if (part) this.door(p, part, pick);
    return part;
  }

  /**
   * Rooms side by side along the north or south wall of a corridor box, from column x, sharing walls (or `gap`
   * tiles of space apart). `depth` forces one interior depth for a continuous hull line. Returns parts and the next x.
   */
  strip(corr: Rect, side: 'n' | 's', specs: RoomSpec[], x: number, opts: { depth?: number; gap?: () => number; mirror?: boolean } = {}): { parts: Part[]; x: number } {
    const parts: Part[] = [];
    let cx = x;
    for (const s of specs) {
      const h = (opts.depth ?? s.h) + 2;
      const r: Rect = { x: cx, y: side === 'n' ? corr.y - h + 1 : corr.y + corr.h - 1, w: s.w + 2, h };
      parts.push(...this.pair(r, s.role, { ...s, h: h - 2 }, [corr, corr], !!opts.mirror));
      cx += s.w + 1 + (opts.gap?.() ?? 0);
    }
    return { parts, x: cx };
  }

  /** Specs for rooms of hand-made chunks, by canvas label key ('nose3:b'). */
  readonly chunkSpecs = new Map<string, RoomSpec>();

  /**
   * Stamp a hand-made chunk with its first east-column door on row `firstRow` (a nose joins a corridor there).
   * `specs` gives the rooms of its letters their contents.
   */
  nose(c: ChunkDef, eastX: number, firstRow: number, specs: Record<string, RoomSpec> = {}): boolean {
    const doors = doorRows(c, 'last');
    if (doors.length === 0) return false;
    const key = `nose${this.n++}`;
    if (!this.cv.stamp(c.rows, eastX - (chunkWidth(c) - 1), firstRow - (doors[0] as number), key)) return false;
    for (const [letter, spec] of Object.entries(specs)) this.chunkSpecs.set(`${key}:${letter}`, spec);
    return true;
  }

  /** True if nothing is drawn in rows y0..y1 east of column x (so an engine there faces open space). */
  clearEast(x: number, y0: number, y1: number): boolean {
    for (let y = y0; y <= y1; y++) for (let dx = 1; dx < 80; dx++) if (this.cv.at(x + dx, y) !== '.') return false;
    return true;
  }

  /** True if the box's tiles are all space (nothing drawn there yet), walls may touch existing walls. */
  fits(r: Rect): boolean {
    for (let y = r.y + 1; y < r.y + r.h - 1; y++) for (let x = r.x + 1; x < r.x + r.w - 1; x++) if (this.cv.at(x, y) !== '.') return false;
    return true;
  }
}
