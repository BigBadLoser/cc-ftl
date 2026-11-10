/**
 * A design as the lab holds it: the template (what the game builds from) plus the rooms read off it, ready to draw and to pick
 * in. Built from a generator's result or a hand-made template; step 1 never edits it.
 */
import type { GenResult, ModuleDef, ShipTemplate } from '../../src/sim';
import { footprintTiles } from '../../src/sim';
import { defs, isLamp, moduleCode, NAMES } from '../shipgen/labels';

export interface DesignModule {
  index: number;
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
}
/** What the pointer or a list names: a room or a module. */
export type Target = { kind: 'room'; id: number } | { kind: 'module'; index: number };

export function designOf(g: GenResult, label: string): Design {
  const { width, height } = g;
  const rows = g.template.rows.map((r) => r.padEnd(width, '.'));
  const sums = new Map<number, [number, number, number]>();
  for (let i = 0; i < width * height; i++) {
    const r = g.roomOf[i] ?? -1;
    if (r < 0) continue;
    const m = sums.get(r) ?? [0, 0, 0];
    m[0] += i % width; m[1] += Math.floor(i / width); m[2]++;
    sums.set(r, m);
  }
  const rooms: DesignRoom[] = g.rooms.map((rm, id) => {
    const [sx, sy, n] = sums.get(id) ?? [0, 0, 0];
    const role = String(rm.role);
    return { id, role, name: NAMES[role] ?? '', tiles: n, cx: n ? sx / n : 0, cy: n ? sy / n : 0 };
  });
  const modules: DesignModule[] = (g.template.modules ?? []).map((m, index) => {
    const def = defs[m.def] as ModuleDef | undefined;
    const tiles = def ? footprintTiles(def, m.x, m.y, m.rot).map((t): [number, number] => [t.x, t.y]) : [[m.x, m.y] as [number, number]];
    const name = def?.name ?? m.def;
    const lamp = isLamp(def);
    const xs = tiles.map((t) => t[0]), ys = tiles.map((t) => t[1]);
    return {
      index, def: m.def, name, code: lamp ? '' : moduleCode(name), lamp, x: m.x, y: m.y, rot: m.rot, tiles,
      w: Math.max(...xs) - Math.min(...xs) + 1, h: Math.max(...ys) - Math.min(...ys) + 1,
    };
  });
  return { label, width, height, template: g.template, rows, roomOf: g.roomOf, rooms, modules, problems: g.problems };
}

/** The module on a tile (lamps count last), else the room, else nothing. */
export function targetAt(d: Design, x: number, y: number): Target | null {
  if (x < 0 || y < 0 || x >= d.width || y >= d.height) return null;
  let lamp: DesignModule | undefined;
  for (const m of d.modules) {
    if (!m.tiles.some((t) => t[0] === x && t[1] === y)) continue;
    if (m.lamp) lamp ??= m;
    else return { kind: 'module', index: m.index };
  }
  if (lamp) return { kind: 'module', index: lamp.index };
  const r = d.roomOf[y * d.width + x] ?? -1;
  return r >= 0 ? { kind: 'room', id: r } : null;
}

/** The tiles a target covers. */
export function tilesOf(d: Design, t: Target | null): [number, number][] {
  if (!t) return [];
  if (t.kind === 'module') return d.modules[t.index]?.tiles ?? [];
  const out: [number, number][] = [];
  for (let i = 0; i < d.roomOf.length; i++) if (d.roomOf[i] === t.id) out.push([i % d.width, Math.floor(i / d.width)]);
  return out;
}

export const sameTarget = (a: Target | null, b: Target | null): boolean =>
  !!a && !!b && a.kind === b.kind && (a.kind === 'room' ? a.id === (b as typeof a).id : a.index === (b as typeof a).index);

export function describe(d: Design, t: Target | null): string {
  if (!t) return '';
  if (t.kind === 'module') { const m = d.modules[t.index]; return m ? `${m.name} at ${m.x}, ${m.y}` : ''; }
  const r = d.rooms[t.id];
  return r ? `${r.name || (r.role === 'hall' ? 'corridor' : r.role)} (${r.tiles} tiles)` : '';
}
