/**
 * What differs between the original layout and the edited one, as data the compare view draws: tiles added, removed or changed,
 * modules added, removed or moved (matched by their stable id), and rooms added, removed or retyped.
 */
import { kindOf, overlayKind } from './tileKinds';
import { moduleTiles, type Layout, type TemplateModule, type Tile } from './layout';

export type TileKind = 'added' | 'removed' | 'changed';
export interface TileDiff { x: number; y: number; kind: TileKind }
export interface ModuleDiff {
  kind: 'added' | 'removed' | 'moved';
  id: number;
  /** Where it was (removed, moved) and where it is (added, moved). */
  from?: TemplateModule;
  to?: TemplateModule;
}
export interface RoomDiff { kind: 'added' | 'removed' | 'retyped'; id: number; from?: string; to?: string }
export interface Diff { tiles: TileDiff[]; modules: ModuleDiff[]; rooms: RoomDiff[] }

const hasFloor = (l: Layout, id: number): boolean => l.roomOf.some((r, i) => r === id && l.cells[Math.floor(i / l.width)]?.[i % l.width] === '_');

export function diffLayouts(a: Layout, b: Layout): Diff {
  const tiles: TileDiff[] = [];
  for (let y = 0; y < Math.min(a.height, b.height); y++) {
    for (let x = 0; x < Math.min(a.width, b.width); x++) {
      const k = kindOf(a.cells[y]?.[x] ?? '.', b.cells[y]?.[x] ?? '.');
      if (k) tiles.push({ x, y, kind: overlayKind(k) });
    }
  }
  const modules: ModuleDiff[] = [];
  a.moduleIds.forEach((id, i) => {
    const from = a.modules[i] as TemplateModule;
    const to = b.modules[b.moduleIds.indexOf(id)];
    if (!to) modules.push({ kind: 'removed', id, from });
    else if (from.x !== to.x || from.y !== to.y || from.rot !== to.rot) modules.push({ kind: 'moved', id, from, to });
  });
  b.moduleIds.forEach((id, i) => { if (!a.moduleIds.includes(id)) modules.push({ kind: 'added', id, to: b.modules[i] as TemplateModule }); });
  const rooms: RoomDiff[] = [];
  const n = Math.max(a.rooms.length, b.rooms.length);
  for (let id = 0; id < n; id++) {
    const ra = a.rooms[id], rb = b.rooms[id];
    const inA = !!ra && hasFloor(a, id), inB = !!rb && hasFloor(b, id);
    if (!inA && inB && rb) rooms.push({ kind: 'added', id, to: rb.role });
    else if (inA && !inB && ra) rooms.push({ kind: 'removed', id, from: ra.role });
    else if (inA && inB && ra && rb && ra.role !== rb.role) rooms.push({ kind: 'retyped', id, from: ra.role, to: rb.role });
  }
  return { tiles, modules, rooms };
}

/** The tiles of a diff entry's module at its old and new spot. */
export const tilesFrom = (m: ModuleDiff): Tile[] => (m.from ? moduleTiles(m.from) : []);
export const tilesTo = (m: ModuleDiff): Tile[] => (m.to ? moduleTiles(m.to) : []);
/** A module's centre in tile coordinates (for the move line). */
export function centre(m: TemplateModule): Tile {
  const t = moduleTiles(m);
  return [t.reduce((s, p) => s + p[0], 0) / t.length, t.reduce((s, p) => s + p[1], 0) / t.length];
}
