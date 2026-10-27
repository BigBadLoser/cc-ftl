import { airlockTiles } from '../modules/airlock';
import { accessTile, footprintTiles, hullOutward, hullRow, hullSide, openTilesOf } from '../modules/footprint';
import { footprintFromTiles, widthViolations } from '../footprint';
import type { ModuleDef, ShipTemplate } from '../registry';
import { roofMounted } from './layout';

/**
 * Check a ship template the way the layout tests do: modules on floor (hull modules on exterior hull), no overlaps,
 * open chairs and access tiles, every walkable tile reachable from the first door, power balance, a helm, engines on
 * the stern (+x) hull (unless `immobile`: stations), a reactor, doors usable from both sides, clear roof space around roof-mounted modules
 * and the footprint width rule (no part of the hull narrower than 3 tiles, see footprint.ts).
 * Returns human-readable problems (empty = valid).
 */
export function validateTemplate(t: ShipTemplate, defs: Record<string, ModuleDef>, opts: { immobile?: boolean } = {}): string[] {
  const problems: string[] = [];
  const h = t.rows.length;
  const w = Math.max(...t.rows.map((r) => r.length));
  const cells: string[] = [];
  for (const r of t.rows) for (let x = 0; x < w; x++) cells.push(r[x] ?? '.');
  const at = (x: number, y: number): string => (x >= 0 && y >= 0 && x < w && y < h ? (cells[y * w + x] as string) : '.');
  const occ = new Int16Array(w * h).fill(-1);
  const solid = new Uint8Array(w * h);
  const mods = t.modules ?? [];
  let supply = 0;
  let demand = 0;
  mods.forEach((m, k) => {
    const def = defs[m.def];
    const name = `${m.def}@${m.x},${m.y}`;
    if (!def) { problems.push(`${name}: unknown module`); return; }
    if (def.power > 0) supply += def.power; else demand -= def.power;
    const wall = hullRow(def, m.x, m.y, m.rot);
    const side = hullSide(def, m.rot);
    const out = side ? hullOutward(side) : { x: 0, y: 0 };
    const open = openTilesOf(def, m.x, m.y, m.rot);
    for (const tile of footprintTiles(def, m.x, m.y, m.rot)) {
      const i = tile.y * w + tile.x;
      const onWall = wall.some((q) => q.x === tile.x && q.y === tile.y);
      if (onWall) {
        if (at(tile.x, tile.y) !== '#' || at(tile.x + out.x, tile.y + out.y) !== '.') problems.push(`${name}: not on the hull`);
      } else if (def.container ? at(tile.x, tile.y) !== '=' : at(tile.x, tile.y) !== '_') problems.push(`${name}: off the ${def.container ? 'frame' : 'floor'} at ${tile.x},${tile.y}`);
      if (tile.x < 0 || tile.y < 0 || tile.x >= w || tile.y >= h) continue;
      if (occ[i] !== -1) problems.push(`${name}: overlaps ${mods[occ[i] as number]?.def}`);
      occ[i] = k;
      if (def.solid && !open.some((o) => o.x === tile.x && o.y === tile.y)) solid[i] = 1;
    }
    if (def.engine && side !== 'e') problems.push(`${name}: engine not on the stern hull`);
    if (def.vehicleBay && !m.vehicle) problems.push(`${name}: bay without a vehicle`);
    if (def.container && !clampedToFrame(at, def, m)) problems.push(`${name}: not clamped to a frame by its short (door) end`);
  });
  // The airlocks' tiles turn into doors and chamber floor on spawn.
  for (const m of mods) {
    const def = defs[m.def];
    if (!def?.airlock) continue;
    const a = airlockTiles(def, m);
    for (const d of [a.outer, a.inner]) cells[d.y * w + d.x] = 'D';
    if (at(a.inside.x, a.inside.y) !== '_' || solid[a.inside.y * w + a.inside.x]) problems.push(`${m.def}@${m.x},${m.y}: blocked inside`);
  }
  const walk = (x: number, y: number): boolean => {
    const c = at(x, y);
    return (c === '_' || c === 'D') && !solid[y * w + x];
  };
  for (const m of mods) {
    const def = defs[m.def];
    if (!def) continue;
    const a = accessTile(def, m.x, m.y, m.rot);
    if (a && !walk(a.x, a.y)) problems.push(`${m.def}@${m.x},${m.y}: access tile blocked`);
    for (const o of openTilesOf(def, m.x, m.y, m.rot)) if (!walk(o.x, o.y)) problems.push(`${m.def}@${m.x},${m.y}: chair blocked`);
    if (roofMounted(def)) {
      for (const tile of footprintTiles(def, m.x, m.y, m.rot)) {
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const o = occ[(tile.y + dy) * w + tile.x + dx];
          const other = o !== undefined && o >= 0 ? mods[o] : undefined;
          if (other && other !== m && roofMounted(defs[other.def] as ModuleDef)) problems.push(`${m.def}@${m.x},${m.y}: roof clash with ${other.def}`);
        }
      }
    }
  }
  if (demand > supply) problems.push(`power: demand ${demand} > supply ${supply}`);
  const count = (pred: (d: ModuleDef) => boolean): number => mods.filter((m) => defs[m.def] && pred(defs[m.def] as ModuleDef)).length;
  // A helm is the bridge; on AI-run ships the AI core stands in (as on the robots branch).
  if (count((d) => !!d.bridge || !!d.aiCore) === 0) problems.push('no helm or AI core');
  // Stations are immobile: no engines needed (none are planned).
  if (!opts.immobile && count((d) => !!d.engine) === 0) problems.push('no engine');
  if (count((d) => d.power > 0) === 0) problems.push('no reactor');
  if (t.boarding && count((d) => !!d.vehicleBay) === 0) problems.push('boards but has no shuttle bay');
  // Doors join walkable tiles on two opposite sides; everything walkable is reachable from the first door.
  let start = -1;
  let total = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (at(x, y) === 'D' && !mods.some((m) => defs[m.def]?.airlock && occ[y * w + x] === mods.indexOf(m))) {
        if (!((walk(x - 1, y) && walk(x + 1, y)) || (walk(x, y - 1) && walk(x, y + 1)))) problems.push(`door ${x},${y}: blocked`);
      }
      if (!walk(x, y)) continue;
      total++;
      if (start < 0 && at(x, y) === 'D') start = y * w + x;
    }
  }
  if (start < 0) problems.push('no door');
  else {
    const seen = new Uint8Array(w * h);
    const stack = [start];
    seen[start] = 1;
    let reached = 0;
    while (stack.length > 0) {
      const i = stack.pop() as number;
      reached++;
      const x = i % w;
      const y = Math.floor(i / w);
      for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]] as const) {
        const j = ny * w + nx;
        if (walk(nx, ny) && !seen[j]) { seen[j] = 1; stack.push(j); }
      }
    }
    if (reached < total) problems.push(`unreachable: ${total - reached} walkable tiles`);
  }
  // One structure: hull, walls, floors, doors and beams all 4-connected (no pod or beam floating a tile off).
  const parts = structureParts(cells, w, h);
  if (parts > 1) problems.push(`disconnected: ${parts} separate structures`);
  const width = widthProblem(cells, w, h);
  if (width) problems.push(width);
  const freeFloor = cells.filter((c, i) => c === '_' && !solid[i]).length;
  if ((t.crew ?? []).length > freeFloor) problems.push('no room for the crew');
  return problems;
}

