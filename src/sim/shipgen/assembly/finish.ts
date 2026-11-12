import type { RoomSpec } from '../plan';
import type { Asm } from './asm';
import { at, key, type Ctx } from './model';
import { SOLID, SPACE, type RegionGrid } from './regions';

/** The last steps of an assembly: corridor tails cut back, bracing beams, and the hard check that every room stands. */

/**
 * Bracing: open beams across the gaps between sections that face each other one to nine tiles apart and are not the
 * same element, whatever their departments. One a gap at most every four tiles, none through the clear space off a dock.
 * A beam touches hull at its two ends only: beside it, along its whole run, at least CLEAR tiles are open, clear of
 * hull and of every other beam (a truss counts from its chords).
 */
const CLEAR = 2;
export function brace(a: Asm, chance: number): void {
  const { g, reserved, rng } = a.ctx;
  const of = new Map<number, number>();
  a.elements.forEach((el, i) => { for (const id of el.regions) of.set(id, i); });
  const cell = g.compile(), S = g.size, H = g.half;
  const at = (x: number, y: number): string => (Math.abs(x) >= H || Math.abs(y) >= H ? '.' : (cell[(y + H) * S + x + H] as string));
  const el = (x: number, y: number): number => { const o = g.at(x, y); return o >= 0 ? of.get(o) ?? -2 : -3; };
  const done: { x: number; y: number; h: boolean }[] = [];
  // Beams already built: a new one keeps as clear of them as of hull, and never crosses one.
  const built = new Set<number>();
  const beam = (px: number, py: number): void => { g.beam(px, py); built.add(key(px, py)); };
  const space = (px: number, py: number): boolean => at(px, py) === '.' && !built.has(key(px, py));
  for (let y = -H + 12; y < H - 12; y++) for (let x = -H + 12; x < H - 12; x++) {
    if (at(x, y) !== '#' || el(x, y) === -3) continue;
    for (const [dx, dy] of [[1, 0], [0, 1]] as const) {
      let t = 1;
      while (t <= 10 && at(x + t * dx, y + t * dy) === '.' && !reserved.has(key(x + t * dx, y + t * dy))) t++;
      const [ex, ey] = [x + t * dx, y + t * dy];
      if (t < 2 || t > 10 || at(ex, ey) !== '#' || el(ex, ey) === -3 || el(ex, ey) === el(x, y)) continue;
      // Square on to both walls: the tiles beside each end are wall too.
      if (at(x - dy, y - dx) !== '#' || at(x + dy, y + dx) !== '#' || at(ex - dy, ey - dx) !== '#' || at(ex + dy, ey + dx) !== '#') continue;
      const h = dx === 1;
      // Open space beside the run, from offset `from` out to CLEAR tiles more, on both sides.
      const open = (from: number): boolean => {
        for (let k = 1; k < t; k++) for (const s of [-1, 1]) for (let o = from; o < from + CLEAR; o++) {
          const px = x + k * dx + s * o * dy, py = y + k * dy + s * o * dx;
          if (!space(px, py)) return false;
        }
        return true;
      };
      let crossed = false;
      for (let k = 1; k < t && !crossed; k++) crossed = built.has(key(x + k * dx, y + k * dy));
      if (crossed) continue;
      const truss = t >= 5 && open(2);
      if (!truss && !open(1)) continue;
      // Near enough together that a stub between two sections gets a brace either side of it.
      if (done.some((b) => b.h === h && Math.abs(b.x - x) + Math.abs(b.y - y) < 4) || !rng.chance(chance)) continue;
      done.push({ x, y, h });
      // Where the gap is long and there is room either side, a truss: two chords with ties between. Else one beam.
      const clear = (o: number): boolean => {
        for (let k = 1; k < t; k++) { const px = x + k * dx + o * dy, py = y + k * dy + o * dx; if (!space(px, py) || reserved.has(key(px, py))) return false; }
        return at(x + o * dy, y + o * dx) === '#' && at(ex + o * dy, ey + o * dx) === '#';
      };
      if (truss && clear(-1) && clear(1)) {
        for (let k = 1; k < t; k++) {
          beam(x + k * dx - dy, y + k * dy - dx);
          beam(x + k * dx + dy, y + k * dy + dx);
          if (k % 2 === 0) beam(x + k * dx, y + k * dy);
        }
      } else if (open(1)) for (let k = 1; k < t; k++) beam(x + k * dx, y + k * dy);
    }
  }
}

