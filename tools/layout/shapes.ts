/**
 * Saved shapes: pieces kept by name (the Shapes panel) to place again in any design. Plain data, kept in the browser; this file holds
 * the pure parts (naming, parsing a save, the layout a thumbnail is drawn from).
 */
import { NAMES } from '../shipgen/labels';
import type { Layout } from './layout';
import { designFromLayout } from './design';
import { stamp, type Piece } from './region';

export interface Shape { id: number; name: string; piece: Piece }

/** A name for a new shape: its largest room's name as the grid shows it (by role and contents: a pantry, a brig), else "shape". */
export function shapeName(p: Piece): string {
  const big = [...designFromLayout(pieceLayout(p), 'shape').rooms].filter((r) => r.tiles > 0).sort((a, b) => b.tiles - a.tiles)[0];
  if (!big) return 'shape';
  return big.name || (big.role === 'hall' ? 'corridor' : NAMES[big.role] ?? big.role);
}

const isPiece = (p: unknown): p is Piece => {
  const q = p as Partial<Piece> | null;
  return !!q && typeof q.w === 'number' && typeof q.h === 'number' && Array.isArray(q.cells) && Array.isArray(q.roomOf) && Array.isArray(q.rooms) && Array.isArray(q.modules) && Array.isArray(q.windows) && typeof q.rows === 'object';
};
/** A saved list back into shapes: malformed entries are dropped. */
export function parseShapes(json: string | null): Shape[] {
  if (!json) return [];
  try {
    const raw = JSON.parse(json) as unknown;
    if (!Array.isArray(raw)) return [];
    return raw.filter((s): s is Shape => !!s && typeof (s as Shape).id === 'number' && typeof (s as Shape).name === 'string' && isPiece((s as Shape).piece));
  } catch { return []; }
}

/** The piece stamped on its own on a grid one tile larger all round (what a thumbnail draws). */
export function pieceLayout(p: Piece): Layout {
  const w = p.w + 2, h = p.h + 2;
  const blank: Layout = { name: 'shape', width: w, height: h, cells: Array.from({ length: h }, () => '.'.repeat(w)), roomOf: new Array<number>(w * h).fill(-1), rooms: [], modules: [], moduleIds: [], nextModuleId: 0, extra: {}, immobile: true };
  return stamp(blank, p, 1, 1, false, { module: 0, room: 0 }).layout;
}
