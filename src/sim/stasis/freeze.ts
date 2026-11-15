import { abortTask } from '../ai/task';
import { releaseBed } from '../crew/beds';
import { CarriedC, CrewC, DownedC, DraftedC, PathC, PositionC, RecoveringC, type Crew } from '../crew/components';
import { leaveCare } from '../crew/recovery';
import type { Tile } from '../crew/pathfind';
import { FighterC, PrisonerC, SurrenderedC } from '../fight/components';
import { CarryingC, ItemStackC } from '../items/components';
import { dropCarried, spillItems, takeFromStack } from '../items/stacks';
import { storageCount, storageTake } from '../items/storage';
import { ModuleC } from '../modules/components';
import { shipIdAt, shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { SLOT_EMPTY, SLOT_NONE, SlabRackC, StasisC, StasisWheelC, type SlabSource } from './components';
import { floorSpot, standSpot } from './place';
import { slabPlace, wheelHatch, wheelOf } from './query';
import { turnRing, turnsToLoad } from './ring';
import { RACK_SLOTS, RESERVE_TICKS, SLAB_ITEM } from './tuning';

/** Take one empty slab out of a source. True if one was there. A wheel gives up its lowest slot holding one. */
export function takeEmptySlab(sim: Sim, from: SlabSource): boolean {
  if (from.kind === 'wheel') {
    const slots = sim.world.get(from.id, StasisWheelC)?.slots;
    const i = slots?.indexOf(SLOT_EMPTY) ?? -1;
    if (!slots || i < 0) return false;
    slots[i] = SLOT_NONE;
    return true;
  }
  if (from.kind === 'storage') return storageTake(sim, from.id, SLAB_ITEM, 1) === 1;
  if (from.kind === 'rack') {
    const rack = sim.world.get(from.id, SlabRackC);
    if (!rack || rack.empty <= 0) return false;
    rack.empty--;
    return true;
  }
  return sim.world.get(from.id, ItemStackC)?.item === SLAB_ITEM && takeFromStack(sim, from.id, 1) === 1;
}

/**
 * The one way a crew member comes to hold an empty slab: true if they hold one afterwards. One already in hand is kept and nothing more is taken
 * (a fetch that runs again never empties a source into thin air); any other load is set down first, then one slab is taken from `from`.
 */
export function takeSlabFor(sim: Sim, crew: number, from: SlabSource | undefined): boolean {
  if (sim.world.get(crew, CarryingC)?.item === SLAB_ITEM) return true;
  if (!from || !sourceHasSlab(sim, from)) return false;
  dropCarried(sim, crew);
  if (!takeEmptySlab(sim, from)) return false;
  sim.world.add(crew, CarryingC, { item: SLAB_ITEM, count: 1 });
  return true;
}

/** True if the source still holds an empty slab. */
function sourceHasSlab(sim: Sim, from: SlabSource): boolean {
  if (from.kind === 'wheel') return (sim.world.get(from.id, StasisWheelC)?.slots ?? []).includes(SLOT_EMPTY);
  if (from.kind === 'storage') return storageCount(sim, from.id, SLAB_ITEM) > 0;
  if (from.kind === 'rack') return (sim.world.get(from.id, SlabRackC)?.empty ?? 0) > 0;
  const st = sim.world.get(from.id, ItemStackC);
  return st?.item === SLAB_ITEM && st.count > 0;
}

/** Take up to `n` empty slabs out of a wheel's slots (a seizure, a sale); returns how many. */
export function takeEmptySlabs(sim: Sim, wheel: number, n: number): number {
  let k = 0;
  while (k < n && takeEmptySlab(sim, { kind: 'wheel', id: wheel })) k++;
  return k;
}

/**
 * Seal a prisoner into a full slab on `carrier`'s hover cart: they leave the world (no Position, Path, carry or job; a bed held for them is let go)
 * and their slab starts on a full reserve. The caller has used up the empty slab.
 */
export function sealPrisoner(sim: Sim, prisoner: number, carrier: number): void {
  const pos = sim.world.get(prisoner, PositionC);
  const at = sim.world.get(carrier, PositionC) ?? pos;
  abortTask(sim, prisoner, 'imprisoned');
  const downed = sim.world.get(prisoner, DownedC);
  if (downed?.bed) {
    releaseBed(sim, downed.bed, prisoner);
    downed.bed = 0;
  }
  const rec = sim.world.get(prisoner, RecoveringC);
  if (rec) leaveCare(sim, prisoner, rec); // out of a recovery pod: the pod is free again
  for (const key of [PositionC, PathC, CarriedC, DraftedC]) sim.world.remove(prisoner, key);
  sim.world.add(prisoner, StasisC, { reserve: RESERVE_TICKS, at: 'carried', carrier, x: at?.x ?? 0, y: at?.y ?? 0, rot: 0 });
  sim.events.emit({ type: 'stasis.sealed', crew: prisoner, by: carrier, ship: shipIdOf(sim, at) });
}

/** Put the slab on `crew`'s hover cart. */
export function liftSlab(sim: Sim, prisoner: number, crew: number): void {
  const s = sim.world.get(prisoner, StasisC);
  if (s) Object.assign(s, { at: 'carried', carrier: crew });
}

/** Set the slab down on the floor near `near` (on ship `ship`): the nearest pair of free floor tiles. */
export function dropSlab(sim: Sim, prisoner: number, ship: number, near: Tile): void {
  const s = sim.world.get(prisoner, StasisC);
  if (!s) return;
  const spot = floorSpot(sim, prisoner, ship, near);
  Object.assign(s, { at: 'floor', carrier: 0, x: spot.x, y: spot.y, rot: spot.rot });
}

/**
 * Stand the slab in a slot of `wheel`: the first slot holding nothing, else the first one holding an empty slab (that slab is set out on the floor at the
 * hatch, for the haulers), after turning the wheel to bring it to the hatch (ring.ts). Once it is in, the wheel steps on once (the loading animation's
 * closing star step), bringing the next slot to the hatch: the slab ends in the last slot. Returns that slot, or -1 when the wheel is full.
 */
export function stowSlab(sim: Sim, prisoner: number, wheel: number): number {
  const slots = sim.world.get(wheel, StasisWheelC)?.slots;
  const m = sim.world.get(wheel, ModuleC);
  const s = sim.world.get(prisoner, StasisC);
  if (!slots || !m || !s) return -1;
  const turns = turnsToLoad(slots);
  if (turns < 0) return -1;
  turnRing(slots, turns);                                // the wheel turned: the slot comes to the hatch, slot 0
  const slot = 0;
  const hatch = wheelHatch(sim, m);
  if (slots[slot] === SLOT_EMPTY) spillItems(sim, shipIdOf(sim, m), hatch.x, hatch.y, SLAB_ITEM, 1);
  slots[slot] = prisoner;
  Object.assign(s, { at: 'wheel', carrier: 0, x: hatch.x, y: hatch.y });
  turnRing(slots, 1);                                    // the closing star step: the next slot to the hatch
  return slots.length - 1;
}

/**
 * Hand the slab into the rack of the shuttle `vehicle` (on `at`, its rack tile): it keeps its charge there, and rides where the shuttle goes. A rack
 * with no free place sets one of its empty slabs out first (`rackRoom`: empty slabs make way).
 */
export function rackSlab(sim: Sim, prisoner: number, vehicle: number, at: Tile): void {
  const s = sim.world.get(prisoner, StasisC);
  const rack = sim.world.get(vehicle, SlabRackC);
  const full = sim.world.query(StasisC).filter((id) => sim.world.get(id, StasisC)?.at === 'vehicle' && sim.world.get(id, StasisC)?.carrier === vehicle).length;
  if (rack && rack.empty > 0 && rack.empty + full >= RACK_SLOTS) {
    // The rack is full of empty slabs: one makes way, set out on the floor (it is stock again).
    rack.empty--;
    spillItems(sim, shipIdAt(sim, at.x, at.y), at.x, at.y, SLAB_ITEM, 1);
  }
  if (s) Object.assign(s, { at: 'vehicle', carrier: vehicle, x: at.x, y: at.y, rot: 0 });
}

/** Put one empty slab into a shuttle's rack. */
export function rackEmptySlab(sim: Sim, vehicle: number): void {
  const rack = sim.world.get(vehicle, SlabRackC);
  if (rack) rack.empty++;
  else sim.world.add(vehicle, SlabRackC, { empty: 1 });
}

/** A wheel is built: every slot holds an empty slab. */
export function initWheel(sim: Sim, wheel: number, slots: number): void {
  sim.world.add(wheel, StasisWheelC, { slots: new Array<number>(slots).fill(SLOT_EMPTY) });
}

/** A wheel is taken down: its full slabs are set on the floor by its hatch (running on their reserve) and its empty slabs spill as items. */
export function releaseWheel(sim: Sim, wheel: number): void {
  const w = sim.world.get(wheel, StasisWheelC);
  const m = sim.world.get(wheel, ModuleC);
  if (!w || !m) return;
  const ship = shipIdOf(sim, m);
  const hatch = wheelHatch(sim, m);
  const empty = w.slots.filter((s) => s === SLOT_EMPTY).length;
  for (const s of w.slots) if (s > 0) dropSlab(sim, s, ship, hatch);
  w.slots.fill(SLOT_NONE);
  if (empty > 0) spillItems(sim, ship, hatch.x, hatch.y, SLAB_ITEM, empty);
}

/**
 * Open a full slab: the prisoner is out of it (no `StasisC`) and the slab is left empty where it was: back in its wheel slot, as an item on the
 * floor, or back in its shuttle's rack. A slab on a hover cart is left on the floor where the cart is. Returns where the prisoner steps out (the ship
 * and the slab's tile), or null when they are not frozen. The one way out of a slab: a thaw and a release both go through it.
 */
export function openSlab(sim: Sim, prisoner: number): { ship: number; x: number; y: number } | null {
  const place = slabPlace(sim, prisoner);
  const s = sim.world.get(prisoner, StasisC);
  if (!place || !s) return null;
  const from = { x: s.x, y: s.y };
  if (place.kind === 'wheel') {
    const w = wheelOf(sim, prisoner);
    const slots = w && sim.world.get(w.wheel, StasisWheelC)?.slots;
    if (slots && w) slots[w.slot] = SLOT_EMPTY;
  } else if (place.kind === 'shuttle') {
    rackEmptySlab(sim, place.vehicle);
  } else {
    spillItems(sim, place.ship || shipIdAt(sim, from.x, from.y), from.x, from.y, SLAB_ITEM, 1);
  }
  sim.world.remove(prisoner, StasisC);
  return { ship: place.ship || shipIdAt(sim, from.x, from.y), ...from };
}

/**
 * The slab's reserve ran out: the prisoner thaws and is back in the world, hostile. They step out where the slab is (by the wheel's hatch, or
 * beside a slab on the floor), no longer a prisoner, and stand drafted (like a boarder who lands) so they fight rather than take jobs. The slab
 * is left empty (`openSlab`).
 */
export function thawPrisoner(sim: Sim, prisoner: number): void {
  const out = openSlab(sim, prisoner);
  if (!out) return;
  const ship = out.ship;
  const at = standSpot(sim, ship, out);
  sim.world.remove(prisoner, PrisonerC);
  sim.world.remove(prisoner, SurrenderedC);
  sim.world.add(prisoner, PositionC, { x: at.x, y: at.y, toX: at.x, toY: at.y, progress: 0, facing: 0 });
  sim.world.add(prisoner, PathC, { steps: [] });
  const downed = sim.world.has(prisoner, DownedC);
  if (!downed) sim.world.add(prisoner, DraftedC, { target: null });
  const f = sim.world.get(prisoner, FighterC);
  if (f) Object.assign(f, { mode: 'idle', target: 0, ordered: 0, engage: true });
  const crew = sim.world.get(prisoner, CrewC) as Crew | undefined;
  if (crew) crew.activity = downed ? 'downed' : 'drafted';
  sim.events.emit({ type: 'stasis.thawed', crew: prisoner, ship, x: at.x, y: at.y });
}
