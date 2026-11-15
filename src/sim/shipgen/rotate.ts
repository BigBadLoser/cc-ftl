import type { ModuleDef } from '../registry';
import { rotatedSize } from '../modules/footprint';
import type { GenResult } from './types';

const CLAMP = { n: 'e', e: 's', s: 'w', w: 'n' } as const;

/**
 * A generated layout turned a quarter clockwise: its rows and floor finishes, its rooms, and every module (its corner,
 * its turn, the side a container is clamped by). Tile (x, y) of a W x H layout goes to (H - 1 - y, x) of an H x W one.
 * Viewer debug (positions of assemblies) is dropped. For callers that need a side of the layout to face a given way (an asteroid outpost's dock faces north or south).
 */
export function rotateLayout<T extends GenResult>(r: T, defs: Record<string, ModuleDef>): T {
  const W = r.width, H = r.height;
  const turn = (rows: readonly string[]): string[] => Array.from({ length: W }, (_, y) => Array.from({ length: H }, (_, x) => rows[H - 1 - x]?.[y] ?? '.').join(''));
  const at = (i: number): number => { const x = i % W, y = (i - x) / W; return x * H + (H - 1 - y); };
  const roomOf = new Int16Array(W * H).fill(-1);
  for (let i = 0; i < r.roomOf.length; i++) roomOf[at(i)] = r.roomOf[i] as number;
  const modules = (r.template.modules ?? []).map((m) => {
    const def = defs[m.def], [, h] = def ? rotatedSize(def, m.rot) : [1, 1];
    return { ...m, x: H - m.y - h, y: m.x, rot: (m.rot + 1) % 4, ...(m.clamp ? { clamp: CLAMP[m.clamp] } : {}) };
  });
  const template = { ...r.template, rows: turn(r.template.rows), ...(r.template.floors ? { floors: turn(r.template.floors) } : {}), modules };
  return { ...r, template, roomOf, rooms: r.rooms.map((room) => ({ ...room, tiles: room.tiles.map(at) })), width: H, height: W, debug: undefined };
}
