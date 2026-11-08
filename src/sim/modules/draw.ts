import { PlotC } from '../farm/components';
import type { ModuleDef } from '../registry';
import type { Sim } from '../sim';

/** The rules a module's power draw can depend on (`ModuleDef.drawsWhen`): a state of the module, true while it should draw. */
const RULES: Record<NonNullable<ModuleDef['drawsWhen']>, (sim: Sim, id: number) => boolean> = {
  planted: (sim, id) => !!sim.world.get(id, PlotC)?.planted,
};

/** A module whose draw rule does not hold now: it neither draws power nor counts as unpowered (a bed with nothing growing). */
export const isIdle = (sim: Sim, id: number, def: ModuleDef): boolean => !!def.drawsWhen && !RULES[def.drawsWhen](sim, id);
