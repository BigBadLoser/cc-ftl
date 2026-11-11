/**
 * A design as the lab holds it: the template (what the game builds from) plus the rooms read off it, ready to draw and to pick
 * in. Built from a generator's result or a hand-made template; step 1 never edits it.
 */
import type { ModuleDef, ShipTemplate } from '../../src/sim';
import { defs, isLamp, moduleCode, NAMES } from '../shipgen/labels';
import { moduleTiles, toTemplate, type Layout } from './layout';

export interface DesignModule {
  /** Position in the layout's module list (changes with edits; picks and selections hold `id`). */
  index: number;
  /** The module's stable id (Layout.moduleIds). */
  id: number;
  def: string;
  name: string;
  /** The two-letter code (the labelled view's), empty for lamps. */
  code: string;
  lamp: boolean;
  x: number;
  y: number;
  rot: number;
  w: number;
  h: number;
  tiles: [number, number][];
}
export interface DesignRoom {
  id: number;
  role: string;
  /** The name on the view ('cabin'); empty for corridors. */
  name: string;
  tiles: number;
  /** Mean tile centre, where the name sits. */
  cx: number;
  cy: number;
  /** Where the name is drawn (tile centre): free floor, never under a module; else the room's top edge. */
  lx: number;
  ly: number;
}
export interface Design {
  label: string;
  width: number;
  height: number;
  template: ShipTemplate;
  /** One char per tile as in the template, padded to `width` ('.' space, '#' wall, '_' floor, 'D' door, '=' beam). */
  rows: string[];
  roomOf: Int16Array;
  rooms: DesignRoom[];
  modules: DesignModule[];
  problems: string[];
  /** The data this design reads. */
  layout: Layout;
}
/** What the pointer or a list names: a room or a module. */
export type Target = { kind: 'room'; id: number } | { kind: 'module'; id: number };

/**
 * Where a room's name goes: the largest connected patch of the room's floor that no module covers, and in it the free stretch
 * of a row (at least the name's width in tiles when there is one) nearest the room's middle. A room with no free floor is
 * named along its top edge. `covered`: tile indices under modules. Pure; computed once per layout change.
 */
export function labelSpot(l: Layout, id: number, covered: ReadonlySet<number>, chars: number, cx: number, cy: number): { x: number; y: number } {
  const { width: w } = l;
  const floor = (i: number): boolean => l.roomOf[i] === id && l.cells[Math.floor(i / w)]?.[i % w] === '_';
  const free = new Set<number>();
  let top = Infinity;
  const topXs: number[] = [];
  for (let i = 0; i < l.roomOf.length; i++) {
    if (!floor(i)) continue;
    const y = Math.floor(i / w);
    if (y < top) { top = y; topXs.length = 0; }
    if (y === top) topXs.push(i % w);
    if (!covered.has(i)) free.add(i);
  }
  if (!free.size) return { x: topXs.length ? topXs.reduce((a, b) => a + b, 0) / topXs.length : cx, y: top === Infinity ? cy : top };
  // connected patches of free floor (4-neighbour); keep the largest
  const seen = new Set<number>();
  let best: number[] = [];
  for (const start of free) {
    if (seen.has(start)) continue;
    const patch: number[] = [], stack = [start];
    seen.add(start);
    while (stack.length) {
      const i = stack.pop() as number;
      patch.push(i);
      const x = i % w;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) if (free.has(j) && !seen.has(j)) { seen.add(j); stack.push(j); }
    }
    if (patch.length > best.length) best = patch;
  }
  const patch = new Set(best);
  const need = Math.ceil(chars * 0.55);
  let pick = { x: cx, y: cy }, bestFit = -1, bestDist = Infinity;
  for (const i of best) {
    const x = i % w, y = Math.floor(i / w);
    if (patch.has(i - 1)) continue; // runs are scored from their left end
    let run = 0;
    while (patch.has(i + run)) run++;
    const mid = x + (run - 1) / 2;
    const fit = Math.min(run, need), dist = Math.hypot(mid - cx, y - cy);
    if (fit > bestFit || (fit === bestFit && dist < bestDist)) { bestFit = fit; bestDist = dist; pick = { x: mid, y }; }
  }
  return pick;
}

