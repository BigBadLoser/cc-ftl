import { at, components, heavy, isHull, modTiles, N4, put, touchesSpace } from './ruinGrid';
import type { RuinCtx } from './ruinTypes';
import { tearOff } from './ruinContainers';

/**
 * Structural damage. Combat wrecks take a few clustered impacts on one flank: hull blown out, inner walls and doors torn,
 * deck plating gone at the core of each blast. Old derelicts decay from the outside: many small hull breaches spread
 * along the skin, a few rotted deck plates beside them. Heavy ruins lose a whole section (a ragged shear across the
 * hull). Whatever no longer touches the largest piece drifts away, so the remainder is always one structure.
 */
export function structureStage(c: RuinCtx): void {
  if (c.meta.cause === 'combat') impacts(c);
  else decay(c);
  keepLargest(c);
  if (c.intensity >= (c.meta.cause === 'combat' ? 0.6 : 0.75) && c.rng.chance(0.4 + c.intensity * 0.55)) {
    // A shear (with whatever it cuts loose) may take at most MAX_SHEAR of the hull; otherwise try a shallower cut once.
    const solid = (): number => c.cells.filter((ch) => ch !== '.').length;
    const before = solid();
    const snap = { cells: c.cells.slice(), sheared: c.meta.sheared };
    for (const depth of [1, 0.5]) {
      shear(c, depth);
      keepLargest(c);
      if (solid() >= before * (1 - maxShear(c))) break;
      c.cells.splice(0, c.cells.length, ...snap.cells);
      c.meta.sheared = snap.sheared;
    }
  }
  dropLostModules(c);
}

function hullTiles(c: RuinCtx): number[] {
  const out: number[] = [];
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (isHull(c, x, y)) out.push(y * c.width + x);
  return out;
}

function breakTile(c: RuinCtx, x: number, y: number, floorToo: boolean): void {
  const ch = at(c, x, y);
  if (ch === '#') {
    const hull = isHull(c, x, y);
    put(c, x, y, hull ? '.' : '_');
    c.meta.breaches.push({ x, y, kind: hull ? 'hull' : 'wall', art: hull ? 'tile.hull.breach' : 'tile.wall.breach' });
  } else if (ch === 'D') {
    put(c, x, y, touchesSpace(c, x, y) ? '.' : '_');
    c.meta.breaches.push({ x, y, kind: 'wall', art: 'tile.wall.breach' });
  } else if ((ch === '_' || ch === '=') && floorToo) {
    put(c, x, y, '.');
    c.meta.breaches.push({ x, y, kind: 'floor', art: `decay.breach.floor.v${c.rng.int(0, 2)}` });
  }
}

function impacts(c: RuinCtx): void {
  const hull = hullTiles(c);
  if (hull.length === 0) return;
  const n = 1 + Math.round(c.intensity * 3 + heavy(c) * 3 + c.rng.next() * 0.8);
  const first = c.rng.pick(hull);
  const fx = first % c.width, fy = (first - fx) / c.width;
  // The volley came from one flank: later hits land near the first one, along the same side.
  const spread = Math.max(4, Math.round(Math.max(c.width, c.height) * (0.35 + 0.4 * heavy(c))));
  const near = hull.filter((i) => Math.abs((i % c.width) - fx) + Math.abs(Math.floor(i / c.width) - fy) <= spread);
  for (let k = 0; k < n; k++) {
    const i = k === 0 ? first : c.rng.pick(near);
    const x = i % c.width, y = (i - x) / c.width;
    const r = 1.2 + c.intensity * 2.6 + heavy(c) * 1.2 + c.rng.next() * 1.5;
    c.meta.impacts.push({ x, y, r: Math.round(r * 10) / 10 });
    blast(c, x, y, r);
  }
}

/** One impact: everything within r is torn, the inner half loses its deck too. Ragged edge from per-tile noise. */
function blast(c: RuinCtx, cx: number, cy: number, r: number): void {
  const R = Math.ceil(r);
  for (let y = cy - R; y <= cy + R; y++) {
    for (let x = cx - R; x <= cx + R; x++) {
      const d = Math.hypot(x - cx, y - cy) + (c.rng.next() - 0.5) * 1.2;
      if (d > r) continue;
      breakTile(c, x, y, d < r * 0.55);
    }
  }
}