/** The footprint width rule on template cells (`.` is space): a problem naming the tiles narrower than 3, or null. */
export function widthProblem(cells: string[], w: number, h: number): string | null {
  const tiles: { x: number; y: number }[] = [];
  for (let i = 0; i < w * h; i++) if (cells[i] !== undefined && cells[i] !== '.') tiles.push({ x: i % w, y: Math.floor(i / w) });
  const bad = widthViolations(footprintFromTiles(tiles));
  return bad.length === 0 ? null : `width: ${bad.length} tiles in parts narrower than 3 (first at ${bad[0]!.x},${bad[0]!.y})`;
}

/** Count 4-connected components of non-space cells (`.` is space). */
export function structureParts(cells: string[], w: number, h: number): number {
  const seen = new Uint8Array(w * h);
  let parts = 0;
  for (let s = 0; s < w * h; s++) {
    if (seen[s] || cells[s] === '.' || cells[s] === undefined) continue;
    parts++;
    const stack = [s];
    seen[s] = 1;
    while (stack.length > 0) {
      const i = stack.pop() as number;
      const x = i % w;
      const y = Math.floor(i / w);
      for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]] as const) {
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx;
        if (!seen[j] && cells[j] !== '.') { seen[j] = 1; stack.push(j); }
      }
    }
  }
  return parts;
}

/**
 * A container clamps by a short end (its cargo doors face the frame): the clamp side must be one of its short sides, and
 * frame (anything but space) must stand right against every tile of that end.
 */
function clampedToFrame(at: (x: number, y: number) => string, def: ModuleDef, m: { x: number; y: number; rot: number; clamp?: 'n' | 'e' | 's' | 'w' }): boolean {
  const tiles = footprintTiles(def, m.x, m.y, m.rot);
  const xs = tiles.map((t) => t.x);
  const ys = tiles.map((t) => t.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const side = m.clamp ?? 'n';
  const ns = side === 'n' || side === 's';
  // The clamped end is the short one: n / s ends are short when the box is narrower than it is long, and the other way.
  if (ns ? x1 - x0 >= y1 - y0 : y1 - y0 >= x1 - x0) return false;
  const edge: [number, number][] = ns
    ? Array.from({ length: x1 - x0 + 1 }, (_, i) => [x0 + i, side === 'n' ? y0 - 1 : y1 + 1])
    : Array.from({ length: y1 - y0 + 1 }, (_, j) => [side === 'w' ? x0 - 1 : x1 + 1, y0 + j]);
  return edge.every(([x, y]) => at(x, y) !== '.');
}
