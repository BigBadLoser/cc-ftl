import type { Rng } from '../../rng';
import type { Layout, PlacedModule } from '../layout';
import { backDoors, frame, framed, frameSize, roomRect, type Frame } from './frame';
import { roomQuality } from './quality';

/**
 * Room designs: a room laid out whole from a design, as an architect would draw it, instead of piece by piece (the
 * berths and aisles plans do this for quarters and holds). A design is written in a room frame (rooms/frame.ts: u along
 * the back wall, v into the room) and stretches to the room: it says where each piece goes relative to the walls and
 * the room's middle, so a big room spreads it out and a small one packs it. Each design is tried in each of the room's
 * turns; every layout that places all its required groups, keeps every piece usable (Layout.fitError) and every tile
 * reachable is scored (planDesign) and the best is kept. Designs are mirror-symmetric, their
 * pieces in groups placed whole (a lamp at each end of the reactors, a locker in each corner), so a door that blocks one
 * of a pair drops both and the room stays symmetric. A room that fits none (not a rectangle, too small) falls back to
 * its recipe's steps.
 */

/** One piece of a design: a module at frame tile (u, v) with frame turn t. */
interface Put { def: string; u: number; v: number; t: number }
/**
 * A group of pieces placed together or not at all (a mirrored pair keeps the room symmetric when a door blocks one of
 * them); `opt` groups are left out where they do not fit, the rest must.
 */
interface Group { puts: Put[]; opt?: boolean }

/**
 * A design: the groups for a room of frame size L x D holding the spec's modules (main piece turned t), or null. `lean`
 * says which way a row that cannot sit exactly central leans (0 toward u = 0, 1 away), so a tight room tries both.
 */
type Design = (f: Frame, spec: Spec, lay: Layout, t: number, lean: number) => Group[] | null;

/** What a room must hold: its planned modules by def. */
export type Spec = ReadonlyMap<string, number>;

const CAGE = 'module.light_cage';
const fpOf = (lay: Layout, def: string): readonly [number, number] => lay.defs[def]?.footprint ?? [1, 1];

/** A piece and its mirror image across the room's centre line (u -> L - u - du; a piece facing along u turns round). */
function pair(lay: Layout, f: Frame, p: Put): Put[] {
  const [du] = frameSize(fpOf(lay, p.def), p.t);
  const m = { ...p, u: f.L - p.u - du, t: p.t === 1 ? 3 : p.t === 3 ? 1 : p.t };
  return m.u === p.u ? [p] : [p, m];
}

/** What stands at the middle of a wall row v: one piece on an odd wall, a mirrored pair on an even one. */
function centred(lay: Layout, f: Frame, def: string, v: number, t: number): Put[] {
  const [du] = frameSize(fpOf(lay, def), t);
  return (f.L - du) % 2 === 0 ? [{ def, u: (f.L - du) / 2, v, t }] : pair(lay, f, { def, u: Math.floor((f.L - du) / 2), v, t });
}

/** The reactors of a reactor room: their def and count. */
function reactorsOf(spec: Spec): { def: string; n: number } | null {
  for (const [def, n] of spec) if (def.startsWith('module.reactor')) return { def, n };
  return null;
}

/** Where a row of width `span` starts: centred, leaning toward u = 0 (lean 0) or away (1) by half a tile if it must. */
const startOf = (f: Frame, span: number, lean: number): number => (lean ? Math.ceil : Math.floor)((f.L - span) / 2);

/**
 * n pieces side by side along u, centred (their gap widened by one where that makes them exactly central and still fits,
 * else leaning), at row v.
 */
function centreRow(lay: Layout, f: Frame, def: string, n: number, v: number, t: number, lean = 0): { puts: Put[]; u0: number; span: number } {
  const [du] = frameSize(fpOf(lay, def), t);
  let gap = n > 1 ? 1 : 0;
  if (n > 1 && (f.L - (n * du + (n - 1) * gap)) % 2 !== 0 && n * du + n * gap <= f.L) gap++;
  const span = n * du + (n - 1) * gap;
  const u0 = startOf(f, span, lean);
  return { puts: Array.from({ length: n }, (_, i) => ({ def, u: u0 + i * (du + gap), v, t })), u0, span };
}

