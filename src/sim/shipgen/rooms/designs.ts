import type { Rng } from '../../rng';
import type { Layout, PlacedModule } from '../layout';
import { backDoors, frame, framed, frameSize, roomRect, type Frame } from './frame';

/**
 * Room designs: a room laid out whole from a design, as an architect would draw it, instead of piece by piece (the
 * berths and aisles plans do this for quarters and holds). A design is written in a room frame (rooms/frame.ts: u along
 * the back wall, v into the room) and stretches to the room: it says where each piece goes relative to the walls and
 * the room's middle, so a big room spreads it out and a small one packs it. Each design is tried in each of the room's
 * turns (back walls without doors first, the long side as the back); the first that places every piece, keeps every
 * piece usable (Layout.fitError) and every tile reachable wins. A room that fits none (not a rectangle, too small)
 * falls back to its recipe's steps.
 */

/** One piece of a design: a module at frame tile (u, v) with frame turn t; `opt` pieces are left out where they do not fit. */
interface Put { def: string; u: number; v: number; t: number; opt?: boolean }

/** A design: the pieces for a room of frame size L x D holding the spec's modules, or null when it cannot fit. */
type Design = (f: Frame, spec: Spec, lay: Layout, t: number) => Put[] | null;

/** What a room must hold: its planned modules by def. */
export type Spec = ReadonlyMap<string, number>;

const fpOf = (lay: Layout, def: string): readonly [number, number] => lay.defs[def]?.footprint ?? [1, 1];

/** A run of n pieces of `def` side by side along u, centred on `mid`, `gap` tiles apart, at row v, turn t. */
function run(lay: Layout, def: string, n: number, mid: number, v: number, t: number, gap = 0): Put[] {
  const [du] = frameSize(fpOf(lay, def), t);
  const span = n * du + (n - 1) * gap;
  const u0 = Math.round(mid - span / 2);
  return Array.from({ length: n }, (_, i) => ({ def, u: u0 + i * (du + gap), v, t }));
}

/** Mark pieces optional: the design keeps its shape without them where a door or a neighbour is in the way. */
const opt = (ps: Put[]): Put[] => ps.map((p) => ({ ...p, opt: true }));

/** The reactors of a reactor room: their def and count. */
function reactorsOf(spec: Spec): { def: string; n: number } | null {
  for (const [def, n] of spec) if (def.startsWith('module.reactor')) return { def, n };
  return null;
}

/**
 * Plant row: the reactors stand against the back wall, broadside on, a tile apart; an aisle runs in front of them; the
 * batteries and the console line the front wall facing them, the lockers stand at the two ends. Needs the reactors'
 * depth plus an aisle of two and the front row.
 */
const plantRow: Design = (f, spec, lay, t) => {
  const r = reactorsOf(spec);
  if (!r) return null;
  const fp = fpOf(lay, r.def);
  const [du, dv] = frameSize(fp, t);
  if (f.D < dv + 3 || f.L < r.n * du + (r.n - 1) + 2) return null;
  const mid = f.L / 2;
  return [
    ...run(lay, r.def, r.n, mid, 0, t, 1),
    ...opt(run(lay, 'module.battery', 2, mid - 1, f.D - 1, 2)),
    ...opt([{ def: 'module.console', u: Math.round(mid + 1), v: f.D - 1, t: 2 }]),
    ...opt([{ def: 'module.storage_locker', u: 0, v: f.D - 2, t: 3 }, { def: 'module.storage_locker', u: f.L - 1, v: f.D - 2, t: 1 }]),
  ];
};

/**
 * Twin flank (two reactors): one reactor at each end wall, end on, with the floor between them open; the batteries
 * stand at the middle of the back wall, the console faces them from the front wall, lockers flank the batteries.
 */
