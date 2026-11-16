/**
 * The rule furnisher on a real layout: a room's arrangement (rules.ts) is drawn in the frame of one of its doors (that
 * door under the bottom wall, the room turned and maybe mirrored to put it there), over the largest rectangle of the
 * room's floor that holds that door's approach, then set into the layout. Planned modules the rule does not place
 * itself (life support, a fabricator) go in after it with the generic placer. The room must then pass `roomProblems`
 * with every door; the first arrangement and frame that does is kept. False when none does (the caller places the
 * planned modules plainly).
 */
import type { Rng } from '../../../rng';
import type { Tile } from '../../../modules/footprint';
import { footprintTiles, rotatedSize } from '../../../modules/footprint';
import { placeOne } from '../../fit';
import type { Layout } from '../../layout';
import type { RoomRole } from '../../types';
import { furnishBastion } from './bastion';
import { roomProblems, type Piece } from './check';
import { RULES, type RuleArrangement } from './rules';

const N4: readonly Tile[] = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
/** Facing of each rotation (the side its user stands): 0 south, 1 west, 2 north, 3 east. */
const FACE: readonly Tile[] = [{ x: 0, y: 1 }, { x: -1, y: 0 }, { x: 0, y: -1 }, { x: 1, y: 0 }];

/** A door's approach: the floor tile inside it and the way out through the door. */
export interface Entry { at: Tile; out: Tile }

/**
 * A room frame on the layout: size, door column, and the map from frame tiles to layout tiles. `cut`: its corner tiles
 * that are not floor (a cut or round corner: the wall steps in there), in frame tiles.
 */
export interface Frame { w: number; h: number; d: number; map: (x: number, y: number) => Tile; dir: (x: number, y: number) => Tile; cut: Tile[] }

/** Floor tiles of a room just inside each of its doors. */
export function entriesOf(lay: Layout, room: number): Entry[] {
  const out: Entry[] = [];
  for (const i of lay.roomTiles(room)) {
    const x = i % lay.w, y = Math.floor(i / lay.w);
    for (const n of N4) if (lay.at(x + n.x, y + n.y) === 'D') out.push({ at: { x, y }, out: n });
  }
  return out;
}

/**
 * The frame of a room seen from one door: the largest rectangle of floor whose bottom row holds the door's approach
 * tile, the door below it. `mirror` flips it left to right. `floor` says which layout tiles are the room's. With
 * `notched` the rectangle's corner tiles may be wall (a room with cut or round corners keeps its full width and depth:
 * the rules keep off the missing corners).
 */
export function frameOf(floor: (x: number, y: number) => boolean, e: Entry, mirror: boolean, notched = false): Frame {
  const u = { x: -e.out.x, y: -e.out.y };
  const r = mirror ? { x: u.y, y: -u.x } : { x: -u.y, y: u.x };
  const at = (a: number, b: number): Tile => ({ x: e.at.x + a * r.x + b * u.x, y: e.at.y + a * r.y + b * u.y });
  const on = (a: number, b: number): boolean => { const t = at(a, b); return floor(t.x, t.y); };
  const ok = (a: number, rows: number): boolean => { for (let b = 0; b < rows; b++) if (!on(a, b)) return false; return true; };
  // An end column of a notched frame: floor but for its end tiles.
  const edge = (a: number, rows: number): boolean => { if (rows < 3) return false; for (let b = 1; b < rows - 1; b++) if (!on(a, b)) return false; return true; };
  let best = { a0: 0, a1: 0, h: 1, area: 0 };
  for (let rows = 1; rows < 64 && ok(0, rows); rows++) {
    let a0 = 0, a1 = 0;
    while (a0 > -64 && ok(a0 - 1, rows)) a0--;
    while (a1 < 64 && ok(a1 + 1, rows)) a1++;
    if (notched && edge(a0 - 1, rows)) a0--;
    if (notched && edge(a1 + 1, rows)) a1++;
    if ((a1 - a0 + 1) * rows > best.area) best = { a0, a1, h: rows, area: (a1 - a0 + 1) * rows };
  }
  const { a0, a1, h } = best;
  const map = (x: number, y: number): Tile => at(x + a0, h - 1 - y);
  const cut = [[0, 0], [a1 - a0, 0], [0, h - 1], [a1 - a0, h - 1]].filter(([x, y]) => { const t = map(x as number, y as number); return !floor(t.x, t.y); }).map(([x, y]) => ({ x: x as number, y: y as number }));
  return {
    w: a1 - a0 + 1, h, d: -a0, map, cut,
    dir: (dx, dy) => ({ x: dx * r.x - dy * u.x, y: dx * r.y - dy * u.y }),
  };
}

