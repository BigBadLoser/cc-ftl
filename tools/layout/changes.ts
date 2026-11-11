/**
 * The change list: what separates an edited layout from the one it started as, in plain sentences an agent (or a person) can read
 * without opening the lab. Tile edits are grouped into regions and placed relative to the nearest room ("north of the hangar").
 */
import { content } from '../../src/content';
import type { ModuleDef } from '../../src/sim';
import { isLamp, moduleCode, NAMES } from '../shipgen/labels';
import { moduleTiles, roomRect, type Layout, type Tile, type TemplateModule } from './layout';
import { shipChanges } from './ship';
import { kindOf, type Kind } from './tileKinds';

/** One line of the change list and the tiles it is about (to centre on and flash). */
export interface Change { text: string; tiles: Tile[] }
const roomTiles = (l: Layout, id: number): Tile[] => { const t: Tile[] = []; for (let i = 0; i < l.roomOf.length; i++) if (l.roomOf[i] === id && l.cells[Math.floor(i / l.width)]?.[i % l.width] === '_') t.push([i % l.width, Math.floor(i / l.width)]); return t; };

const defs = content.modules as Record<string, ModuleDef>;
const roleName = (role: string): string => (role === 'hall' ? 'corridor' : NAMES[role] ?? role);

interface RoomBox { id: number; name: string; x0: number; y0: number; x1: number; y1: number; cx: number; cy: number }
/** The rooms of a layout with their bounding box and middle (those with floor). */
function boxes(l: Layout): RoomBox[] {
  const out: RoomBox[] = [];
  l.rooms.forEach((r, id) => {
    let n = 0, sx = 0, sy = 0, x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
    for (let i = 0; i < l.roomOf.length; i++) {
      if (l.roomOf[i] !== id) continue;
      const x = i % l.width, y = Math.floor(i / l.width);
      if (l.cells[y]?.[x] !== '_') continue;
      n++; sx += x; sy += y; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
    if (n) out.push({ id, name: roleName(r.role), x0, y0, x1, y1, cx: sx / n, cy: sy / n });
  });
  return out;
}
/** "the hangar" when the name is unique among the rooms, else "the cargo (room 3)". */
const called = (b: RoomBox, all: readonly RoomBox[]): string => (all.filter((r) => r.name === b.name).length === 1 ? `the ${b.name}` : `the ${b.name} (room ${b.id})`);

/** Where a set of tiles is: inside, or on a side of, the nearest room; else plain coordinates. */
export function whereIs(tiles: readonly [number, number][], rooms: readonly RoomBox[]): string {
  const cx = tiles.reduce((s, t) => s + t[0], 0) / tiles.length, cy = tiles.reduce((s, t) => s + t[1], 0) / tiles.length;
  let best: RoomBox | undefined, gap = Infinity;
  for (const r of rooms) {
    const dx = Math.max(r.x0 - cx, 0, cx - r.x1), dy = Math.max(r.y0 - cy, 0, cy - r.y1);
    const g = Math.hypot(dx, dy);
    if (g < gap) { gap = g; best = r; }
  }
  if (!best || gap > 8) return `around (${Math.round(cx)},${Math.round(cy)})`;
  if (gap === 0) return `in ${called(best, rooms)}`;
  const dx = cx - best.cx, dy = cy - best.cy;
  const dir = Math.abs(dy) >= Math.abs(dx) ? (dy < 0 ? 'north' : 'south') : dx < 0 ? 'west' : 'east';
  return `${dir} of ${called(best, rooms)}`;
}

const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;
function sentence(kind: Kind, tiles: [number, number][], where: string): string {
  const n = tiles.length;
  const first = tiles[0] as [number, number];
  switch (kind) {
    case 'door added': return n === 1 ? `Added a door at (${first[0]},${first[1]})` : `Added ${plural(n, 'door')} ${where}`;
    case 'door removed': return n === 1 ? `Removed the door at (${first[0]},${first[1]})` : `Removed ${plural(n, 'door')} ${where}`;
    case 'floor added': return `Added ${plural(n, 'floor tile')} ${where}`;
    case 'floor removed': return `Removed ${plural(n, 'floor tile')} ${where}`;
    case 'wall added': return `Added ${plural(n, 'wall tile')} ${where}`;
    case 'wall removed': return `Removed ${plural(n, 'wall tile')} ${where}`;
    case 'floor to wall': return `Turned ${plural(n, 'floor tile')} into wall ${where}`;
    case 'wall to floor': return `Turned ${plural(n, 'wall tile')} into floor ${where}`;
    case 'beam added': return `Added ${plural(n, 'beam tile')} ${where}`;
    case 'beam removed': return `Removed ${plural(n, 'beam tile')} ${where}`;
    case 'beam to floor': return `Turned ${plural(n, 'beam tile')} into floor ${where}`;
    case 'beam to wall': return `Turned ${plural(n, 'beam tile')} into wall ${where}`;
    case 'floor to beam': return `Turned ${plural(n, 'floor tile')} into beam ${where}`;
    default: return `Turned ${plural(n, 'wall tile')} into beam ${where}`;
  }
}

/** Tile edits as regions (8-connected tiles that changed the same way), in reading order. */
function tileChanges(a: Layout, b: Layout, rooms: readonly RoomBox[]): Change[] {
  // a room drawn in the edit is one line of its own: its floor and the wall ring round it are not listed again
  const added = rooms.filter((r) => r.id >= a.rooms.length || !boxes(a).some((x) => x.id === r.id));
  const inAdded = (x: number, y: number): boolean => added.some((r) => x >= r.x0 - 1 && x <= r.x1 + 1 && y >= r.y0 - 1 && y <= r.y1 + 1);
  const byKind = new Map<Kind, Set<number>>();
  for (let y = 0; y < Math.min(a.height, b.height); y++) {
    for (let x = 0; x < Math.min(a.width, b.width); x++) {
      const k = kindOf(a.cells[y]?.[x] ?? '.', b.cells[y]?.[x] ?? '.');
      if (!k || inAdded(x, y)) continue;
      if (!byKind.has(k)) byKind.set(k, new Set());
      (byKind.get(k) as Set<number>).add(y * b.width + x);
    }
  }
  const out: { y: number; x: number; text: string; tiles: Tile[] }[] = [];
  for (const [kind, set] of byKind) {
    const seen = new Set<number>();
    for (const start of [...set].sort((p, q) => p - q)) {
      if (seen.has(start)) continue;
      const region: [number, number][] = [];
      const stack = [start];
      seen.add(start);
      while (stack.length) {
        const i = stack.pop() as number;
        const x = i % b.width, y = Math.floor(i / b.width);
        region.push([x, y]);
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          const j = ny * b.width + nx;
          if ((dx || dy) && nx >= 0 && nx < b.width && ny >= 0 && set.has(j) && !seen.has(j)) { seen.add(j); stack.push(j); }
        }
      }
      region.sort((p, q) => p[1] - q[1] || p[0] - q[0]);
      out.push({ y: region[0]?.[1] ?? 0, x: region[0]?.[0] ?? 0, text: sentence(kind, region, whereIs(region, rooms)), tiles: region });
    }
  }
  return out.sort((p, q) => p.y - q.y || p.x - q.x).map((o) => ({ text: o.text, tiles: o.tiles }));
}

