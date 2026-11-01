import { shipIdOf, shipGrid } from '../regions';
import type { Modifier, ModifierSource } from '../stats';
import {
  DARK_MOVE_MULT, DARK_WORK_MULT, LIGHT_DARK_BELOW, LOW_O2_WORK_MULT, O2_LOW_WORK_BELOW,
} from '../tuning';
import { PositionC } from './components';
import { traitFlag } from './traits';

const NONE: readonly Modifier[] = [];

/** The tile the crew member stands on, on a grid with light and air (else null). */
function tileOf(sim: Parameters<ModifierSource>[0], entity: number) {
  const pos = sim.world.get(entity, PositionC);
  const grid = pos ? shipGrid(sim, shipIdOf(sim, pos)) : undefined;
  if (!pos || !grid?.has('light') || !grid.inBounds(pos.x, pos.y)) return null;
  return { grid, x: pos.x, y: pos.y };
}

/** Darkness slows walking and working (not for the dark-adapted). */
export const darkModifiers: ModifierSource = (sim, entity) => {
  const t = tileOf(sim, entity);
  if (!t || t.grid.get('light', t.x, t.y) >= LIGHT_DARK_BELOW || traitFlag(sim, entity, 'darkAdapted')) return NONE;
  return [{ stat: 'moveSpeed', op: 'mul', value: DARK_MOVE_MULT }, { stat: 'workSpeed', op: 'mul', value: DARK_WORK_MULT }];
};

/** Thin air slows working. */
export const lowAirModifiers: ModifierSource = (sim, entity) => {
  const t = tileOf(sim, entity);
  if (!t || t.grid.get('o2', t.x, t.y) >= O2_LOW_WORK_BELOW) return NONE;
  return [{ stat: 'workSpeed', op: 'mul', value: LOW_O2_WORK_MULT }];
};

/**
 * Stat modifiers from the tile the crew member stands on: darkness slows walking and working, thin air slows working.
 * The resolver registers the two separately (so the inspector can name the cause); this is both together.
 */
export const environmentModifiers: ModifierSource = (sim, entity) => {
  const dark = darkModifiers(sim, entity);
  const air = lowAirModifiers(sim, entity);
  return dark.length && air.length ? [...dark, ...air] : dark.length ? dark : air;
};
