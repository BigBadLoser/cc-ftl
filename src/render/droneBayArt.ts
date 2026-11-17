import type { World } from '../sim/ecs';
import { DroneC } from '../sim/drones/components';
import type { Module } from '../sim/modules/components';
import type { ModuleDef } from '../sim/registry';
import { stateArt, type ModuleLayer, type ModuleLook } from './moduleArt';

/**
 * Depth of the drone bay's pieces, in tiles of sector depth over the bay's front tile (x + y). The drones (droneView) sort at
 * BAY_PLATE_DEPTH + DRONE_DECK_DEPTH over it on the deck (a hovering one at DRONE_AIR_DEPTH); the bay's own sprite sorts just
 * behind the front tile, so its `.front` overlay (the bay pixels that stand in front of a docked drone: the front posts, the cradle
 * ring) has to clear the docked drones or they draw over the cage they sit in.
 */
export const BAY_PLATE_DEPTH = 0.3;
export const DRONE_DECK_DEPTH = 0.4;
export const DRONE_AIR_DEPTH = 0.9;
/** The module key sits 0.05 behind its front tile (moduleKey): the overlay's offset lifts it a little over a docked drone. */
export const DRONE_BAY_FRONT_DZ = BAY_PLATE_DEPTH + DRONE_DECK_DEPTH + 0.1;

/** A bay's contact lights are on: one of its drones sits docked and not full, awake and not stunned. The one answer; the art and the placeholder pads ask it. */
export function bayCharging(world: World, bay: number): boolean {
  for (const id of world.query(DroneC)) {
    const d = world.get(id, DroneC);
    if (d && d.bay === bay && d.state === 'docked' && d.charge < 100 && !d.inert && d.stunUntil === 0) return true;
  }
  return false;
}

/**
 * Sprite layers of a drone bay (`module.drone_bay.r<rot>`, art contract in tools/blender/sprites/drone_family.py), bottom first: the
 * bay with its damaged / unpowered / charging state, then the docked drones (droneView), then its `.front` overlay over them.
 */
export function droneBayLayers(world: World, id: number, m: Module, def: ModuleDef, active: boolean, look?: ModuleLook): ModuleLayer[] {
  const a = def.asset;
  const r = `${a}.r${m.rot}`;
  const head = stateArt(def, m.rot, active, look).head;
  const base = head[0] ?? (bayCharging(world, id) ? `${r}.charging` : r);
  const out: ModuleLayer[] = [{ chain: [...head, base, r, a], key: a, tiles: 'all' }];
  if (!/\.(damaged|destroyed)/.test(head[0] ?? '')) out.push({ chain: [`${base}.front`, `${r}.front`], key: `${a}.front`, tiles: 'all', dz: DRONE_BAY_FRONT_DZ, optional: true });
  return out;
}
