import { airlockTiles } from '../modules/airlock';
import { footprintTiles, rotatedSize } from '../modules/footprint';
import type { ModuleDef } from '../registry';
import type { Layout } from './layout';

/**
 * Turrets on open ground (#514): an asteroid base's guns and point defence, standing on the levelled rock round its
 * modules (the layout's '.' tiles: the whole site is ground once the base stands), each wired to a hull wall by a cable.
 * The asteroid base generator's choice, not a rule of the game:
 *   - a turret keeps a ring of open ground round it (crew walk round it to repair it) and one tile from the hull, so its
 *     cable is a single tile from a wall to the turret (only the four side neighbours join);
 *   - it stands clear of the landing pads (and a tile round them) and of the ground before each airlock;
 *   - the first turret stands nearest the command room (they are worked from its weapons console), and each next one
 *     beside those already out, a ring of ground between them, so they line up in a row rather than scatter round the base;
 *   - the ground stays one open walk: every pad, every airlock's outside and every turret's ring stays reachable.
 */

export interface GroundPlan {
  /** Module defs to stand on the ground (guns, point defence), placed in this order. */
  mods: readonly string[];
  /** Boxes kept clear (the landing pads), [x0, y0, x1, y1) in layout tiles. */
  keep: readonly (readonly [number, number, number, number])[];
}

export interface GroundFit {
  /** Indices into `lay.modules` of the turrets placed. */
  placed: number[];
  /** Cabled tiles (row-major over the layout). */
  cable: Set<number>;
}

/** Ground kept clear before an airlock's outer door, in tiles (its collar and the walk out from it). */
const APPROACH = 3;

