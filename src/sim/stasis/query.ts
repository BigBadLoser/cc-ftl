import { AssignmentC, JobC, PathC, PositionC } from '../crew/components';
import type { Tile } from '../crew/pathfind';
import { CarryingC } from '../items/components';
import { ModuleC, type Module } from '../modules/components';
import { accessTile } from '../modules/footprint';
import type { ModuleDef } from '../registry';
import { shipIdAt, shipIdOf } from '../regions';
import type { World } from '../ecs';
import type { Sim } from '../sim';
import { CartRestC, SLOT_EMPTY, SLOT_NONE, StasisC, StasisWheelC } from './components';
import { floorTiles } from './place';
import { RESERVE_TICKS, SLAB_ITEM } from './tuning';

/**
 * The owning reads of prisoner holding (#116): every system, the renderer and the UI ask these, never the components directly.
 * A full slab is the frozen prisoner's crew entity (StasisC); an empty slab is the item `item.stasis_slab` or an empty wheel slot.
 */

/** One wheel slot: nothing, an empty slab, or the full slab of `prisoner`. */
export type WheelSlot = { kind: 'none' } | { kind: 'empty' } | { kind: 'full'; prisoner: number };

/**
 * A stasis wheel's slots in order (empty array for a module that is not a wheel). Slot 0 is the one at the wheel's access (hatch) corner; the
 * rest follow counter-clockwise seen from above, in the module's own unrotated frame.
 */
export function wheelSlots(world: World, wheel: number): WheelSlot[] {
  return (world.get(wheel, StasisWheelC)?.slots ?? []).map((s) => (s === SLOT_NONE ? { kind: 'none' } : s === SLOT_EMPTY ? { kind: 'empty' } : { kind: 'full', prisoner: s }));
}

/** Where a full slab is: in a wheel slot, on a crew member's hover cart, or lying on the floor (its two tiles and which way it lies). */
export type SlabPlace =
  | { kind: 'wheel'; ship: number; wheel: number; slot: number }
  | { kind: 'carried'; ship: number; crew: number }
  | { kind: 'floor'; ship: number; tiles: [Tile, Tile]; rot: 0 | 1 };

/** True if the crew member is frozen in a stasis slab (out of the world until they thaw). */
export const isFrozen = (sim: Sim, crew: number): boolean => sim.world.has(crew, StasisC);

/** The wheel and slot holding the prisoner's slab, or null when it is in none. */
export function wheelOf(sim: Sim, prisoner: number): { wheel: number; slot: number } | null {
  for (const wheel of sim.world.query(StasisWheelC)) {
    const slot = sim.world.get(wheel, StasisWheelC)?.slots.indexOf(prisoner) ?? -1;
    if (slot >= 0) return { wheel, slot };
  }
  return null;
}

/** Where the prisoner's full slab is, or null when they are not frozen. */
export function slabPlace(sim: Sim, prisoner: number): SlabPlace | null {
  const s = sim.world.get(prisoner, StasisC);
  if (!s) return null;
  if (s.at === 'wheel') {
    const w = wheelOf(sim, prisoner);
    const m = w && sim.world.get(w.wheel, ModuleC);
    if (w && m) return { kind: 'wheel', ship: shipIdOf(sim, m), ...w };
  }
  if (s.at === 'carried') return { kind: 'carried', ship: shipIdOf(sim, sim.world.get(s.carrier, PositionC) ?? s), crew: s.carrier };
  return { kind: 'floor', ship: shipIdAt(sim, s.x, s.y), tiles: floorTiles(s.x, s.y, s.rot), rot: s.rot };
}

/** Full slabs lying on the floor (a carry cut short): the prisoner, the slab's two tiles (the second at +1 along x for rot 0, along y for rot 1). */
export function floorSlabs(world: World): { prisoner: number; tiles: [Tile, Tile]; rot: 0 | 1 }[] {
  const out: { prisoner: number; tiles: [Tile, Tile]; rot: 0 | 1 }[] = [];
  for (const id of world.query(StasisC)) {
    const s = world.get(id, StasisC);
    if (s?.at === 'floor') out.push({ prisoner: id, tiles: floorTiles(s.x, s.y, s.rot), rot: s.rot });
  }
  return out;
}

/** A full slab's prisoner and how much of its reserve is left (0..1). Null when `prisoner` is not frozen. */
export function slabInfo(sim: Sim, prisoner: number): { prisoner: number; reserve: number } | null {
  const s = sim.world.get(prisoner, StasisC);
  return s ? { prisoner, reserve: Math.max(0, Math.min(1, s.reserve / RESERVE_TICKS)) } : null;
}

