import { CrewC, NeedsC } from '../crew/components';
import type { Modifier, ModifierSource } from '../stats';
import { EMPTY_CHARGE_MULT } from '../tuning';

const NONE: readonly Modifier[] = [];
const EMPTY: readonly Modifier[] = [
  { stat: 'moveSpeed', op: 'mul', value: EMPTY_CHARGE_MULT },
  { stat: 'workSpeed', op: 'mul', value: EMPTY_CHARGE_MULT },
];

/** A robot with a flat battery crawls: moveSpeed and workSpeed x EMPTY_CHARGE_MULT. */
export const chargeModifiers: ModifierSource = (sim, entity) => {
  const crew = sim.world.get(entity, CrewC);
  if (!crew || !sim.content.species[crew.species]?.charge) return NONE;
  return (sim.world.get(entity, NeedsC)?.charge ?? 100) <= 0 ? EMPTY : NONE;
};
