import { defineComponent } from '../ecs';

/** A placed module. Footprint tiles are written to the grid's `module` field. */
export interface Module {
  /** Content id, e.g. 'module.reactor'. */
  def: string;
  /** Top-left tile of the rotated footprint. */
  x: number;
  y: number;
  /** Quarter turns clockwise, 0..3. */
  rot: number;
  hp: number;
  /** Power priority 1 (served first) .. 5; ties go to the lower entity id. */
  powerPriority: number;
  /** Player switch. A disabled module draws and supplies nothing. */
  enabled: boolean;
  /** Derived by the power system each tick: running (supplied / allocated). */
  powered: boolean;
  /** Crew entity that has reserved this bed (0 = free). Only used by bed modules. */
  reservedBy: number;
  /** Set when hp hits 0 and cleared once repaired past half: a wrecked module that is patched and shot again does not announce its destruction again. */
  wrecked?: boolean;
  /** Reactor (ModuleDef.fuel): units of fuel in its store, fractional while burning; absent = a full store (modules/energy.ts `fuelOf`). */
  fuel?: number;
  /** Battery bank (ModuleDef.battery): stored power-seconds; absent = full (modules/energy.ts `chargeOf`). */
  charge?: number;
  /** Life support: seconds of bottled-oxygen boost run since the last unit was burned (ModuleDef.o2Supply). */
  o2Burn?: number;
  /** Priority repair (module.priorityRepair): crew pick this module's repair job before any other; a higher number was ordered later and goes first. Cleared at full hp. */
  repairFirst?: number;
  /** Item id of the upgrade fitted in the module's slot (ModuleDef.upgradeSlot); absent = none. */
  upgrade?: string;
  /**
   * Work hold: the module is offline (unpowered, so it neither fires nor runs) until this sim tick. Crew working on the module refresh it each tick they work
   * (`holdOffline`), so it lapses by itself when they stop; the job that holds it may also clear it when done.
   */
  offlineUntil?: number;
}
export const ModuleC = defineComponent<Module>('module');

/**
 * Deployable roof part (turret, emitter dish, sensor mast) of a module whose def has `deploySec`. `amount` is
 * 0 (stowed) .. 1 (fully deployed). Created lazily by the deploy system, so it is absent until the first tick.
 */
export interface Deploy {
  amount: number;
}
export const DeployC = defineComponent<Deploy>('deploy');
