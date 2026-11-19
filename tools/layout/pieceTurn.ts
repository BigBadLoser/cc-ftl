/**
 * Turning and mirroring a piece (the Move tool's R and H). Tiles, rooms, template rows and windows map exactly. A module turns with the
 * piece the way the game turns one (clockwise, `rotateOffset`); a mirror has no mirrored module, so a module keeps its facing along the
 * mirror and turns round across it, its footprint landing on the mirrored tiles (a container's clamp side follows).
 */
import { moduleDef, type TemplateModule, type Tile } from './layout';
import type { Piece } from './region';
import { windowTiles } from './windows';
import { rotatedSize } from '../../src/sim/modules/footprint';

export type Turn = 'cw' | 'ccw' | 'mirror-x' | 'mirror-y';
const SIDES = ['n', 'e', 's', 'w'] as const;
type Side = (typeof SIDES)[number];

/** Where a tile of a w x h piece lands, and the piece's new size. */
function mapper(t: Turn, w: number, h: number): { f: (x: number, y: number) => Tile; w: number; h: number } {
  if (t === 'cw') return { f: (x, y) => [h - 1 - y, x], w: h, h: w };
  if (t === 'ccw') return { f: (x, y) => [y, w - 1 - x], w: h, h: w };
  if (t === 'mirror-x') return { f: (x, y) => [w - 1 - x, y], w, h };
  return { f: (x, y) => [x, h - 1 - y], w, h };
}
const turnRot = (t: Turn, rot: number): number => {
  if (t === 'cw') return (rot + 1) % 4;
  if (t === 'ccw') return (rot + 3) % 4;
  const along = t === 'mirror-x' ? rot % 2 === 0 : rot % 2 === 1; // facing along the mirror line: kept
  return along ? rot : (rot + 2) % 4;
};
const turnSide = (t: Turn, s: Side): Side => {
  const i = SIDES.indexOf(s);
  if (t === 'cw') return SIDES[(i + 1) % 4] as Side;
  if (t === 'ccw') return SIDES[(i + 3) % 4] as Side;
  if (t === 'mirror-x') return s === 'e' ? 'w' : s === 'w' ? 'e' : s;
  return s === 'n' ? 's' : s === 's' ? 'n' : s;
};
/** Remap a w x h grid of characters (rows) through the mapper. */
function remapRows(rows: readonly string[], t: Turn, w: number, h: number): string[] {
  const m = mapper(t, w, h);
  const out = Array.from({ length: m.h }, () => new Array<string>(m.w).fill('.'));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const [nx, ny] = m.f(x, y); (out[ny] as string[])[nx] = rows[y]?.[x] ?? '.'; }
  return out.map((r) => r.join(''));
}

function turnModule(mod: TemplateModule, t: Turn, w: number, h: number): TemplateModule {
  const def = moduleDef(mod.def);
  const [fw, fh] = def ? rotatedSize(def, mod.rot) : [1, 1];
  const m = mapper(t, w, h);
  // the footprint's bounding box maps to a box; its top-left is the new position
  const a = m.f(mod.x, mod.y), b = m.f(mod.x + fw - 1, mod.y + fh - 1);
  const out: TemplateModule = { ...mod, x: Math.min(a[0], b[0]), y: Math.min(a[1], b[1]), rot: turnRot(t, mod.rot) };
  if (mod.clamp) out.clamp = turnSide(t, mod.clamp);
  return out;
}

/** The piece turned a quarter (cw, ccw) or mirrored left-right (mirror-x) or top-bottom (mirror-y). */
export function turnPiece(p: Piece, t: Turn): Piece {
  const m = mapper(t, p.w, p.h);
  const roomOf = new Array<number>(m.w * m.h).fill(-1);
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) { const [nx, ny] = m.f(x, y); roomOf[ny * m.w + nx] = p.roomOf[y * p.w + x] ?? -1; }
  const rows: Piece['rows'] = {};
  for (const [k, r] of Object.entries(p.rows) as [keyof Piece['rows'], string[]][]) rows[k] = remapRows(r, t, p.w, p.h);
  const windows = p.windows.map((win) => {
    const tiles = windowTiles(win).map(([x, y]) => m.f(x, y));
    const axis = tiles.every(([, y]) => y === tiles[0]?.[1]) ? 'x' as const : 'y' as const;
    return { ...win, axis, x: Math.min(...tiles.map((q) => q[0])), y: Math.min(...tiles.map((q) => q[1])) };
  });
  return {
    ...p, w: m.w, h: m.h, cells: remapRows(p.cells, t, p.w, p.h), roomOf, rows, windows,
    modules: p.modules.map(({ m: mod, id }) => ({ m: turnModule(mod, t, p.w, p.h), id })),
  };
}