function decay(c: RuinCtx): void {
  const hull = hullTiles(c);
  const n = Math.max(1, Math.round(hull.length * (0.015 + 0.07 * c.intensity + 0.12 * heavy(c))));
  for (let k = 0; k < n; k++) {
    const i = c.rng.pick(hull);
    const x = i % c.width, y = (i - x) / c.width;
    if (at(c, x, y) !== '#') continue;
    c.meta.impacts.push({ x, y, r: 1 });
    breakTile(c, x, y, false);
    // Rot spreads a tile or two along the skin, and sometimes eats the deck plate inside.
    const run = c.rng.int(0, Math.round(1 + c.intensity * 2 + heavy(c) * 3));
    let px = x, py = y;
    for (let s = 0; s < run; s++) {
      const step = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const).find(([dx, dy]) => isHull(c, px + dx, py + dy));
      if (!step) break;
      px += step[0]; py += step[1];
      breakTile(c, px, py, false);
    }
    if (c.rng.chance(0.25 + c.intensity * 0.4)) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        if (at(c, x + dx, y + dy) === '_') { breakTile(c, x + dx, y + dy, true); break; }
      }
    }
  }
}

/** Shear off one end (bow or stern, or a flank on a broad hull) along a ragged line. */
/** Most of the hull (fraction of its tiles) a shear may take: 30%, rising to 50% at full intensity. */
const maxShear = (c: RuinCtx): number => 0.3 + 0.2 * heavy(c);

function shear(c: RuinCtx, depth: number): void {
  const along = c.width >= c.height;
  const len = along ? c.width : c.height;
  const cross = along ? c.height : c.width;
  const frac = (0.12 + c.rng.next() * (0.08 + c.intensity * 0.1) + heavy(c) * 0.15) * depth;
  const fromLow = c.rng.chance(0.5);
  let cut = Math.round(len * frac);
  let removed = 0;
  for (let k = 0; k < cross; k++) {
    cut = Math.max(2, Math.min(Math.round(len * (0.35 + 0.15 * heavy(c))), cut + c.rng.int(-1, 1)));
    for (let t = 0; t < cut; t++) {
      const a = fromLow ? t : len - 1 - t;
      const [x, y] = along ? [a, k] : [k, a];
      if (at(c, x, y) !== '.') { put(c, x, y, '.'); removed++; }
    }
  }
  c.meta.sheared += removed;
}

function keepLargest(c: RuinCtx): void {
  const { label, sizes } = components(c, (i) => c.cells[i] !== '.');
  if (sizes.length <= 1) return;
  const best = sizes.indexOf(Math.max(...sizes));
  for (let i = 0; i < label.length; i++) {
    if (label[i] !== -1 && label[i] !== best) { c.cells[i] = '.'; c.meta.sheared++; }
  }
}

/** Modules that lost a footprint tile to space went with it. */
function dropLostModules(c: RuinCtx): void {
  // A container that lost tiles (or its whole frame) was torn off, not lost: it drifts beside the wreck.
  c.modules.forEach((m, i) => { if (c.defs[m.def]?.container && modTiles(c, i).some((t) => at(c, t.x, t.y) === '.')) tearOff(c, i); });
  c.modules = c.modules.filter((_, i) => modTiles(c, i).every((t) => at(c, t.x, t.y) !== '.'));
  // Floor holes stay where they touch the structure. A hull or wall breach is only the torn edge: it must still border a
  // standing wall. Tiles torn out deeper inside a thick block are plain space (or open floor), with no record.
  const standing = (x: number, y: number): boolean => at(c, x, y) === '#' || at(c, x, y) === 'D';
  c.meta.breaches = c.meta.breaches.filter((b) => (b.kind === 'floor' ? N8Solid(c, b.x, b.y) : N4.some(([dx, dy]) => standing(b.x + dx, b.y + dy))));
}

function N8Solid(c: RuinCtx, x: number, y: number): boolean {
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && at(c, x + dx, y + dy) !== '.') return true;
  return false;
}
