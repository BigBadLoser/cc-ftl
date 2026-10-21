import { defineComponent } from '../ecs';

/**
 * 'launching': stowed in its bay with an empty hold, about to fly out. 'outbound': flying to `target`. 'mining': holding over
 * `target` and lasering it. 'returning': flying home to its bay (hold full, nothing left, or recalled). 'unloading': stowed with
 * ore aboard, waiting for crew to haul it to storage (the ordinary cargo hauls).
 */
export type MiningPhase = 'launching' | 'outbound' | 'mining' | 'returning' | 'unloading';

/**
 * A mining order on a pod (a crewless vehicle with `VehicleDef.mining`): trips to `asteroid` until its ore (or the `tiles` it was
 * limited to) is gone or it is recalled. Sector tiles. `progress` is the fraction of the next ore unit already cut.
 */
export interface MiningPod {
  asteroid: number;
  /** Ore tiles the order is limited to, or null for every ore tile of the asteroid. */
  tiles: { x: number; y: number }[] | null;
  phase: MiningPhase;
  target: { x: number; y: number } | null;
  progress: number;
  /** Recalled: finish this trip home (no new tiles) and end the order. */
  recall: boolean;
  /** Round trips started under this order. */
  trips: number;
}
export const MiningPodC = defineComponent<MiningPod>('miningPod');