/** A frame piece in layout tiles: its footprint mapped, turned to face the way the frame piece faces. */
export function toLayout(f: Frame, p: Piece, defs: Layout['defs']): Piece | null {
  const def = defs[p.def];
  if (!def) return null;
  const tiles = footprintTiles(def, p.x, p.y, p.rot).map((t) => f.map(t.x, t.y));
  const x = Math.min(...tiles.map((t) => t.x)), y = Math.min(...tiles.map((t) => t.y));
  const face = FACE[p.rot % 4] as Tile, want = f.dir(face.x, face.y);
  const rot = FACE.findIndex((v) => v.x === want.x && v.y === want.y);
  const [w, h] = rotatedSize(def, rot);
  const bw = Math.max(...tiles.map((t) => t.x)) - x + 1, bh = Math.max(...tiles.map((t) => t.y)) - y + 1;
  return w === bw && h === bh ? { def: p.def, x, y, rot } : null;
}

/** The arrangements of a role in a seeded order (weighted draw without replacement), those that suit the room only. */
function order(rng: Rng, list: readonly RuleArrangement[], need: readonly string[], size: { w: number; h: number; defs: Layout['defs'] }): RuleArrangement[] {
  const pool = list.filter((a) => !a.when || a.when(need, size)), out: RuleArrangement[] = [];
  while (pool.length > 0) {
    let pick = rng.next() * pool.reduce((t, a) => t + a.weight, 0), i = 0;
    while (i < pool.length - 1 && pick >= (pool[i] as RuleArrangement).weight) { pick -= (pool[i] as RuleArrangement).weight; i++; }
    out.push(...pool.splice(i, 1));
  }
  return out;
}

const tally = (ids: readonly string[]): Map<string, number> => { const m = new Map<string, number>(); for (const id of ids) m.set(id, (m.get(id) ?? 0) + 1); return m; };

/**
 * Furnish a room by rule: its planned modules (`need`) all placed, the extras the arrangement brings. Leaves the layout
 * as it was and returns null when no arrangement works in any frame; else the indices of the modules it placed.
 */
