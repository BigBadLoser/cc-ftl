import { defineComponent } from '../ecs';

/** A placed module. Footprint tiles are written to the grid's `module` field. */
export interface Module {
  /** Content id, e.g. 'module.reactor'. */
  def: string;
  gridId: number;
  /** Top-left tile of the rotated footprint. */
  x: number;
  y: number;
  /** Quarter turns clockwise, 0..3. */
  rot: number;
  hp: number;
  /** Power priority 1 (served first) .. 5; ties go to the lower entity id. */
  priority: number;
  /** Player switch. A disabled module draws and supplies nothing. */
  enabled: boolean;
  /** Derived by the power system each tick: running (supplied / allocated). */
  powered: boolean;
  /** Crew entity that has reserved this bed (0 = free). Only used by bed modules. */
  reservedBy: number;
}
export const ModuleC = defineComponent<Module>('module');