/**
 * Plant row: the reactors stand against the back wall, centred, a lamp at each end of the row; an aisle runs in front
 * of them; the console faces them from the middle of the front wall, lockers in the front corners, the
 * batteries on the side walls by the reactors. Mirror-symmetric.
 */
const plantRow: Design = (f, spec, lay, t, lean) => {
  const r = reactorsOf(spec);
  if (!r) return null;
  const [, dv] = frameSize(fpOf(lay, r.def), t);
  const row = centreRow(lay, f, r.def, r.n, 0, t, lean);
  // A tight room packs it: the row may stand in the back corners and the console face it across a one-tile aisle.
  if (f.D < dv + 2 || row.u0 < 0) return null;
  return [
    { puts: row.puts },
    { puts: row.u0 >= 2 ? pair(lay, f, { def: CAGE, u: row.u0 - 2, v: 0, t: 0 }) : [], opt: true },
    { puts: pair(lay, f, { def: 'module.battery', u: 0, v: dv, t: 3 }), opt: true },
    { puts: centred(lay, f, 'module.console', f.D - 1, 2), opt: true },
    { puts: pair(lay, f, { def: 'module.storage_locker', u: 0, v: f.D - 1, t: 3 }), opt: true },
  ];
};

/**
 * Twin flank (two reactors): one reactor against each end wall, end on, the floor between them open; a battery bank
 * centred on the back wall between two lamps, the console centred on the front wall facing it, a locker beside each
 * reactor on the front wall. Mirror-symmetric.
 */
const twinFlank: Design = (f, spec, lay, t) => {
  const r = reactorsOf(spec);
  if (!r || r.n !== 2) return null;
  const [du, dv] = frameSize(fpOf(lay, r.def), t);
  if (f.L < 2 * du + 3 || f.D < Math.max(dv, 4)) return null;
  const v = Math.floor((f.D - dv) / 2);
  const bank = centred(lay, f, 'module.battery', 0, 0);
  const lo = Math.min(...bank.map((p) => p.u));
  return [
    { puts: pair(lay, f, { def: r.def, u: 0, v, t }) },
    { puts: bank, opt: true },
    { puts: lo >= du + 2 ? pair(lay, f, { def: CAGE, u: lo - 1, v: 0, t: 0 }) : [], opt: true },
    { puts: centred(lay, f, 'module.console', f.D - 1, 2), opt: true },
    { puts: pair(lay, f, { def: 'module.storage_locker', u: du, v: f.D - 1, t: 2 }), opt: true },
  ];
};

/**
 * Plinth: the reactors side by side in the middle of the room with clear floor all round, a lamp either side of them;
 * batteries in the back corners, the console centred on the front wall facing them, lockers in the front corners.
 * Mirror-symmetric.
 */
const plinth: Design = (f, spec, lay, t) => {
  const r = reactorsOf(spec);
  if (!r) return null;
  const [, dv] = frameSize(fpOf(lay, r.def), t);
  if (f.D < dv + 4) return null;
  const v = Math.floor((f.D - dv) / 2);
  const row = centreRow(lay, f, r.def, r.n, v, t);
  if (row.u0 < 2) return null;
  return [
    { puts: row.puts },
    { puts: row.u0 >= 3 ? pair(lay, f, { def: CAGE, u: row.u0 - 2, v: v + Math.floor(dv / 2), t: 0 }) : [], opt: true },
    { puts: pair(lay, f, { def: 'module.battery', u: 0, v: 0, t: 0 }), opt: true },
    { puts: centred(lay, f, 'module.console', f.D - 1, 2), opt: true },
    { puts: pair(lay, f, { def: 'module.storage_locker', u: 0, v: f.D - 1, t: 3 }), opt: true },
  ];
};

/** The mounts of a gun bay (weapons and point defence), one def per mount, the largest first. */
function mountsOf(lay: Layout, spec: Spec): string[] {
  const out = [...spec].filter(([k]) => lay.defs[k]?.weapon || lay.defs[k]?.pointDefense).flatMap(([k, c]) => Array<string>(c).fill(k));
  return out.sort((x, y) => fpOf(lay, y)[0] - fpOf(lay, x)[0]);
}

/**
 * Gun gallery: the mounts stand centred on the back wall, a tile apart; an ammunition rack at each end of the wall, a
 * battery in each front corner, the duty console centred on the front wall facing the guns. Mirror-symmetric where the
 * room allows; a bay just big enough for its guns leans the row and puts a battery in the corner beside it.
 */