/** Every frozen prisoner (every full slab), ascending ids. */
export const fullSlabs = (sim: Sim): number[] => [...sim.world.query(StasisC)].sort((a, b) => a - b);

/** True while the slab stands in a powered wheel (so it holds its prisoner and refills its reserve). */
export function slabHeld(sim: Sim, prisoner: number): boolean {
  if (sim.world.get(prisoner, StasisC)?.at !== 'wheel') return false;
  const w = wheelOf(sim, prisoner);
  return !!w && !!sim.world.get(w.wheel, ModuleC)?.powered;
}

/** True while the slab runs on its reserve: out of a powered wheel and not on a hover cart (the cart's field keeps it). The alert reads this. */
export function slabDraining(sim: Sim, prisoner: number): boolean {
  const s = sim.world.get(prisoner, StasisC);
  return !!s && s.at !== 'carried' && !slabHeld(sim, prisoner);
}

/** The prisoner whose slab the crew member has on their cart, or 0. */
export function carriedSlabOf(world: World, crew: number): number {
  for (const id of world.query(StasisC)) {
    const s = world.get(id, StasisC);
    if (s?.at === 'carried' && s.carrier === crew) return id;
  }
  return 0;
}

/** True if the crew member is pushing a slab on a hover cart: a full one (a prisoner's) or an empty one they fetched. The renderer draws the cart from this. */
export function onCart(world: World, crew: number): boolean {
  return world.get(crew, CarryingC)?.item === SLAB_ITEM || carriedSlabOf(world, crew) !== 0;
}

/** True while the crew member is on the move: mid-step or with steps left to walk. */
export function walking(world: World, crew: number): boolean {
  const p = world.get(crew, PositionC);
  return !!p && (p.toX !== p.x || p.toY !== p.y || p.progress > 0 || (world.get(crew, PathC)?.steps.length ?? 0) > 0);
}

/**
 * Where the hover cart of a crew member pushing a slab (`onCart`) stands while they are not walking: its two tiles, (x, y) and the next along +x
 * (`rot` 0) or +y (`rot` 1), as `floorTiles`. One tile is beside the carrier and the cart lies straight out from them, so its push bar touches
 * them; it is on free walkable floor (no floor slab, no other parked cart), toward the job's target where it can be but never on it. Chosen once
 * when they stop and kept until they walk again (`CartRestC`, set by the stasis system). Null while walking, when not carting, or when no side
 * had room (then no cart is drawn).
 */
export function cartRest(world: World, crew: number): { x: number; y: number; rot: 0 | 1 } | null {
  const r = world.get(crew, CartRestC);
  return r && onCart(world, crew) && !walking(world, crew) ? { x: r.x, y: r.y, rot: r.rot } : null;
}

/** True if the crew member has the prisoner's slab on their cart for the stasis job they hold (anything else is a carry that ended). */
export function cartsFor(sim: Sim, crew: number, prisoner: number): boolean {
  const s = sim.world.get(prisoner, StasisC);
  const job = sim.world.get(sim.world.get(crew, AssignmentC)?.jobId ?? 0, JobC);
  return s?.at === 'carried' && s.carrier === crew && job?.kind === 'stasis' && job.target === prisoner;
}

/** The tile crew stand at to load or unload a wheel: its access (hatch) tile, else its anchor. */
export function wheelHatch(sim: Sim, m: Module): Tile {
  const def = sim.content.modules[m.def] as ModuleDef | undefined;
  return (def && accessTile(def, m.x, m.y, m.rot)) ?? { x: m.x, y: m.y };
}

/** Can this wheel take one more full slab: intact, and a slot that is free or holds an empty slab (which makes way)? */
export function wheelTakes(sim: Sim, wheel: number): boolean {
  const m = sim.world.get(wheel, ModuleC);
  return !!m && m.hp > 0 && freeSlots(sim, wheel) > 0;
}

/** Slots of a wheel not holding a full slab (free, or holding an empty slab). */
export const freeSlots = (sim: Sim, wheel: number): number => (sim.world.get(wheel, StasisWheelC)?.slots ?? []).filter((s) => s <= 0).length;

/** Empty slabs standing in a wheel's slots. */
export const emptySlabsIn = (sim: Sim, wheel: number): number => (sim.world.get(wheel, StasisWheelC)?.slots ?? []).filter((s) => s === SLOT_EMPTY).length;

/** True if the wheel holds at least one full slab (it draws power only then: `ModuleDef.drawsWhen` 'holding'). */
export const wheelHolding = (sim: Sim, wheel: number): boolean => (sim.world.get(wheel, StasisWheelC)?.slots ?? []).some((s) => s > 0);
