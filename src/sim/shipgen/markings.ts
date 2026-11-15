/**
 * Deck markings drawn along tile edges, derived from a generated layout: walkway lines along corridor walls, door aprons, keep-clear
 * boxes in front of furniture, hazard bands round dangerous rooms. Each kind is a per-tile edge mask (bit N/E/S/W set = a line along
 * that edge of the tile, painted on that tile's floor), so corners, T-joins and line ends need no piece art: the renderer draws one
 * segment per set bit. Pure: no storage, no rolls; whatever stores markings stamps these masks.
 */
import type { ModuleDef } from '../registry';
import { accessTiles, footprintTiles } from '../modules/footprint';
import type { GenResult } from './types';

/** Edge bits of a mask. */
export const N = 1, E = 2, S = 4, W = 8;
const SIDES = [[N, 0, -1], [E, 1, 0], [S, 0, 1], [W, -1, 0]] as const;

export type EdgeMarking = 'walkway' | 'apron' | 'keepClear' | 'hazard';
/** One mask per marking kind, row-major over the layout (0 = no line on that tile). */
export type EdgeMarkings = Record<EdgeMarking, Uint8Array>;

/**
 * How far in from its edge each kind's line is drawn, as a fraction of a tile (0 on the edge, 0.5 the tile's middle): the masks say which
 * edge, the renderer offsets toward the tile's centre by this. Tuned by eye; a wall's base hides a line drawn right on the edge.
 */
export const MARK_INSET: Readonly<Record<EdgeMarking, number>> = { walkway: 0.25, apron: 0.1, keepClear: 0.1, hazard: 0.1 };

/** Room roles whose floor carries a hazard band along its walls. */
export const HAZARD_ROLES: ReadonlySet<string> = new Set(['reactor', 'engine', 'hangar']);

/**
 * The outline of a region: for every tile in it, the edges whose neighbour is outside it, filtered by `draw` (given the neighbour's
 * index, or -1 off the grid). The one owner of "line round a set of tiles"; every kind below is an outline of some region.
 */
export function outline(width: number, height: number, inside: (i: number) => boolean, draw: (across: number) => boolean = () => true): Uint8Array {
  const out = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = y * width + x;
    if (!inside(i)) continue;
    let m = 0;
    for (const [bit, dx, dy] of SIDES) {
      const nx = x + dx, ny = y + dy;
      const j = nx < 0 || ny < 0 || nx >= width || ny >= height ? -1 : ny * width + nx;
      if ((j < 0 || !inside(j)) && draw(j)) m |= bit;
    }
    out[i] = m;
  }
  return out;
}

/** Derive every edge marking of a generated layout. `defs` are the module defs (content.modules). */
export function edgeMarkings(g: GenResult, defs: Record<string, ModuleDef>): EdgeMarkings {
  const { width: Wd, height: Ht } = g;
  const ch = (i: number): string => (i < 0 ? '.' : g.template.rows[Math.floor(i / Wd)]?.[i % Wd] ?? '.');
  const role = (i: number): string | undefined => g.rooms[g.roomOf[i] ?? -1]?.role;
  const floor = (i: number): boolean => ch(i) === '_';
  const hall = (i: number): boolean => i >= 0 && floor(i) && ((g.roomOf[i] ?? -1) < 0 || role(i) === 'hall');
  const at = (x: number, y: number): number => (x < 0 || y < 0 || x >= Wd || y >= Ht ? -1 : y * Wd + x);
  // Tiles under furniture, and the tiles crew stand on to use it.
  const blocked = new Uint8Array(Wd * Ht), access = new Uint8Array(Wd * Ht);
  for (const m of g.template.modules ?? []) {
    const def = defs[m.def];
    if (!def) continue;
    const rot = m.rot ?? 0;
    for (const t of footprintTiles(def, m.x, m.y, rot)) { const i = at(t.x, t.y); if (i >= 0) blocked[i] = 1; }
    if (def.keepClear) for (const t of accessTiles(def, m.x, m.y, rot)) { const i = at(t.x, t.y); if (i >= 0) access[i] = 1; }
  }

  // Walkway: edge lines along a corridor's walls (drawn `MARK_INSET.walkway` in from them), stopping at its doors and openings.
  const walkway = outline(Wd, Ht, hall, (j) => ch(j) === '#');

  // Apron: a threshold line on each floor tile's edge that faces a door.
  const apron = outline(Wd, Ht, floor, (j) => ch(j) === 'D');

  // Keep clear: boxes round the open access tiles of modules flagged `keepClear` (adjacent ones merge into one box).
  const keepClear = outline(Wd, Ht, (i) => !!access[i] && floor(i) && !blocked[i]);

  // Hazard: a band along the walls of a dangerous room's floor (not across its doors or into the corridor).
  const hazard = outline(Wd, Ht, (i) => floor(i) && HAZARD_ROLES.has(role(i) ?? ''), (j) => ch(j) === '#');

  return { walkway, apron, keepClear, hazard };
}
