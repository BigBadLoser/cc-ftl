/**
 * A sim built from a layout and never stepped: the preview renders it and the game's owners answer about it (placement, power).
 * Built once per layout and kept; building a big station takes about 60 ms.
 */
import { content } from '../../src/content';
import { ModuleC, Sim, removeModule as despawn, shipGrid, spawnModule, spawnShip, validateTemplate, type ModuleDef, type ShipTemplate } from '../../src/sim';
import { removeWreck } from '../../src/sim/salvage/remove';
import { placementError } from '../../src/sim/modules/spawn';
import { isIdle } from '../../src/sim/modules/draw';
import { roomsSystem } from '../../src/sim/systems/rooms';
import { lightingSystem } from '../../src/sim/systems/lighting';
import { powerSystem } from '../../src/sim/systems/power';
import { ORIGIN } from './camera';
import { addModule, clampAt, newModule, removeModule, toTemplate, type Layout } from './layout';

export interface World { sim: Sim; ship: number }
const cache = new WeakMap<Layout, World | null>();

/** Whether a layout fits the sector a sim has. */
export const fits = (sim: Sim, l: Layout): boolean => ORIGIN + l.width + 8 <= sim.sector.width && ORIGIN + l.height + 8 <= sim.sector.height;

/** Stamp a layout into a sim at ORIGIN and allocate power and light once, as a new game does (nothing is stepped; unlit, the hull tints dark and cold against the roof). Returns the ship, or null if it will not stand. */
export function stampLayout(sim: Sim, l: Layout): number | null {
  const ship = spawnShip(sim, { ...toTemplate(l), crew: [] }, { faction: (l.origin?.side ?? 'player') as NonNullable<ShipTemplate['faction']>, x: ORIGIN, y: ORIGIN, ...(l.origin ? { gen: l.origin.gen } : {}) });
  roomsSystem(sim);
  powerSystem(sim);
  lightingSystem(sim);
  return shipGrid(sim, ship) ? ship : null;
}

/** Replace the ship a sim holds with another layout, in place (the game's own wreck removal, then a new stamp): the preview's renderer keeps its world. */
export function restamp(sim: Sim, old: number, l: Layout): number | null {
  removeWreck(sim, old);
  return stampLayout(sim, l);
}

/** Whether two layouts differ only in their modules (the same tiles, rooms and stamp): an edit `swapModules` can apply. */
export function sameShell(a: Layout, b: Layout): boolean {
  if (a.width !== b.width || a.height !== b.height || a.immobile !== b.immobile || a.origin !== b.origin || a.rooms.length !== b.rooms.length) return false;
  if (a.cells !== b.cells && a.cells.some((row, y) => row !== b.cells[y])) return false;
  if (a.roomOf !== b.roomOf && a.roomOf.some((r, i) => r !== b.roomOf[i])) return false;
  return a.rooms.every((r, i) => r.role === b.rooms[i]?.role);
}

/**
 * Apply a modules-only edit to a stamped sim: the modules `from` has and `to` lacks go (the game's removal), the ones `to` adds are
 * spawned (the game's spawn), then power and light are allocated again. The ship, its grid and the renderer's scene of them stay, so
 * an edit costs the modules it touches instead of a whole restamp. False (the sim untouched) when the edit needs a restamp: a container,
 * an airlock, a bay, a stasis wheel or a module the sim cannot find.
 */
