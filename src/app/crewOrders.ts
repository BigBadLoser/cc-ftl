import { AllegianceC, CrewC, DeadC, DraftedC, ModuleC, PositionC, Struct, VehicleC, boardingTile, isCombatReady, isHostile, rotatedSize, type Sim } from '../sim';
import { EggSacC } from '../sim/aliens/components';
import { sacAlive } from '../sim/aliens/target';
import { shipById } from '../sim/combat/ships';
import { isTileWalkable } from '../sim/modules/walk';
import { accessTile } from '../sim/modules/footprint';
import { shipGrid, shipIdOf } from '../sim/regions';
import { VehicleBayC } from '../sim/vehicles/components';
import type { Renderer } from '../render/scene';
import { orderChoices, type OrderChoice, type OrderId, type OrderProbe } from './orders';

/** What a right-click at a spot can do for a set of selected crew, and the way to do it. */
export interface OrderPlan {
  choices: OrderChoice[];
  run(id: OrderId): void;
}

/** The module under a click: the tile's own, else the tall sprite that covers it (never one in front of the tile). */
export function moduleUnder(sim: Sim, r: Renderer, sx: number, sy: number, tile: { x: number; y: number } | null, shipId: number): number {
  const grid = shipGrid(sim, shipId);
  const here = tile && grid ? grid.get('module', tile.x, tile.y) : 0;
  if (here || !tile) return here;
  const hit = r.pickModule(sx, sy) ?? 0;
  const m = hit ? sim.world.get(hit, ModuleC) : undefined;
  const def = m && sim.content.modules[m.def];
  if (!m || !def) return 0;
  const [w, h] = rotatedSize(def, m.rot);
  return tile.x <= m.x + w - 1 && tile.y <= m.y + h - 1 ? hit : 0;
}

/** The drafted, living crew of the player among `ids`. */
export function draftedOf(sim: Sim, ids: readonly number[]): number[] {
  return ids.filter((id) => sim.world.has(id, CrewC) && sim.world.has(id, DraftedC) && sim.world.has(id, PositionC) && !sim.world.has(id, DeadC) && sim.world.get(id, AllegianceC)?.faction === 'player');
}

/** True for a vehicle of the player's that crew can climb into or out of right now. */
function boardable(sim: Sim, vehicle: number): boolean {
  const v = sim.world.get(vehicle, VehicleC);
  return !!v && shipById(sim, v.homeShip)?.faction === 'player' && boardingTile(sim, vehicle) !== null;
}

/** The player's shuttle a click on this module means: one docked at this airlock, or the one stowed in this bay. */
function vehicleAt(sim: Sim, module: number): number {
  if (!module) return 0;
  const bay = sim.world.get(module, VehicleBayC);
  if (bay?.vehicle && boardable(sim, bay.vehicle)) return bay.vehicle;
  for (const id of sim.world.query(VehicleC)) {
    const v = sim.world.get(id, VehicleC);
    if (v?.state === 'docked' && v.dock === module && boardable(sim, id)) return id;
  }
  return 0;
}

/**
 * Work out what a right-click at canvas position (sx, sy) can order for the selected crew: attack a hostile, man a console,
 * board a shuttle or walk, each only if some selected crew stand on the right ship. `run` enqueues the commands (the UI
 * never touches the sim) and flashes the marker.
 */
export function planOrders(sim: Sim, r: Renderer, sx: number, sy: number, selected: readonly number[]): OrderPlan {
  const crew = draftedOf(sim, selected);
  const shipOf = (c: number): number => shipIdOf(sim, sim.world.get(c, PositionC));
  const on = (ship: number): number[] => crew.filter((c) => shipOf(c) === ship);
  const probe: OrderProbe = {};
  const act: Partial<Record<OrderId, () => void>> = {};

  const hit = r.pickCrew(sx, sy);
  if (hit !== null && crew.length) {
    const sac = sim.world.get(hit, EggSacC);
    const foePos = sim.world.get(hit, PositionC);
    const ship = sac ? sac.ship : foePos ? shipIdOf(sim, foePos) : 0;
    const live = sac ? sacAlive(sac) : isHostile(sim, crew[0] as number, hit) && isCombatReady(sim, hit);
    if (live && on(ship).length) {
      probe.foe = { id: hit, name: sac ? 'egg sac' : sim.world.get(hit, CrewC)?.name ?? 'target' };
      act.attack = () => {
        for (const c of on(ship)) sim.enqueue({ type: 'crew.attack', id: c, target: hit });
        const at = sac ?? foePos;
        if (at) r.addOrderMarker(Math.round(at.x), Math.round(at.y), 'attack');
      };
    }
  }

  const tile = r.pickTileAny(sx, sy);
  const module = tile ? moduleUnder(sim, r, sx, sy, tile, tile.shipId) : 0;
  const mod = module ? sim.world.get(module, ModuleC) : undefined;
  const def = mod && sim.content.modules[mod.def];
  if (mod && def?.console && mod.hp > 0 && on(shipIdOf(sim, mod)).length && shipById(sim, shipIdOf(sim, mod))?.faction === 'player') {
    const at = accessTile(def, mod.x, mod.y, mod.rot);
    probe.station = { module, name: def.name.toLowerCase() };
    act.man = () => {
      const near = on(shipIdOf(sim, mod)).map((c) => {
        const p = sim.world.get(c, PositionC) as { toX: number; toY: number };
        return { c, d: at ? Math.abs(p.toX - at.x) + Math.abs(p.toY - at.y) : 0 };
      }).sort((a, b) => a.d - b.d || a.c - b.c)[0];
      if (near) sim.enqueue({ type: 'crew.man', id: near.c, module });
      if (at) r.addOrderMarker(at.x, at.y, 'station');
    };
  }

  const pickedShuttle = r.pickShuttle(sx, sy);
  const vehicle = pickedShuttle !== null && boardable(sim, pickedShuttle) ? pickedShuttle : vehicleAt(sim, module);
  const bt = vehicle ? boardingTile(sim, vehicle) : null;
  if (vehicle && bt && on(bt.shipId).length) {
    probe.shuttle = { vehicle, name: (sim.content.vehicles?.[sim.world.get(vehicle, VehicleC)?.def ?? '']?.name ?? 'shuttle').toLowerCase() };
    act.board = () => {
      for (const c of on(bt.shipId)) sim.enqueue({ type: 'vehicle.embark', crew: c, vehicle });
      r.addOrderMarker(bt.x, bt.y, 'board');
    };
  }

  const grid = tile ? shipGrid(sim, tile.shipId) : undefined;
  if (tile && grid && on(tile.shipId).length && isTileWalkable(sim, grid, tile.x, tile.y) && !(grid.get('struct', tile.x, tile.y) === Struct.Door && grid.get('jam', tile.x, tile.y) !== 0)) {
    probe.walk = true;
    act.walk = () => {
      sim.enqueue({ type: 'crew.moveGroup', ids: on(tile.shipId), x: tile.x, y: tile.y, ship: tile.shipId });
      r.addOrderMarker(tile.x, tile.y, 'move');
    };
  }
  return { choices: orderChoices(probe), run: (id) => act[id]?.() };
}
