import type { Command, Sim } from '../sim';
import type { FrameStats, Loop, Speed } from './loop';
import { createStore, type Readable } from './store';

/** Plain-data view of the sim published to the UI. Never holds sim references. */
export interface Snapshot {
  tick: number;
  speed: Speed;
  paused: boolean;
  entityCount: number;
  fps: number;
  frameMs: number;
  tickMs: number;
  seed: number;
}

export interface Bridge {
  snapshot: Readable<Snapshot>;
  dispatch(cmd: Command): void;
  setSpeed(speed: Speed): void;
  togglePause(): void;
  /** Called by main once the loop exists. */
  attachLoop(loop: Loop): void;
  /** Called by the loop each frame. */
  update(stats: FrameStats): void;
}

export function createBridge(sim: Sim): Bridge {
  const store = createStore<Snapshot>({
    tick: sim.tick,
    speed: 1,
    paused: false,
    entityCount: sim.world.entityCount,
    fps: 0,
    frameMs: 0,
    tickMs: 0,
    seed: sim.seed,
  });
  let loop: Loop | undefined;
  let lastSpeed: Speed = 1;

  const setSpeed = (speed: Speed) => {
    if (speed !== 0) lastSpeed = speed;
    loop?.setSpeed(speed);
    store.update((s) => ({ ...s, speed, paused: speed === 0 }));
  };

  return {
    snapshot: store,
    dispatch: (cmd) => sim.enqueue(cmd),
    setSpeed,
    togglePause: () => setSpeed(store.get().paused ? lastSpeed : 0),
    attachLoop(l) {
      loop = l;
    },
    update(stats) {
      store.update((s) => ({ ...s, ...stats }));
    },
  };
}
