import { defineComponent } from '../ecs';

/**
 * 'launching': stowed in its bay with an empty hold, about to fly out. 'outbound': flying to `target`. 'mining': holding over
 * `target` and lasering it. 'returning': flying home to its bay (hold full, nothing left, or recalled). 'unloading': stowed with
 * ore aboard, waiting for crew to haul it to storage (the ordinary cargo hauls).
 */
export type MiningPhase = 'launching' | 'outbound' | 'mining' | 'returning' | 'unloading';
// 'launching' covers waiting for the pilot to walk over and climb in.

/**
 * A mining order on a pod (a piloted vehicle with `VehicleDef.mining`): trips to `asteroid` until its ore (or the `tiles` it was
 * limited to) is gone or it is recalled. Sector tiles. `progress` is the fraction of the next ore unit already cut.
 */
export interface MiningPod {
  asteroid: number;
  /** Ore tiles the order is limited to, or null for every ore tile of the asteroid. */
  tiles: { x: number; y: number }[] | null;
  phase: MiningPhase;
  target: { x: number; y: number } | null;
  /** Where the pod hovers while it cuts `target` (sector coordinates): over the tile, or beside it so pods never overlap. */
  spot?: { x: number; y: number } | null;
  progress: number;
  /** Recalled: finish this trip home (no new tiles) and end the order. */
  recall: boolean;
  /** Round trips started under this order. */
  trips: number;
  /** Crew member reserved to fly the pod (walking to it, or aboard as its pilot), or 0. */
  pilot: number;
  /** True while the order waits for a free pilot (the `mining.waiting` event fired once). */
  waiting?: boolean;
}
export const MiningPodC = defineComponent<MiningPod>('miningPod');
