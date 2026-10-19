import { defineComponent } from '../ecs';

/**
 * A suited crew member drifting between a hovering shuttle and a ship's hull, a straight line in sector space (no grid
 * change: their Position is the hull tile all along). `out`: they left the hatch and land on their Position tile; `back`:
 * they leave that tile for the hatch and board when it ends. (sx, sy) is the shuttle's hatch side in sector tiles.
 * Movement is frozen while `ticks` run down from `total`.
 */
export interface EvaFloat {
  mode: 'out' | 'back';
  vehicle: number;
  sx: number;
  sy: number;
  ticks: number;
  total: number;
}
export const EvaFloatC = defineComponent<EvaFloat>('evaFloat');
