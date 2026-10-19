import { defineComponent } from '../ecs';

/**
 * A suited crew member drifting between a hovering shuttle and a ship's hull. `out`: they left the hatch and land on
 * their Position tile; `back`: they leave that tile for the hatch and board when it ends. (fx, fy) is the shuttle's
 * hatch in the tile frame of their grid (it can lie outside the grid). Movement is frozen while `ticks` run down from `total`.
 */
export interface EvaFloat {
  mode: 'out' | 'back';
  vehicle: number;
  fx: number;
  fy: number;
  ticks: number;
  total: number;
}
export const EvaFloatC = defineComponent<EvaFloat>('evaFloat');
