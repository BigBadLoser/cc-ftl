import type { Modifier, ModifierSource } from '../stats';
import {
  DARK_MOVE_MULT, DARK_WORK_MULT, LIGHT_DARK_BELOW, LOW_O2_WORK_MULT, O2_LOW_WORK_BELOW,
} from '../tuning';
import { PositionC } from './components';

const NONE: readonly Modifier[] = [];

/**
 * Stat modifiers from the tile the crew member stands on: darkness slows walking and working,
 * thin air slows working. The first real source plugged into the stat resolver.
 */
export const environmentModifiers: ModifierSource = (sim, entity) => {
  const pos = sim.world.get(entity, PositionC);
  const grid = pos ? sim.grids.get(pos.gridId) : undefined;
  if (!pos || !grid?.has('light') || !grid.inBounds(pos.x, pos.y)) return NONE;
  const out: Modifier[] = [];
  if (grid.get('light', pos.x, pos.y) < LIGHT_DARK_BELOW) {
    out.push({ stat: 'moveSpeed', op: 'mul', value: DARK_MOVE_MULT });
    out.push({ stat: 'workSpeed', op: 'mul', value: DARK_WORK_MULT });
  }
  if (grid.get('o2', pos.x, pos.y) < O2_LOW_WORK_BELOW) {
    out.push({ stat: 'workSpeed', op: 'mul', value: LOW_O2_WORK_MULT });
  }
  return out;
};