const gunGallery: Design = (f, spec, lay, _t, lean) => {
  const mounts = mountsOf(lay, spec);
  const big = mounts[0];
  if (!big) return null;
  const [, dv] = frameSize(fpOf(lay, big), 0);
  const row = centreRow(lay, f, big, mounts.length, 0, 0, lean);
  // A tight bay is the guns and an aisle: the row may fill the back wall, leaning where it cannot centre.
  if (f.D < dv + 1 || row.u0 < 0) return null;
  const right = f.L - row.u0 - row.span;
  return [
    // Each mount by its own def in the row's places (a bay may mix two light guns).
    { puts: row.puts.map((p, i) => ({ ...p, def: mounts[i] ?? p.def })) },
    { puts: row.u0 >= 3 ? pair(lay, f, { def: 'module.storage_rack', u: row.u0 - 3, v: 0, t: 0 }) : [], opt: true },
    // A battery in a back corner left beside a leaning row (too narrow for the racks).
    { puts: row.u0 > 0 && row.u0 < 3 && right < 3 && row.u0 !== right ? [{ def: 'module.battery', u: row.u0 > right ? 0 : f.L - 1, v: 0, t: 0 }] : [], opt: true },
    { puts: f.D >= dv + 3 ? pair(lay, f, { def: 'module.battery', u: 0, v: f.D - 1, t: 3 }) : [], opt: true },
    { puts: f.D >= dv + 3 ? centred(lay, f, 'module.console', f.D - 1, 2) : [], opt: true },
  ];
};

/**
 * Shield core: the generator centred on the back wall, a battery either side of it, the console centred on the front
 * wall facing it, a rack in each front corner. Mirror-symmetric; a closet just big enough packs the batteries against
 * the generator.
 */
const shieldCore: Design = (f, spec, lay, _t, lean) => {
  const g = [...spec.keys()].find((k) => lay.defs[k]?.shieldGen);
  if (!g) return null;
  const [, dv] = frameSize(fpOf(lay, g), 0);
  const row = centreRow(lay, f, g, 1, 0, 0, lean);
  if (f.D < dv + 1 || row.u0 < 0) return null;
  return [
    { puts: row.puts },
    // The batteries a tile off the generator where there is room, else against it.
    { puts: row.u0 >= 1 ? pair(lay, f, { def: 'module.battery', u: Math.max(0, row.u0 - 2), v: 0, t: 0 }) : [], opt: true },
    { puts: f.D >= dv + 3 ? centred(lay, f, 'module.console', f.D - 1, 2) : [], opt: true },
    { puts: f.D >= dv + 3 && f.L >= 7 ? pair(lay, f, { def: 'module.storage_rack', u: 0, v: f.D - 1, t: 0 }) : [], opt: true },
  ];
};

/**
 * Core vault: the AI core on the back wall with its point-defence mounts in a row either side of it (split evenly, a
 * tile apart, the whole row centred), batteries in the front corners and the console centred on the front wall facing the core.
 */
const coreVault: Design = (f, spec, lay, _t, lean) => {
  const core = [...spec.keys()].find((k) => lay.defs[k]?.aiCore);
  if (!core) return null;
  const pds = [...spec].filter(([k]) => lay.defs[k]?.pointDefense).flatMap(([k, c]) => Array<string>(c).fill(k));
  // The odd mount goes on the side the row leans away from, so the whole row sits as near central as it can.
  const more = pds.slice(0, Math.ceil(pds.length / 2)), less = pds.slice(more.length);
  const [left, right] = lean ? [less, more] : [more, less];
  const row = [...left, core, ...right];
  const span = row.reduce((t, d) => t + frameSize(fpOf(lay, d), 0)[0] + 1, 0) - 1;
  let u = startOf(f, span, lean);
  if (u < 0 || f.D < 3) return null;
  const puts: Put[] = row.map((def) => { const p = { def, u, v: 0, t: 0 }; u += frameSize(fpOf(lay, def), 0)[0] + 1; return p; });
  return [
    { puts },
    { puts: f.D >= 4 ? pair(lay, f, { def: 'module.battery', u: 0, v: f.D - 1, t: 3 }) : [], opt: true },
    { puts: f.D >= 4 ? centred(lay, f, 'module.console', f.D - 1, 2) : [], opt: true },
  ];
};