function moduleName(m: TemplateModule): string {
  const def = defs[m.def];
  if (!def) return m.def;
  return isLamp(def) ? 'lamp' : `${def.name.toLowerCase()} ${moduleCode(def.name)}`;
}
const at = (m: TemplateModule): string => `(${m.x},${m.y})`;

function moduleChanges(a: Layout, b: Layout, rooms: readonly RoomBox[]): Change[] {
  const out: Change[] = [];
  const idsB = new Set(b.moduleIds);
  const idsA = new Set(a.moduleIds);
  a.moduleIds.forEach((id, i) => {
    const m = a.modules[i] as TemplateModule;
    const j = b.moduleIds.indexOf(id);
    const n = b.modules[j];
    if (!n) return;
    const moved = m.x !== n.x || m.y !== n.y, turned = m.rot !== n.rot;
    const tiles = moduleTiles(n);
    if (moved && turned) out.push({ text: `Moved ${moduleName(m)} from ${at(m)} to ${at(n)} and turned it to ${n.rot * 90} deg`, tiles });
    else if (moved) out.push({ text: `Moved ${moduleName(m)} from ${at(m)} to ${at(n)}`, tiles });
    else if (turned) out.push({ text: `Turned ${moduleName(m)} at ${at(m)} from ${m.rot * 90} to ${n.rot * 90} deg`, tiles });
  });
  const roomAt = (l: Layout, m: TemplateModule): string => {
    const r = l.roomOf[m.y * l.width + m.x] ?? -1;
    const box = rooms.find((x) => x.id === r);
    return box ? ` in ${called(box, rooms)}` : '';
  };
  const group = (verb: string, l: Layout, ids: number[]): void => {
    const by = new Map<string, TemplateModule[]>();
    for (const id of ids) { const m = l.modules[l.moduleIds.indexOf(id)] as TemplateModule; by.set(moduleName(m), [...(by.get(moduleName(m)) ?? []), m]); }
    for (const [name, ms] of by) {
      if (ms.length > 3) out.push({ text: `${verb} ${ms.length} x ${name}`, tiles: ms.flatMap(moduleTiles) });
      else for (const m of ms) out.push({ text: `${verb} ${name} ${verb === 'Added' ? 'at' : 'from'} ${at(m)}${roomAt(l, m)}`, tiles: moduleTiles(m) });
    }
  };
  group('Added', b, b.moduleIds.filter((id) => !idsA.has(id)));
  group('Removed', a, a.moduleIds.filter((id) => !idsB.has(id)));
  return out;
}

