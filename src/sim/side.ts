import { ShipC, type ShipState } from './combat/components';
import { shipById } from './combat/shipQuery';
import { CrewC, DeadC, PositionC } from './crew/components';
import { AllegianceC, PrisonerC, SurrenderedC } from './fight/components';
import { ItemStackC, StorageC } from './items/components';
import { ModuleC } from './modules/components';
import { guardPacked } from './packedGuard';
import { shipIdAt, shipIdOf } from './regions';
import type { Sim } from './sim';
import { VehicleC } from './vehicles/components';

/**
 * Whose is this: the one owner of "which side controls this ship, crew member, module, stack or vehicle" and of the collections by side
 * (docs/ARCHITECTURE.md "One answer per question"). A side is a faction id; the player is `PLAYER`, the only place the literal lives. Hostility
 * ("who are my foes") is a different question and stays in `fight/relations.ts` (`foesOf`, `isFoeOf`, `isHostile`).
 *
 * The ship's crew, cargo and modules are packet data, not world entities, while the player's ship is in hyperspace. A collection here calls
 * `guardPacked` unless `packedOk` says "nobody / none while the ship is away" is the right answer (see `packedGuard.ts`).
 */
export type Side = string;
export const PLAYER: Side = 'player';

/**
 * Who controls an entity, or null when it has no side. Ship: its faction. Crew: its allegiance; a prisoner is held by `PrisonerC.holder` (the
 * player when absent). Vehicle: its home ship's side. Module, storage, item stack: the ship it stands on.
 */
export function sideOf(sim: Sim, entity: number): Side | null {
  const w = sim.world;
  const ship = w.get(entity, ShipC);
  if (ship) return ship.faction;
  const v = w.get(entity, VehicleC);
  if (v) return shipById(sim, v.homeShip)?.faction ?? 'neutral';
  const allegiance = w.get(entity, AllegianceC);
  if (allegiance) {
    const prisoner = w.get(entity, PrisonerC);
    return prisoner ? (prisoner.holder ?? PLAYER) : allegiance.faction;
  }
  const at = w.get(entity, ModuleC) ?? w.get(entity, ItemStackC);
  return at ? (shipById(sim, shipIdOf(sim, at))?.faction ?? null) : null;
}

/** True if the entity is on the player's side (`sideOf`). */
export const isPlayers = (sim: Sim, entity: number): boolean => sideOf(sim, entity) === PLAYER;

export interface PackedOpt {
  /** Answer "none" while the side's ship is a hyperspace packet, instead of flagging the read (`guardPacked`). */
  packedOk?: boolean;
}

/** Ship ids of a side's ships. `states` defaults to every ship that is not a wreck (active, disabled, fled, prize). */
export function shipsOf(sim: Sim, side: Side, opts: PackedOpt & { states?: readonly ShipState[] } = {}): Set<number> {
  if (!opts.packedOk) guardPacked(sim, 'shipsOf');
  const { states } = opts;
  const out = new Set<number>();
  for (const id of sim.world.query(ShipC)) {
    const s = sim.world.get(id, ShipC);
    if (s?.faction === side && (states ? states.includes(s.state) : s.state !== 'wreck')) out.add(id);
  }
  return out;
}

/** The side's main ship: the lowest-id active or disabled ship of the side, or 0. */
export function mainShipOf(sim: Sim, side: Side, opts: PackedOpt = {}): number {
  if (!opts.packedOk) guardPacked(sim, 'mainShipOf');
  for (const id of sim.world.query(ShipC)) {
    const s = sim.world.get(id, ShipC);
    if (s?.faction === side && (s.state === 'active' || s.state === 'disabled')) return id;
  }
  return 0;
}

/** The side's main ship wherever it is: its entity in a node, or the hyperspace packet's ship while the player's ship is packed (0 when there is none). */
export function mainShipIdOf(sim: Sim, side: Side): number {
  return mainShipOf(sim, side, { packedOk: true }) || (side === PLAYER && sim.sector.state === 'hyperspace' ? (sim.sector.packet?.ship ?? 0) : 0);
}

/**
 * Living crew of a side, ascending id. `on`: only those standing on that ship. `free`: not surrendered (the workforce; without it surrendered
 * and captured crew count, as in every `isHostile` question about "us").
 */
export function crewOf(sim: Sim, side: Side, opts: PackedOpt & { on?: number; free?: boolean } = {}): number[] {
  if (!opts.packedOk) guardPacked(sim, 'crewOf');
  const w = sim.world;
  const { on, free } = opts;
  const ids = on === undefined ? w.query(CrewC, AllegianceC) : w.query(CrewC, AllegianceC, PositionC);
  return ids.filter((id) => {
    if (w.get(id, AllegianceC)?.faction !== side || w.has(id, DeadC) || (free && w.has(id, SurrenderedC))) return false;
    return on === undefined || shipIdOf(sim, w.get(id, PositionC)) === on;
  }).slice().sort((a, b) => a - b);
}

/** Module entity ids on a side's ships (of one def when given), ascending id. */
export function modulesOf(sim: Sim, side: Side, def?: string): number[] {
  const grids = shipsOf(sim, side);
  return sim.world.query(ModuleC).filter((id) => {
    const m = sim.world.get(id, ModuleC);
    return !!m && grids.has(shipIdOf(sim, m)) && (def === undefined || m.def === def);
  });
}

/** Storage modules on a side's ships, ascending id. With `ship`, only those on that ship (its main ship: `mainShipOf`). */
export function storagesOf(sim: Sim, side: Side, opts: { ship?: number } = {}): number[] {
  const { ship } = opts;
  const grids = ship === undefined ? shipsOf(sim, side) : null;
  return sim.world.query(StorageC, ModuleC).filter((id) => {
    const on = shipIdOf(sim, sim.world.get(id, ModuleC));
    return grids ? grids.has(on) : on === ship;
  });
}

/** Units of an item a side's ships hold: their storage modules plus every loose stack on them (delivery crates too). Carried, wielded and fitted items never count. */
export function stockOf(sim: Sim, side: Side, item: string): number {
  guardPacked(sim, 'stockOf');
  const w = sim.world;
  const ships = shipsOf(sim, side);
  let n = 0;
  for (const id of storagesOf(sim, side)) for (const st of w.get(id, StorageC)?.stacks ?? []) if (st.item === item) n += st.count;
  for (const id of w.query(ItemStackC)) {
    const s = w.get(id, ItemStackC);
    if (s && s.item === item && ships.has(shipIdAt(sim, s.x, s.y))) n += s.count;
  }
  return n;
}