/** Place the plan's turrets on the layout's open ground and lay their cables. Turrets that find no spot are left out. */
export function placeGroundTurrets(lay: Layout, plan: GroundPlan): GroundFit {
  const { w, h } = lay;
  const out: GroundFit = { placed: [], cable: new Set() };
  const ground = (x: number, y: number): boolean => lay.at(x, y) === '.' && lay.inBounds(x, y);
  const free = (x: number, y: number): boolean => ground(x, y) && lay.occ[y * w + x] === -1 && !out.cable.has(y * w + x);
  // Kept clear: the pads and a tile round them, and the ground before each airlock.
  const clear = new Uint8Array(w * h);
  for (const [x0, y0, x1, y1] of plan.keep) for (let y = y0 - 1; y <= y1; y++) for (let x = x0 - 1; x <= x1; x++) if (lay.inBounds(x, y)) clear[y * w + x] = 1;
  const outside: { x: number; y: number }[] = [];
  for (const m of lay.modules) {
    const def = lay.defs[m.def];
    if (!def?.airlock) continue;
    const a = airlockTiles(def, m);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      if (!ground(a.outer.x + dx, a.outer.y + dy)) continue;
      outside.push({ x: a.outer.x + dx, y: a.outer.y + dy });
      for (let k = 0; k <= APPROACH; k++) for (let s = -2; s <= 2; s++) {
        const x = a.outer.x + dx * (k + 1) + (dy !== 0 ? s : 0), y = a.outer.y + dy * (k + 1) + (dx !== 0 ? s : 0);
        if (lay.inBounds(x, y)) clear[y * w + x] = 1;
      }
    }
  }
  const wallAt = (x: number, y: number): boolean => lay.at(x, y) === '#' && (lay.occ[y * w + x] === -1 || !lay.defs[lay.modules[lay.occ[y * w + x] as number]!.def]?.airlock);
  // Where the turrets gather: the command room's middle (else the middle of the floor).
  const cmd = lay.roles.map((r, i) => (r === 'bridge' ? i : -1)).filter((i) => i >= 0);
  let sx = 0, sy = 0, n = 0;
  for (let i = 0; i < lay.cells.length; i++) {
    if (lay.cells[i] !== '_' || (cmd.length > 0 && !cmd.includes(lay.roomOf[i] as number))) continue;
    sx += i % w; sy += Math.floor(i / w); n++;
  }
  const cx = n ? sx / n : w / 2, cy = n ? sy / n : h / 2;
  for (const id of plan.mods) {
    const def = lay.defs[id] as ModuleDef | undefined;
    if (!def) continue;
    const [fw, fh] = rotatedSize(def, 0);
    const spots: { x: number; y: number; d: number; wire: number }[] = [];
    for (let y = 1; y + fh < h; y++) for (let x = 1; x + fw < w; x++) {
      const wire = spot(x, y, fw, fh);
      if (wire < 0) continue;
      // The first nearest the command room; each next one beside those already out (a row, not a scatter), then nearest the room.
      const mx = x + fw / 2, my = y + fh / 2, home = Math.hypot(mx - cx, my - cy);
      const row = out.placed.length === 0 ? 0 : Math.min(...out.placed.map((k) => { const m = lay.modules[k]!, [pw, ph] = rotatedSize(lay.defs[m.def] as ModuleDef, m.rot); return Math.hypot(mx - m.x - pw / 2, my - m.y - ph / 2); }));
      spots.push({ x, y, d: row * 100 + home, wire });
    }
    spots.sort((a, b) => a.d - b.d || a.y - b.y || a.x - b.x);
    for (const s of spots) {
      lay.push({ def: id, x: s.x, y: s.y, rot: 0 });
      out.cable.add(s.wire);
      if (opens()) { out.placed.push(lay.modules.length - 1); break; }
      out.cable.delete(s.wire);
      lay.pop();
    }
  }
  return out;

  /** The cable tile for a turret at (x, y), or -1 when it may not stand there. */
  function spot(x: number, y: number, fw: number, fh: number): number {
    // Its footprint and a ring of ground round it: open, unclaimed, nothing built (the ring keeps it a tile off the hull and other turrets).
    for (let ty = y - 1; ty <= y + fh; ty++) for (let tx = x - 1; tx <= x + fw; tx++) if (!free(tx, ty) || clear[ty * w + tx]) return -1;
    // The cable: a ring tile beside both the footprint and a hull wall (four ways each), the one nearest the side's middle.
    let best = -1, bestOff = Infinity;
    const ring = (tx: number, ty: number, ox: number, oy: number, off: number): void => {
      if (wallAt(tx + ox, ty + oy) && off < bestOff) { best = ty * w + tx; bestOff = off; }
    };
    for (let tx = x; tx < x + fw; tx++) {
      const off = Math.abs(tx - (x + (fw - 1) / 2));
      ring(tx, y - 1, 0, -1, off);
      ring(tx, y + fh, 0, 1, off);
    }
    for (let ty = y; ty < y + fh; ty++) {
      const off = Math.abs(ty - (y + (fh - 1) / 2));
      ring(x - 1, ty, -1, 0, off);
      ring(x + fw, ty, 1, 0, off);
    }
    return best;
  }

  /** True while the ground is one open walk: every airlock's outside reaches every pad and every turret's ring. */
  function opens(): boolean {
    const walk = (i: number): boolean => { const x = i % w, y = Math.floor(i / w); return ground(x, y) && lay.occ[i] === -1; };
    const start = outside.map((o) => o.y * w + o.x).filter(walk);
    if (start.length === 0) return true;
    const seen = new Uint8Array(w * h);
    const stack = [start[0] as number];
    seen[start[0] as number] = 1;
    while (stack.length > 0) {
      const i = stack.pop() as number;
      const x = i % w;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) if (j >= 0 && j < w * h && !seen[j] && walk(j)) { seen[j] = 1; stack.push(j); }
    }
    if (start.some((i) => !seen[i])) return false;
    for (const [x0, y0, x1, y1] of plan.keep) if (!seen[Math.floor((y0 + y1) / 2) * w + Math.floor((x0 + x1) / 2)]) return false;
    for (const k of out.placed.concat([lay.modules.length - 1])) {
      const m = lay.modules[k]!;
      const tiles = footprintTiles(lay.defs[m.def] as ModuleDef, m.x, m.y, m.rot);
      const near = tiles.some((t) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const j = (t.y + (dy as number)) * w + t.x + (dx as number); return seen[j] === 1; }));
      if (!near) return false;
    }
    return true;
  }
}
