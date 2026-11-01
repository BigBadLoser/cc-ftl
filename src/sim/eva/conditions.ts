import type { Modifier, ModifierSource } from '../stats';
import { isSuited, suitDef } from './suit';
import { traitFlag } from '../crew/traits';

const NONE: readonly Modifier[] = [];

/** A suit is bulky: walking and working are slower while one is worn (hand-weapon accuracy is in fight/weapons). */
export const suitModifiers: ModifierSource = (sim, entity) => {
  if (!isSuited(sim, entity)) return NONE;
  const s = suitDef(sim);
  return [
    { stat: 'moveSpeed', op: 'mul', value: traitFlag(sim, entity, 'noSuitSlow') ? 1 : s.moveMult },
    { stat: 'workSpeed', op: 'mul', value: s.workMult },
  ];
};