function roomChanges(a: Layout, b: Layout): Change[] {
  const out: Change[] = [];
  const n = Math.max(a.rooms.length, b.rooms.length);
  for (let id = 0; id < n; id++) {
    const ra = a.rooms[id], rb = b.rooms[id];
    const ba = ra ? roomRect(a, id) : null, bb = rb ? roomRect(b, id) : null;
    if (ra && rb && ra.role !== rb.role && bb) out.push({ text: `Retyped room ${id} ${roleName(ra.role)} → ${roleName(rb.role)}`, tiles: roomTiles(b, id) });
    if (!ba && bb && rb) out.push({ text: `Added room ${id} ${roleName(rb.role)}, ${bb.w}x${bb.h} at (${bb.x},${bb.y})`, tiles: roomTiles(b, id) });
    else if (ba && !bb && ra) out.push({ text: `Removed room ${id} (${roleName(ra.role)})`, tiles: roomTiles(a, id) });
    else if (ba && bb && rb && (ba.w !== bb.w || ba.h !== bb.h || ba.x !== bb.x || ba.y !== bb.y)) {
      out.push({ text: `Resized room ${id} ${roleName(rb.role)} from ${ba.w} x ${ba.h} at (${ba.x},${ba.y}) to ${bb.w} x ${bb.h} at (${bb.x},${bb.y})`, tiles: roomTiles(b, id) });
    }
  }
  return out;
}

/** Everything that differs between `a` (the original) and `b` (the edited design), as sentences with the tiles each is about. */
export function changeItems(a: Layout, b: Layout): Change[] {
  const inB = boxes(b);
  const rooms = [...inB, ...boxes(a).filter((r) => !inB.some((x) => x.id === r.id))];
  return [...shipChanges(a, b).map((text): Change => ({ text, tiles: [] })), ...roomChanges(a, b), ...moduleChanges(a, b, rooms), ...tileChanges(a, b, rooms)];
}
/** The sentences alone (what a saved case stores). */
export const describeChanges = (a: Layout, b: Layout): string[] => changeItems(a, b).map((c) => c.text);