export function furnishByRule(
  lay: Layout, rng: Rng, room: number, role: RoomRole, need: readonly string[], rots: (id: string) => number[], o: { bastion?: boolean } = {},
): number[] | null {
  const list = RULES[role];
  const entries = entriesOf(lay, room);
  if (!list || entries.length === 0) return null;
  const pointed = o.bastion ? furnishBastion(lay, room, need, entries.map((e) => e.at)) : null;
  if (pointed) return pointed;
  const floor = (x: number, y: number): boolean => lay.inBounds(x, y) && lay.at(x, y) === '_' && lay.roomOf[y * lay.w + x] === room;
  // No arrangement suits any frame's size: nothing to try (and no draw from the seed, so such a room leaves the rest as it was).
  const sizes = entries.flatMap((e) => [frameOf(floor, e, false), frameOf(floor, e, false, true)]);
  if (!list.some((a) => !a.when || sizes.some((f) => a.when?.(need, { ...f, defs: lay.defs })))) return null;
  const flip = rng.chance(0.5);
  // Every door's frames, plain and notched, the largest first (a room with cut corners is furnished to its walls).
  const frames = entries.flatMap((e) => [frameOf(floor, e, flip), frameOf(floor, e, !flip), ...[frameOf(floor, e, flip, true), frameOf(floor, e, !flip, true)].filter((f) => f.cut.length > 0)])
    .map((f, i) => ({ f, i })).sort((a, b) => b.f.w * b.f.h - a.f.w * a.f.h || a.i - b.i).map((q) => q.f);
  const want = tally(need), at = entries.map((e) => e.at);
  const start = lay.modules.length;
  const undo = (): void => { while (lay.modules.length > start) lay.pop(); };
  for (const arr of order(rng, list, need, { ...(frames[0] as Frame), defs: lay.defs })) {
    for (const f of frames) {
      if (arr.when && !arr.when(need, { ...f, defs: lay.defs })) continue;
      const doors: { x: number; y: number }[] = [];
      for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
        const t = f.map(x, y);
        if ((x !== f.d || y !== f.h - 1) && at.some((e) => e.x === t.x && e.y === t.y)) doors.push({ x, y });
      }
      const pieces = arr.rule({ w: f.w, h: f.h, d: f.d, need, defs: lay.defs, doors, ...(f.cut.length > 0 ? { cut: f.cut } : {}) });
      // A rule with nothing to place for a planned room does not fit this frame.
      if (pieces.length === 0 && need.length > 0) continue;
      const got = tally(pieces.map((p) => p.def));
      // The rule's own planned modules all there (it places every one of a kind, or none and leaves it to the placer).
      if ([...want].some(([id, n]) => (got.get(id) ?? 0) > 0 && (got.get(id) ?? 0) < n)) continue;
      // As drawn: the planned modules among the pieces must stand and each extra (a locker between paired beds, a
      // battery, a chair) that fits goes in with them, then the planned ones the rule leaves to the generic placer. If
      // the room then fails, again with the extras added one at a time after the rest, each only if the room still works.
      for (const lean of [false, true]) {
        const left = new Map(want), extras: Piece[] = [];
        let ok = true;
        for (const p of pieces) {
          const q = toLayout(f, p, lay.defs);
          if ((left.get(p.def) ?? 0) <= 0) {
            if (q && lean) extras.push(q);
            else if (q && lay.fitError(q.def, q.x, q.y, q.rot, room) === null) lay.push(q);
            continue;
          }
          left.set(p.def, (left.get(p.def) as number) - 1);
          if (!q || lay.fitError(q.def, q.x, q.y, q.rot, room) !== null) { ok = false; break; }
          lay.push(q);
        }
        const works = (): boolean => roomProblems(floor, at, lay.modules.slice(start), lay.defs).length === 0;
        // The rest where the room still works with them (a spot by a wall can block its own way in).
        for (const [id, n] of want) {
          for (let k = got.get(id) ?? 0; ok && k < n; k++) ok = !!placeOne(lay, rng, id, [room], { rots: rots(id), ok: works });
        }
        if (ok && works()) {
          for (const q of extras) {
            if (lay.fitError(q.def, q.x, q.y, q.rot, room) !== null) continue;
            lay.push(q);
            if (!works()) lay.pop();
          }
          return lay.modules.slice(start).map((_, i) => start + i);
        }
        undo();
      }
    }
  }
  return null;
}

/** What a plainly placed module brings flush against it on a station: a refinery its ore bin (its feed). */
const FEEDS: Readonly<Record<string, string>> = { 'module.refinery': 'module.storage_ore' };

/**
 * A module set plainly (no rule fit its room) with its feed flush against it, where one fits and the room is no worse:
 * the first free spot round its sides. Returns the feed's index, or null.
 */
export function placeFeed(lay: Layout, room: number, idx: number): number | null {
  const m = lay.modules[idx], feed = m && FEEDS[m.def], def = m && lay.defs[m.def], fd = feed && lay.defs[feed];
  if (!m || !feed || !def || !fd) return null;
  const [w, h] = rotatedSize(def, m.rot);
  const floor = (x: number, y: number): boolean => lay.inBounds(x, y) && lay.at(x, y) === '_' && lay.roomOf[y * lay.w + x] === room;
  const at = entriesOf(lay, room).map((e) => e.at);
  const problems = (): number => roomProblems(floor, at, lay.modules.filter((q) => lay.roomOf[q.y * lay.w + q.x] === room), lay.defs).length;
  // An odd-shaped room may have problems of its own already: the feed only must not add one.
  const before = problems();
  for (const rot of [0, 1, 2, 3]) {
    const [fw, fh] = rotatedSize(fd, rot);
    const spots: [number, number][] = [];
    for (let y = m.y - fh + 1; y < m.y + h; y++) spots.push([m.x - fw, y], [m.x + w, y]);
    for (let x = m.x - fw + 1; x < m.x + w; x++) spots.push([x, m.y - fh], [x, m.y + h]);
    for (const [x, y] of spots) {
      if (lay.fitError(feed, x, y, rot, room) !== null) continue;
      lay.push({ def: feed, x, y, rot });
      if (problems() <= before) return lay.modules.length - 1;
      lay.pop();
    }
  }
  return null;
}
