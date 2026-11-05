import { unit } from '../galaxy/hash';
import type { Sim } from '../sim';
import { BOND_COMPAT_HOT, BOND_COMPAT_SOCIAL } from '../tuning';
import { CrewC } from './components';
import { hasTrait, traitEffect } from './traits';

/**
 * How well two crew members get on, fixed per pair: `c` in about -1..1.3. The hash of the two appearance seeds (so it survives saves and
 * id remaps) maps to -1..1, plus BOND_COMPAT_SOCIAL for two Social crew, minus BOND_COMPAT_HOT when either is Hot-headed . Symmetric.
 */
export function compatibility(sim: Sim, a: number, b: number): number {
  const sa = sim.world.get(a, CrewC)?.appearanceSeed ?? a, sb = sim.world.get(b, CrewC)?.appearanceSeed ?? b;
  let c = unit(0xc0a7, Math.min(sa, sb), Math.max(sa, sb)) * 2 - 1;
  if (traitEffect(sim, a, 'company') === 'social' && traitEffect(sim, b, 'company') === 'social') c += BOND_COMPAT_SOCIAL;
  if (hot(sim, a) || hot(sim, b)) c -= BOND_COMPAT_HOT;
  return c;
}

const hot = (sim: Sim, id: number): boolean => hasTrait(sim, id, 'trait.hot_headed');