/** A design from a layout: the template with the derived hull, the rooms read off it. */
export function designFromLayout(l: Layout, label: string): Design {
  const template = toTemplate(l);
  const { width, height } = l;
  const roomOf = Int16Array.from(l.roomOf);
  const sums = l.rooms.map(() => [0, 0, 0] as [number, number, number]);
  for (let i = 0; i < roomOf.length; i++) {
    const m = sums[roomOf[i] as number];
    if (m) { m[0] += i % width; m[1] += Math.floor(i / width); m[2]++; }
  }
  const covered = new Set<number>();
  for (const m of l.modules) if (!isLamp(defs[m.def] as ModuleDef | undefined)) for (const [x, y] of moduleTiles(m)) covered.add(y * width + x);
  const rooms: DesignRoom[] = l.rooms.map((rm, id) => {
    const [sx, sy, n] = sums[id] as [number, number, number];
    const name = NAMES[rm.role] ?? '';
    const cx = n ? sx / n : 0, cy = n ? sy / n : 0;
    const spot = name && n >= 10 ? labelSpot(l, id, covered, name.length, cx, cy) : { x: cx, y: cy };
    return { id, role: rm.role, name, tiles: n, cx, cy, lx: spot.x, ly: spot.y };
  });
  const modules: DesignModule[] = l.modules.map((m, index) => {
    const def = defs[m.def] as ModuleDef | undefined;
    const tiles = moduleTiles(m);
    const name = def?.name ?? m.def;
    const lamp = isLamp(def);
    const xs = tiles.map((t) => t[0]), ys = tiles.map((t) => t[1]);
    return {
      index, id: l.moduleIds[index] as number, def: m.def, name, code: lamp ? '' : moduleCode(name), lamp, x: m.x, y: m.y, rot: m.rot, tiles,
      w: Math.max(...xs) - Math.min(...xs) + 1, h: Math.max(...ys) - Math.min(...ys) + 1,
    };
  });
  return { label, width, height, template, rows: template.rows, roomOf, rooms, modules, problems: [], layout: l };
}

/** The module on a tile (lamps count last), else the room, else nothing. */
export function targetAt(d: Design, x: number, y: number): Target | null {
  if (x < 0 || y < 0 || x >= d.width || y >= d.height) return null;
  let lamp: DesignModule | undefined;
  for (const m of d.modules) {
    if (!m.tiles.some((t) => t[0] === x && t[1] === y)) continue;
    if (m.lamp) lamp ??= m;
    else return { kind: 'module', id: m.id };
  }
  if (lamp) return { kind: 'module', id: lamp.id };
  const r = d.roomOf[y * d.width + x] ?? -1;
  return r >= 0 ? { kind: 'room', id: r } : null;
}

/** The tiles a target covers. */
export function tilesOf(d: Design, t: Target | null): [number, number][] {
  if (!t) return [];
  if (t.kind === 'module') return moduleOf(d, t.id)?.tiles ?? [];
  const out: [number, number][] = [];
  for (let i = 0; i < d.roomOf.length; i++) if (d.roomOf[i] === t.id) out.push([i % d.width, Math.floor(i / d.width)]);
  return out;
}

export const sameTarget = (a: Target | null, b: Target | null): boolean =>
  !!a && !!b && a.kind === b.kind && (a.id === (b as typeof a).id);

export function describe(d: Design, t: Target | null): string {
  if (!t) return '';
  if (t.kind === 'module') { const m = moduleOf(d, t.id); return m ? `${m.name} at ${m.x}, ${m.y}` : ''; }
  const r = liveRoom(d, t.id);
  return r ? `${r.name || (r.role === 'hall' ? 'corridor' : r.role)} (${r.tiles} tiles)` : '';
}

/** A target picked on design `shown` as a target in design `edited`, by stable id (a module's id; a room's id): null when it no longer exists there. */
export function retarget(shown: Design, edited: Design, t: Target | null): Target | null {
  if (!t || shown === edited) return t;
  return exists(edited, t) ? t : null;
}

/** The module with this stable id in a design, if it is still there. */
export const moduleOf = (d: Design, id: number): DesignModule | undefined => d.modules.find((m) => m.id === id);
/** A room that exists: it has tiles (a deleted room, or an empty padding room added for an id gap, does not). */
export const liveRoom = (d: Design, id: number): DesignRoom | undefined => { const r = d.rooms[id]; return r && r.tiles > 0 ? r : undefined; };
/** Whether the target names something in this design now (selection, hover and the rest are cleared when it does not). */
export const exists = (d: Design, t: Target | null): boolean => !!t && (t.kind === 'module' ? !!moduleOf(d, t.id) : !!liveRoom(d, t.id));
