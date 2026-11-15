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

/** A room frame on the layout: size, door column, and the map from frame tiles to layout tiles. */
export interface Frame { w: number; h: number; d: number; map: (x: number, y: number) => Tile; dir: (x: number, y: number) => Tile }

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
 * tile, the door below it. `mirror` flips it left to right. `floor` says which layout tiles are the room's.
 */
export function frameOf(floor: (x: number, y: number) => boolean, e: Entry, mirror: boolean): Frame {
  const u = { x: -e.out.x, y: -e.out.y };
  const r = mirror ? { x: u.y, y: -u.x } : { x: -u.y, y: u.x };
  const at = (a: number, b: number): Tile => ({ x: e.at.x + a * r.x + b * u.x, y: e.at.y + a * r.y + b * u.y });
  const ok = (a: number, rows: number): boolean => { for (let b = 0; b < rows; b++) { const t = at(a, b); if (!floor(t.x, t.y)) return false; } return true; };
  let best = { a0: 0, a1: 0, h: 1, area: 0 };
  for (let rows = 1; ok(0, rows) && rows < 64; rows++) {
    let a0 = 0, a1 = 0;
    while (a0 > -64 && ok(a0 - 1, rows)) a0--;
    while (a1 < 64 && ok(a1 + 1, rows)) a1++;
    if ((a1 - a0 + 1) * rows > best.area) best = { a0, a1, h: rows, area: (a1 - a0 + 1) * rows };
  }
  const { a0, a1, h } = best;
  return {
    w: a1 - a0 + 1, h, d: -a0,
    map: (x, y) => at(x + a0, h - 1 - y),
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
 * Rooms a rule may furnish on stations: a support room only when it is a mess (a galley), a suit-up room (lockers) or a gym
 * (sparring droids); every other role with a rule. A room no rule fits is left to its room recipe, except where `ruleOwns`.
 */
export function ruleRoom(role: RoomRole, need: readonly string[]): boolean {
  if (role === 'support') return need.some((m) => m === 'module.galley' || m === 'module.storage_locker' || m === 'module.exercise');
  return !!RULES[role];
}

/** Roles whose rooms keep their room recipe when no rule fits (the stores, works, bays and social rooms with a rule of their own). */
const RECIPE_FALLBACK: readonly RoomRole[] = ['bridge', 'cargo', 'armoury', 'industry', 'hangar', 'hall', 'plaza'];

/** Rooms the rules own outright: when none fits, the room's planned modules are set plainly, not by its room recipe. */
export const ruleOwns = (role: RoomRole, need: readonly string[]): boolean =>
  role === 'support' ? need.includes('module.galley') : !RECIPE_FALLBACK.includes(role) && !!RULES[role];

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
  const sizes = entries.flatMap((e) => [frameOf(floor, e, false)]);
  if (!list.some((a) => !a.when || sizes.some((f) => a.when?.(need, { ...f, defs: lay.defs })))) return null;
  const flip = rng.chance(0.5);
  const frames = entries.flatMap((e) => [frameOf(floor, e, flip), frameOf(floor, e, !flip)]);
  const want = tally(need), at = entries.map((e) => e.at);
  const start = lay.modules.length;
  const undo = (): void => { while (lay.modules.length > start) lay.pop(); };
  for (const arr of order(rng, list, need, { ...(frames[0] as Frame), defs: lay.defs })) {
    for (const f of frames) {
      if (arr.when && !arr.when(need, { ...f, defs: lay.defs })) continue;
      const pieces = arr.rule({ w: f.w, h: f.h, d: f.d, need, defs: lay.defs });
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
        for (const [id, n] of want) {
          for (let k = got.get(id) ?? 0; ok && k < n; k++) ok = !!placeOne(lay, rng, id, [room], { rots: rots(id) });
        }
        const works = (): boolean => roomProblems(floor, at, lay.modules.slice(start), lay.defs).length === 0;
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