/** Designs by name, for recipes to list. */
export const DESIGNS = { plantRow, twinFlank, plinth, gunGallery, shieldCore, coreVault } as const satisfies Record<string, Design>;
export type DesignName = keyof typeof DESIGNS;

/**
 * The room size (long side, short side) a design wants for these modules, for planners that size rooms by their
 * design (rooms tell the station how big they should be): gun galleries and shield cores. Null for the rest.
 */
export function designSize(name: DesignName, mods: readonly string[], defs: Record<string, { footprint: readonly [number, number] }>): [number, number] | null {
  const fp = (id: string): readonly [number, number] => defs[id]?.footprint ?? [2, 2];
  if (name === 'gunGallery') {
    const s = Math.max(...mods.map((m) => fp(m)[0])), n = mods.length;
    return [n * s + (n - 1) + 6, s + 3];
  }
  if (name === 'coreVault') {
    const w = mods.reduce((t, m) => t + fp(m)[0] + 1, 0) - 1;
    return [w + 4, 5];
  }
  if (name === 'shieldCore') return [Math.max(3, fp(mods[0] ?? '')[0]) + 4, Math.max(3, fp(mods[0] ?? '')[1]) + 3];
  return null;
}

/**
 * The least score a design's layout must reach to be kept: below it (a tight room the design packs into alcoves and
 * dead ends) the room goes back to its recipe's steps, which arrange it better.
 */
const FLOOR = 70;

/**
 * Lay `room` out from the first of `names` (tried in an order the seed shuffles) that fits in some turn of the room.
 * Returns the defs placed for the spec (the planned modules it took over), or null to leave the room to its steps.
 */
export function planDesign(lay: Layout, rng: Rng, room: number, spec: Spec, names: readonly DesignName[]): Set<string> | null {
  const rect = roomRect(lay, room);
  if (!rect) return null;
  const rows = Array.from({ length: lay.h }, (_, y) => lay.cells.slice(y * lay.w, (y + 1) * lay.w).join(''));
  const base = lay.unreached();
  const n0 = lay.modules.length;
  // Score and pick (rather than take the first that fits): every design in every turn of the room and of its main piece
  // is laid out and scored by the room's quality (rooms/quality.ts), plus a little for each optional group it kept (a
  // design whole, not missing its batteries), less for a door in its back wall; the best is kept.
  let best: { mods: PlacedModule[]; defs: Set<string>; score: number } | null = null;
  const seen = new Set<string>();
  for (const name of names) {
    for (const o of [0, 1, 2, 3]) {
      const f = frame(rect, o);
      for (const [t, lean] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) {
        const groups = DESIGNS[name](f, spec, lay, t, lean);
        if (!groups) continue;
        // A design that needs no lean gives the same layout for both: lay each out once.
        const key = `${o} ${JSON.stringify(groups)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        let ok = true, kept = 0;
        for (const g of groups) {
          const k0 = lay.modules.length;
          let fits = true;
          for (const p of g.puts) {
            const pm: PlacedModule = framed(lay, f, p.def, p.u, p.v, p.t);
            if (lay.fitError(pm.def, pm.x, pm.y, pm.rot, room)) { fits = false; break; }
            lay.push(pm);
          }
          if (fits && lay.unreached() <= base) { if (g.opt && g.puts.length > 0) kept++; continue; }
          while (lay.modules.length > k0) lay.pop();
          if (!g.opt) { ok = false; break; }
        }
        if (ok) {
          const mods = lay.modules.slice(n0);
          const q = roomQuality({ rows, modules: lay.modules, roomOf: lay.roomOf, defs: lay.defs }, room)[0]?.score ?? 0;
          const score = q + kept * 3 - (backDoors(lay, f) > 0 ? 5 : 0) + rng.next() * 0.5;
          if (!best || score > best.score) best = { mods: mods.map((m) => ({ ...m })), defs: new Set(groups.flatMap((g) => g.puts).filter((p) => spec.has(p.def)).map((p) => p.def)), score };
        }
        while (lay.modules.length > n0) lay.pop();
      }
    }
  }
  if (!best || best.score < FLOOR) return null;
  for (const m of best.mods) lay.push(m);
  return best.defs;
}
