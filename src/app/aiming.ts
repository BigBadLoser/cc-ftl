import { ModuleC, ShipC, Struct, type Sim } from '../sim';
import { factionsHostile } from '../sim/combat/factions';
import { targetableShip } from '../sim/combat/targets';
import { shipGrid } from '../sim/regions';
import { isTargetable } from '../render/moduleArt';
import type { Renderer } from '../render/scene';
import type { UiAiming } from '../ui/api';
import { createStore, type Writable } from './store';

/** What a click on tile (x, y) of an enemy ship aims at: its module when a roof-visible one stands there, else that bare tile. */
export function aimTargetAt(sim: Sim, shipId: number, x: number, y: number): { moduleId: number; tile?: { x: number; y: number } } {
  const grid = shipGrid(sim, shipId);
  const id = grid?.has('module') ? grid.get('module', x, y) : 0;
  const m = id ? sim.world.get(id, ModuleC) : undefined;
  const def = m && sim.content.modules[m.def];
  return def && isTargetable(def) && m.hp > 0 ? { moduleId: id } : { moduleId: 0, tile: { x, y } };
}

/** True if a click on this ship in a fight may aim at it: at war with the player, still a target, and the tile is hull or deck. */
export function aimable(sim: Sim, shipId: number, x: number, y: number): boolean {
  const ship = sim.world.get(shipId, ShipC);
  const grid = shipGrid(sim, shipId);
  return !!ship && !!grid && factionsHostile(ship.faction, 'player') && ship.state !== 'wreck' && targetableShip(sim, shipId)
    && grid.inBounds(x, y) && grid.get('struct', x, y) !== Struct.Space;
}

export interface Aiming {
  /** The armed aim (a weapon, or null weapon = every weapon), or null. While armed, a left-click on an enemy ship aims instead of selecting. */
  aiming: Writable<UiAiming | null>;
  set(a: UiAiming | null): void;
  /** Handle a left-click at canvas px: true if it was an aim (or swallowed while aiming). */
  tap(r: Renderer, sx: number, sy: number): boolean;
  /** Pointer hover while aiming: the tile the bracket previews, or null. */
  hover(r: Renderer, sx: number, sy: number): void;
}

/** "Target in view": aim a weapon (or all) from the main camera. A left-click only; right-click and Esc cancel, so drafted-crew orders keep the right button. */
export function createAiming(sim: Sim, player: () => number, clearHover: () => void): Aiming {
  const store = createStore<UiAiming | null>(null);
  const hit = (r: Renderer, sx: number, sy: number) => {
    const any = r.pickTileAny(sx, sy);
    return any && any.shipId !== player() && aimable(sim, any.shipId, any.x, any.y) ? any : null;
  };
  return {
    aiming: store,
    set(a) {
      store.set(a);
      if (!a) clearHover();
    },
    tap(r, sx, sy) {
      const a = store.get();
      if (!a) return false;
      if (!sim.sector.inCombat) {
        this.set(null);
        return false;
      }
      const any = hit(r, sx, sy);
      if (!any) return true; // a miss keeps the mode armed
      const t = aimTargetAt(sim, any.shipId, any.x, any.y);
      sim.enqueue({
        type: 'combat.setTarget', ship: player(), weaponId: a.weapon, targetShip: any.shipId, targetModuleId: t.moduleId,
        ...(t.tile ? { targetTile: t.tile } : {}),
      });
      this.set(null);
      return true;
    },
    hover(r, sx, sy) {
      const any = store.get() ? hit(r, sx, sy) : null;
      r.setAimHover(any ? { shipId: any.shipId, x: any.x, y: any.y, moduleId: aimTargetAt(sim, any.shipId, any.x, any.y).moduleId } : null);
    },
  };
}
