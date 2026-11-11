/**
 * A sim built from a layout and never stepped: the preview renders it and the game's owners answer about it (placement, power).
 * Built once per layout and kept; building a big station takes about 60 ms.
 */
import { content } from '../../src/content';
import { ModuleC, Sim, shipGrid, spawnShip } from '../../src/sim';
import { removeWreck } from '../../src/sim/salvage/remove';
import { placementError } from '../../src/sim/modules/spawn';
import { powerSystem } from '../../src/sim/systems/power';
import { ORIGIN } from './camera';
import { removeModule, toTemplate, type Layout } from './layout';

export interface World { sim: Sim; ship: number }
const cache = new WeakMap<Layout, World | null>();

/** Whether a layout fits the sector a sim has. */
export const fits = (sim: Sim, l: Layout): boolean => ORIGIN + l.width + 8 <= sim.sector.width && ORIGIN + l.height + 8 <= sim.sector.height;

/** Stamp a layout into a sim at ORIGIN and allocate power once, as a new game does (nothing is stepped). Returns the ship, or null if it will not stand. */
export function stampLayout(sim: Sim, l: Layout): number | null {
  const ship = spawnShip(sim, { ...toTemplate(l), crew: [] }, { faction: 'player', x: ORIGIN, y: ORIGIN });
  powerSystem(sim);
  return shipGrid(sim, ship) ? ship : null;
}

/** Replace the ship a sim holds with another layout, in place (the game's own wreck removal, then a new stamp): the preview's renderer keeps its world. */
export function restamp(sim: Sim, old: number, l: Layout): number | null {
  removeWreck(sim, old);
  return stampLayout(sim, l);
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

/** Why a module cannot stand at (x, y, rot) in this layout, from the game's own placement check; null when it can. `ignore`: a module being moved. */
export function placementProblem(l: Layout, def: string, x: number, y: number, rot: number, ignore?: number): string | null {
  const base = ignore === undefined ? l : removeModule(l, ignore);
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
    if (!m || !def || m.powered || (def as { power: number }).power >= 0) continue;
    const i = l.modules.findIndex((x) => x.def === m.def && x.x === m.x - ORIGIN && x.y === m.y - ORIGIN);
    if (i >= 0) out.push(i);
  }
  return out;
}
