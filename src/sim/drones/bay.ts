import { BodyC, ALT } from '../body';
import { shipById } from '../combat/ships';
import { StorageC } from '../items/components';
import { spillItems } from '../items/stacks';
import { storageTake } from '../items/storage';
import { ModuleC } from '../modules/components';
import { footprintTiles } from '../modules/footprint';
import { shipIdOf } from '../regions';
import { aiCores, isCoreLive } from '../robots/core';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { DRONE_CAP_BY_TIER } from '../tuning';
import { DroneC, type Drone } from './components';

/** True if the module is an intact drone bay. */
export function isDroneBay(sim: Sim, id: number): boolean {
  const m = sim.world.get(id, ModuleC);
  return !!m && m.hp > 0 && !!sim.content.modules[m.def]?.droneBay;
}

/** The tile a bay slot docks on: its footprint tiles in order (rotation applied), or the module origin. */
export function slotTile(sim: Sim, bay: number, slot: number): { x: number; y: number } {
  const m = sim.world.get(bay, ModuleC);
  const def = m && sim.content.modules[m.def];
  if (!m || !def) return { x: 0, y: 0 };
  const tiles = footprintTiles(def, m.x, m.y, m.rot);
  return tiles[slot] ?? tiles[0] ?? { x: m.x, y: m.y };
}

/** Drones whose home is this ship, ascending ids. */
export function dronesOf(sim: Sim, ship: number): number[] {
  return sim.world.query(DroneC).filter((id) => sim.world.get(id, DroneC)?.ship === ship);
}

/** The drones homed in a bay, by slot (0 = free). */
export function baySlots(sim: Sim, bay: number): number[] {
  const m = sim.world.get(bay, ModuleC);
  const n = (m && sim.content.modules[m.def]?.droneBay?.slots) ?? 0;
  const out = new Array<number>(n).fill(0);
  for (const id of sim.world.query(DroneC)) {
    const d = sim.world.get(id, DroneC) as Drone;
    if (d.bay === bay && d.slot < n) out[d.slot] = id;
  }
  return out;
}

/** A free slot in any intact drone bay on the ship (lowest bay id, then slot), or null. */
export function freeSlot(sim: Sim, ship: number): { bay: number; slot: number } | null {
  for (const bay of sim.world.query(ModuleC)) {
    if (!isDroneBay(sim, bay) || shipIdOf(sim, sim.world.get(bay, ModuleC)) !== ship) continue;
    const slot = baySlots(sim, bay).indexOf(0);
    if (slot >= 0) return { bay, slot };
  }
  return null;
}

/**
 * How many of the ship's drones may be out of their bays at once: by the best live AI core of the ship's own faction (DRONE_CAP_BY_TIER).
 * 0 with no live core (its drones are inert).
 */
export function droneCap(sim: Sim, ship: number): number {
  const faction = shipById(sim, ship)?.faction;
  let tier = 0;
  for (const id of aiCores(sim, ship)) {
    if (!isCoreLive(sim, id)) continue;
    tier = Math.max(tier, sim.content.modules[sim.world.get(id, ModuleC)?.def ?? '']?.aiCore?.tier ?? 0);
  }
  if (!faction) return 0;
  return DRONE_CAP_BY_TIER[Math.min(tier, DRONE_CAP_BY_TIER.length - 1)] ?? 0;
}

/** A new drone of `def`, docked in a bay slot (charged: it comes out of the box ready). */
export function spawnDrone(sim: Sim, def: string, bay: number, slot: number): number {
  const d = sim.content.drones?.[def];
  const m = sim.world.get(bay, ModuleC);
  if (!d || !m) return 0;
  const ship = shipIdOf(sim, m);
  const at = slotTile(sim, bay, slot);
  const id = sim.world.createEntity();
  sim.world.add(id, DroneC, {
    def, ship, bay, slot, state: 'docked', charge: 100, hp: d.maxHp, target: null, steps: [], work: 0, inert: false, stunUntil: 0,
    space: false, lift: 0, cool: 0,
  });
  sim.world.add(id, BodyC, { x: at.x + 0.5, y: at.y + 0.5, heading: 0, alt: ALT.dronePad });
  return id;
}

/**
 * Drone bays fill themselves (fully automatic, DESIGN.md "Drones"): a free slot takes a drone item from its ship's storage, the way a
 * vehicle bay takes a shuttle (vehicle.assign), and it becomes a drone docked there.
 */
export function installDrones(sim: Sim): void {
  for (const bay of sim.world.query(ModuleC)) {
    if (!isDroneBay(sim, bay)) continue;
    const ship = shipIdOf(sim, sim.world.get(bay, ModuleC));
    const slots = baySlots(sim, bay);
    for (let slot = 0; slot < slots.length; slot++) {
      if (slots[slot]) continue;
      const def = takeDroneItem(sim, ship);
      if (!def) break; // none on this ship: the next bay may be on another
      const id = spawnDrone(sim, def, bay, slot);
      if (id) sim.events.emit({ type: 'drone.installed', drone: id, bay, ship });
    }
  }
}

/** Take one drone item from the ship's storage (storage modules in id order); its DroneDef id, or null when there is none. */
function takeDroneItem(sim: Sim, ship: number): string | null {
  for (const sid of sim.world.query(StorageC)) {
    if (shipIdOf(sim, sim.world.get(sid, ModuleC)) !== ship) continue;
    for (const st of sim.world.get(sid, StorageC)?.stacks ?? []) {
      const def = sim.content.items[st.item]?.drone;
      if (!def || !sim.content.drones?.[def]) continue;
      if (storageTake(sim, sid, st.item, 1) === 1) return def;
    }
  }
  return null;
}

/** Ion or EMP within `radius` tiles (Chebyshev) of (x, y) on a ship knocks out the drones there for their def's ionStunSec. */
export function stunDronesNear(sim: Sim, ship: number, x: number, y: number, radius: number): void {
  for (const id of sim.world.query(DroneC, BodyC)) {
    const b = sim.world.get(id, BodyC);
    if (!b || shipIdOf(sim, { x: Math.floor(b.x), y: Math.floor(b.y) }) !== ship) continue;
    if (Math.max(Math.abs(Math.floor(b.x) - x), Math.abs(Math.floor(b.y) - y)) > radius) continue;
    stunDrone(sim, id, sim.content.drones?.[sim.world.get(id, DroneC)?.def ?? '']?.ionStunSec ?? 0);
  }
}

/** Knock a drone out for `sec` seconds (timers do not stack). */
export function stunDrone(sim: Sim, id: number, sec: number): void {
  const d = sim.world.get(id, DroneC);
  if (!d || sec <= 0) return;
  const until = Math.max(d.stunUntil, sim.tick + Math.round(sec * TICK_HZ));
  if (until === d.stunUntil) return;
  d.stunUntil = until;
  sim.events.emit({ type: 'drone.stunned', drone: id, until });
}

/** A destroyed drone: inside a ship its wreck items fall where it was (in space they are lost), and the entity goes. */
export function wreckDrone(sim: Sim, id: number): void {
  const d = sim.world.get(id, DroneC);
  const b = sim.world.get(id, BodyC);
  if (!d) return;
  const x = Math.floor(b?.x ?? 0), y = Math.floor(b?.y ?? 0);
  const ship = d.space ? 0 : shipIdOf(sim, { x, y });
  if (ship) for (const q of sim.content.drones?.[d.def]?.wreck ?? []) spillItems(sim, ship, x, y, q.item, q.count);
  sim.events.emit({ type: 'drone.wrecked', drone: id, ship: d.ship, def: d.def, x, y, space: d.space });
  sim.world.destroyEntity(id);
}