export function swapModules(w: World, from: Layout, to: Layout): boolean {
  const key = (m: Layout['modules'][number]): string => `${m.def}|${m.x}|${m.y}|${m.rot ?? 0}|${JSON.stringify(m.clamp ?? null)}`;
  const defs = content.modules as Record<string, ModuleDef>;
  const left = new Map<string, number>();
  for (const m of to.modules) left.set(key(m), (left.get(key(m)) ?? 0) + 1);
  const gone: Layout['modules'][number][] = [];
  for (const m of from.modules) { const k = key(m), n = left.get(k) ?? 0; if (n > 0) left.set(k, n - 1); else gone.push(m); }
  const added = to.modules.filter((m) => { const k = key(m), n = left.get(k) ?? 0; if (n > 0) { left.set(k, n - 1); return true; } return false; });
  const special = (m: Layout['modules'][number]): boolean => !!(defs[m.def]?.container || defs[m.def]?.airlock || defs[m.def]?.vehicleBay || defs[m.def]?.stasisWheel);
  if ([...gone, ...added].some(special)) return false;
  // The entities of the removed modules, matched by def and anchor.
  const ids: number[] = [];
  for (const m of gone) {
    let hit = 0;
    for (const id of w.sim.world.query(ModuleC)) { const c = w.sim.world.get(id, ModuleC); if (c && !ids.includes(id) && c.def === m.def && c.x === ORIGIN + m.x && c.y === ORIGIN + m.y && c.rot === (m.rot ?? 0)) { hit = id; break; } }
    if (!hit) return false;
    ids.push(hit);
  }
  for (const id of ids) despawn(w.sim, id);
  for (const m of added) spawnModule(w.sim, m.def, ORIGIN + m.x, ORIGIN + m.y, m.rot ?? 0);
  powerSystem(w.sim);
  lightingSystem(w.sim);
  return true;
}

/** A fresh sim with the layout stamped in. */
export function buildWorld(l: Layout): World | null {
  try {
    const sim = new Sim(1, content);
    sim.sector.width = Math.max(sim.sector.width, ORIGIN + l.width + 8);
    sim.sector.height = Math.max(sim.sector.height, ORIGIN + l.height + 8);
    const ship = stampLayout(sim, l);
    return ship === null ? null : { sim, ship };
  } catch {
    return null;
  }
}

export function worldOf(l: Layout): World | null {
  if (cache.has(l)) return cache.get(l) ?? null;
  const w = buildWorld(l);
  cache.set(l, w);
  return w;
}

/**
 * Why a module cannot stand at (x, y, rot) in this layout; null when it can. `ignore`: a module being moved (set aside; it keeps its clamp end, turned with it).
 * Ordinary modules go through the game's build check (`placementError`). Containers stand on the frame (Beam tiles), clamped by a short end,
 * which that check does not know: the game's template validator (`validateTemplate`) owns those rules, so the candidate is put into the
 * template and the validator's problems that name it are the answer.
 */
export function placementProblem(l: Layout, def: string, x: number, y: number, rot: number, ignore?: number): string | null {
  const base = ignore === undefined ? l : removeModule(l, ignore);
  if ((content.modules as Record<string, ModuleDef>)[def]?.container) {
    const old = ignore === undefined ? undefined : l.modules[ignore];
    // a moved or turned container keeps its end, turned with it; a new one gets the default end for its turn
    const t = toTemplate(addModule(base, old ? { def, x, y, rot, clamp: clampAt(old, rot) } : newModule(def, x, y, rot)));
    const name = `${def}@${x},${y}:`;
    const own = validateTemplate(t, content.modules as Record<string, ModuleDef>, { immobile: l.immobile }).find((p) => p.startsWith(name));
    return own ? own.slice(name.length).trim() : null;
  }
  const w = worldOf(base);
  return w ? placementError(w.sim, w.ship, def, ORIGIN + x, ORIGIN + y, rot) : 'noWorld';
}

/** The modules the power system left unpowered (indices into the layout's modules): the game's allocation, read after the first allocation. */
export function unpowered(l: Layout): number[] {
  const w = worldOf(l);
  if (!w) return [];
  const out: number[] = [];
  for (const id of w.sim.world.query(ModuleC)) {
    const m = w.sim.world.get(id, ModuleC);
    const def = m && content.modules[m.def as keyof typeof content.modules];
    // A module idle by its draw rule (a bed with nothing growing) draws nothing and is not short of power.
    if (!m || !def || m.powered || (def as { power: number }).power >= 0 || isIdle(w.sim, id, def as ModuleDef)) continue;
    const i = l.modules.findIndex((x) => x.def === m.def && x.x === m.x - ORIGIN && x.y === m.y - ORIGIN);
    if (i >= 0) out.push(i);
  }
  return out;
}
