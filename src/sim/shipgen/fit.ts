import type { Rng } from '../rng';
import { footprintTiles, rotatedSize } from '../modules/footprint';
import type { ModuleDef } from '../registry';
import type { Layout, PlacedModule } from './layout';

/** Rotations the generator uses per module: the ones the hand-made templates use (and the art covers). */
export function rotsOf(defId: string, def: ModuleDef): number[] {
  if (def.engine) return [1]; // engines on the camera-facing stern (+x) hull
  if (def.airlock) return [0, 2, 3];
  if (defId === 'module.bed') return [1, 3, 0];
  if (defId === 'module.lifeSupport') return [0, 1, 3];
  if (defId === 'module.storage') return [0, 2];
  return [0];
}

/** How snugly a footprint hugs walls (tiles of its rim that touch a wall or another room), plus a little noise. */
function hugScore(lay: Layout, def: ModuleDef, x: number, y: number, rot: number, room: number): number {
  const [w, h] = rotatedSize(def, rot);
  let s = 0;
  for (const t of footprintTiles(def, x, y, rot)) {
    const rim = [[t.x - 1, t.y], [t.x + 1, t.y], [t.x, t.y - 1], [t.x, t.y + 1]] as const;
    for (const [nx, ny] of rim) {
      if (nx >= x && ny >= y && nx < x + w && ny < y + h) continue;
      const c = lay.at(nx, ny);
      const i = ny * lay.w + nx;
      if (c === '#' || c === '.' || (lay.inBounds(nx, ny) && lay.roomOf[i] !== room)) s += c === 'D' ? -3 : 1;
      else if (lay.inBounds(nx, ny) && lay.occ[i] !== -1) s += 0.5;
    }
  }
  return s;
}

/**
 * Place one module in one of `rooms` (tried in order), at the snuggest position that keeps the ship connected.
 * Returns the placement or null.
 */
export function placeOne(
  lay: Layout, rng: Rng, defId: string, rooms: readonly number[], opts: { rots?: number[]; spread?: boolean } = {},
): PlacedModule | null {
  const def = lay.defs[defId];
  if (!def) return null;
  const rots = opts.rots ?? rotsOf(defId, def);
  for (const room of rooms) {
    const tiles = lay.roomTiles(room);
    if (tiles.length === 0) continue;
    let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
    for (const i of tiles) {
      const x = i % lay.w; const y = Math.floor(i / lay.w);
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
    const cands: { pm: PlacedModule; score: number }[] = [];
    for (const rot of rots) {
      const [w, h] = rotatedSize(def, rot);
      for (let y = y0 - h; y <= y1 + 1; y++) {
        for (let x = x0 - w; x <= x1 + 1; x++) {
          if (lay.fitError(defId, x, y, rot, room)) continue;
          let score = hugScore(lay, def, x, y, rot, room) + rng.next() * 1.5;
          if (opts.spread) score += distToModules(lay, x + w / 2, y + h / 2) * 0.6;
          cands.push({ pm: { def: defId, x, y, rot }, score });
        }
      }
    }
    cands.sort((a, b) => b.score - a.score);
    for (const c of cands.slice(0, 40)) {
      lay.push(c.pm);
      if ((!def.solid && !def.airlock) || lay.connected()) return c.pm;
      lay.pop();
    }
  }
  return null;
}

/** Distance from a point to the nearest placed module's centre (capped), to spread repeats out. */
function distToModules(lay: Layout, cx: number, cy: number): number {
  let best = 6;
  for (const m of lay.modules) {
    const d = lay.defs[m.def] as ModuleDef;
    const [w, h] = rotatedSize(d, m.rot);
    best = Math.min(best, Math.hypot(m.x + w / 2 - cx, m.y + h / 2 - cy));
  }
  return best;
}

/** Light radius the generator plans with (inside the module's 7). */
const LIGHT_REACH = 4.5;

/** Lights until every floor tile of the room is within reach of one, preferring wall-side tiles. */
export function lightRoom(lay: Layout, rng: Rng, room: number): void {
  const tiles = lay.roomTiles(room);
  const lit = new Uint8Array(lay.cells.length);
  const covers = (a: number, b: number): boolean =>
    Math.hypot((a % lay.w) - (b % lay.w), Math.floor(a / lay.w) - Math.floor(b / lay.w)) <= LIGHT_REACH;
  for (const m of lay.modules) {
    if (m.def !== 'module.light') continue;
    const li = m.y * lay.w + m.x;
    if (lay.roomOf[li] === room) for (const t of tiles) if (covers(li, t)) lit[t] = 1;
  }
  for (let guard = 0; guard < 12; guard++) {
    const dark = tiles.filter((t) => !lit[t]);
    if (dark.length === 0) return;
    let best = -1;
    let bestScore = -1;
    for (const c of tiles) {
      if (lay.occ[c] !== -1 || lay.fitError('module.light', c % lay.w, Math.floor(c / lay.w), 0, room)) continue;
      const wallSide = lay.neighbours(c).some((n) => lay.cells[n] === '#') ? 1.5 : 0;
      const score = dark.filter((d) => covers(c, d)).length + wallSide + rng.next();
      if (score > bestScore) { bestScore = score; best = c; }
    }
    if (best < 0) return;
    lay.push({ def: 'module.light', x: best % lay.w, y: Math.floor(best / lay.w), rot: 0 });
    for (const t of tiles) if (covers(best, t)) lit[t] = 1;
  }
}