const twinFlank: Design = (f, spec, lay, t) => {
  const r = reactorsOf(spec);
  if (!r || r.n !== 2) return null;
  const fp = fpOf(lay, r.def);
  const [du, dv] = frameSize(fp, t);
  if (f.L < 2 * du + 3 || f.D < Math.max(dv, 4)) return null;
  const vm = Math.round((f.D - dv) / 2), mid = f.L / 2;
  return [
    { def: r.def, u: 0, v: vm, t },
    { def: r.def, u: f.L - du, v: vm, t },
    ...opt(run(lay, 'module.battery', 2, mid, 0, 0)),
    ...opt([{ def: 'module.storage_locker', u: Math.round(mid) - 2, v: 0, t: 0 }, { def: 'module.storage_locker', u: Math.round(mid) + 1, v: 0, t: 0 }]),
    ...opt([{ def: 'module.console', u: Math.round(mid - 0.5), v: f.D - 1, t: 2 }]),
  ];
};

/**
 * Plinth: the reactors side by side in the middle of the room with clear floor all round, the batteries and lockers on
 * the back wall behind them, the console on the front wall facing them.
 */
const plinth: Design = (f, spec, lay, t) => {
  const r = reactorsOf(spec);
  if (!r) return null;
  const fp = fpOf(lay, r.def);
  const [du, dv] = frameSize(fp, t);
  if (f.D < dv + 4 || f.L < r.n * du + 4) return null;
  const mid = f.L / 2;
  const v = Math.round((f.D - dv) / 2);
  return [
    ...run(lay, r.def, r.n, mid, v, t, 0),
    ...opt(run(lay, 'module.battery', 2, mid, 0, 0, 1)),
    ...opt([{ def: 'module.storage_locker', u: 0, v: 0, t: 0 }, { def: 'module.storage_locker', u: f.L - 1, v: 0, t: 0 }]),
    ...opt([{ def: 'module.console', u: Math.round(mid - 0.5), v: f.D - 1, t: 2 }]),
  ];
};

/** Designs by name, for recipes to list. */
export const DESIGNS = { plantRow, twinFlank, plinth } as const satisfies Record<string, Design>;
export type DesignName = keyof typeof DESIGNS;

/**
 * Lay `room` out from the first of `names` (tried in an order the seed shuffles) that fits in some turn of the room.
 * Returns the defs placed for the spec (the planned modules it took over), or null to leave the room to its steps.
 */
export function planDesign(lay: Layout, rng: Rng, room: number, spec: Spec, names: readonly DesignName[]): Set<string> | null {
  const rect = roomRect(lay, room);
  if (!rect) return null;
  const turns = [0, 1, 2, 3].map((o) => frame(rect, o))
    .map((f) => ({ f, s: (backDoors(lay, f) > 0 ? 10 : 0) + (f.L < f.D ? 2 : 0) + rng.next() }))
    .sort((a, b) => a.s - b.s).map((x) => x.f);
  const order = [...names].sort(() => rng.next() - 0.5);
  const base = lay.unreached();
  const n0 = lay.modules.length;
  for (const name of order) {
    // Each turn of the room, each turn of the design's main piece (broadside or end on to the wall).
    for (const f of turns) for (const t of rng.chance(0.5) ? [0, 1] : [1, 0]) {
      const puts = DESIGNS[name](f, spec, lay, t);
      if (!puts) continue;
      let ok = true;
      for (const p of puts) {
        const pm: PlacedModule = framed(lay, f, p.def, p.u, p.v, p.t);
        if (lay.fitError(pm.def, pm.x, pm.y, pm.rot, room)) { if (p.opt) continue; ok = false; break; }
        lay.push(pm);
        // An optional piece that cuts floor off is left out.
        if (p.opt && lay.unreached() > base) lay.pop();
      }
      if (ok && lay.unreached() <= base) return new Set(puts.filter((p) => spec.has(p.def)).map((p) => p.def));
      while (lay.modules.length > n0) lay.pop();
    }
  }
  return null;
}