/**
 * Where a room of the band (regions from `from` on) overhangs the corner between two rooms of a section by a tile, the
 * walls meet two thick. The band room gives up that edge line, so its wall falls in with the section's; kept only
 * where it leaves fewer thick walls than before.
 */
export function mend(g: RegionGrid, from: number, box: readonly [number, number, number, number]): void {
  for (let pass = 0; pass < 4; pass++) {
    const before = g.blocks(...box);
    if (before === 0) return;
    const cell = g.compile(), S = g.size, H = g.half;
    const wall = (x: number, y: number): boolean => cell[(y + H) * S + x + H] === '#';
    let fixed = false;
    for (let y = box[1]; y < box[3] && !fixed; y++) for (let x = box[0]; x < box[2] && !fixed; x++) {
      if (!wall(x, y) || !wall(x + 1, y) || !wall(x, y + 1) || !wall(x + 1, y + 1)) continue;
      for (const [tx, ty] of [[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]] as const) {
        const id = g.at(tx, ty);
        if (id < from || g.regions[id]?.hall) continue;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          if (g.at(tx + dx, ty + dy) !== SPACE) continue;
          // The room's line of tiles through this one, along its edge.
          const m = g.mark();
          for (const s of [1, -1]) for (let k = s > 0 ? 0 : 1; g.at(tx + s * k * dy, ty + s * k * dx) === id; k++) g.set(tx + s * k * dy, ty + s * k * dx, SPACE);
          if (g.blocks(...box) < before) { fixed = true; break; }
          g.reset(m);
        }
        if (fixed) break;
      }
    }
    if (!fixed) return;
  }
}

/** Cut back every corridor's unused tail: a corridor ends a little past the last thing that hangs on it. */
export function trim(a: Asm): void {
  const { g } = a.ctx;
  a.elements.forEach((el, owner) => {
    if (!el.run) return;
    const { frame: f, length, hall } = el.run;
    const ports = a.ports.filter((p) => p.owner === owner);
    if (ports.some((p) => p.kind === 'end' && p.used)) return;
    const last = Math.max(0, ...ports.filter((p) => p.used).map((p) => p.along)) + 3;
    if (last >= length) return;
    for (let u = last; u <= length; u++) for (let v = -2; v < 2; v++) {
      const [x, y] = at(f, u, v), o = g.at(x, y);
      if (o === hall || o === SOLID) g.set(x, y, u === last && o === hall ? SOLID : SPACE);
    }
    // The new end: solid across the street, and its margin beside it.
    for (let v = -2; v < 2; v++) { const [x, y] = at(f, last, v); if (g.at(x, y) === SPACE && g.at(...at(f, last - 1, v)) !== SPACE) g.set(x, y, SOLID); }
    for (const p of ports) if (!p.used && p.along >= last) p.used = true;
  });
}

/**
 * The hard check, read from the compiled grid and nothing else: every room of the program stands as a region with
 * floor. Counted by role; quarters by beds, since a block of quarters may stand as several cabins.
 */
export function missing(ctx: Ctx, rooms: readonly RoomSpec[]): string {
  const g = ctx.g, snap = g.snapshot();
  const floored = new Set<number>();
  for (const id of snap.roomOf) if (id >= 0) floored.add(id);
  const beds = (r: RoomSpec): number => r.mods.filter((m) => m === 'module.bed').length;
  const have = new Map<string, number>(), want = new Map<string, number>();
  const count = (m: Map<string, number>, r: RoomSpec): void => { const k = r.role === 'quarters' ? 'beds' : r.role; m.set(k, (m.get(k) ?? 0) + (r.role === 'quarters' ? beds(r) : 1)); };
  for (const r of rooms) { count(want, r); if (r.annex) count(want, r.annex); }
  for (const id of floored) { const spec = g.regions[id]?.spec; if (spec) count(have, spec); }
  const short = [...want].filter(([k, n]) => (have.get(k) ?? 0) < n).map(([k, n]) => `${k} ${have.get(k) ?? 0}/${n}`);
  return short.length > 0 ? `rooms missing from the finished layout: ${short.join(', ')}` : '';
}
