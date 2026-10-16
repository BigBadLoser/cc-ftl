import { Struct, type Command, type Sim } from '../sim';
import type { FrameStats, Loop, Speed } from './loop';
import type { UiCrew, UiModule, UiStats } from '../ui/api';
import { buildModuleList, buildStats } from './moduleSnapshot';
import { buildCrewList } from './crewSnapshot';
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
  zoom: number;
  sprites: number;
}

export interface TileRef {
  gridId: number;
  x: number;
  y: number;
}

/** Plain-data description of one tile, for the inspector. */
export interface InspectSnapshot extends TileRef {
  structName: string;
  /** Room id, or 0 when none. */
  room: number;
  fields: { name: string; value: number }[];
  /** True when this is the selected tile (false = hovered). */
  selected: boolean;
}

const STRUCT_NAMES: Record<number, string> = Object.fromEntries(Object.entries(Struct).map(([k, v]) => [v, k]));

export interface Bridge {
  snapshot: Readable<Snapshot>;
  inspect: Readable<InspectSnapshot | null>;
  crew: Readable<UiCrew[]>;
  modules: Readable<UiModule[]>;
  stats: Readable<UiStats>;
  setSelected(tile: TileRef | null): void;
  setHovered(tile: TileRef | null): void;
  dispatch(cmd: Command): void;
  setSpeed(speed: Speed): void;
  togglePause(): void;
  /** Called by main once the loop exists. */
  attachLoop(loop: Loop): void;
  /** Called by the loop each frame. */
  update(stats: FrameStats, info?: { sprites: number; zoom: number }): void;
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
    zoom: 0,
    sprites: 0,
  });
  const inspect = createStore<InspectSnapshot | null>(null);
  const crew = createStore<UiCrew[]>([]);
  const modules = createStore<UiModule[]>([]);
  const stats = createStore<UiStats>({ supply: 0, demand: 0, o2: null });
  let lastMods = '';
  let lastStats = '';
  let frame = 0;
  let lastCrew = '';
  let selected: TileRef | null = null;
  let hovered: TileRef | null = null;
  let lastInspect = '';

  const refreshInspect = () => {
    const ref = selected ?? hovered;
    const grid = ref ? sim.grids.get(ref.gridId) : undefined;
    let snap: InspectSnapshot | null = null;
    if (ref && grid?.inBounds(ref.x, ref.y)) {
      const fields = grid.fieldNames().map((name) => ({ name, value: grid.get(name, ref.x, ref.y) }));
      const struct = fields.find((f) => f.name === 'struct')?.value ?? 0;
      snap = {
        ...ref,
        structName: STRUCT_NAMES[struct] ?? `Unknown(${struct})`,
        room: fields.find((f) => f.name === 'room')?.value ?? 0,
        fields,
        selected: selected !== null,
      };
    }
    const key = JSON.stringify(snap);
    if (key === lastInspect) return;
    lastInspect = key;
    inspect.set(snap);
  };
  const refreshCrew = () => {
    const list = buildCrewList(sim);
    const key = JSON.stringify(list);
    if (key === lastCrew) return;
    lastCrew = key;
    crew.set(list);
  };
  const refreshShip = () => {
    if (frame++ % 4) return;
    const ml = buildModuleList(sim);
    const mk = JSON.stringify(ml);
    if (mk !== lastMods) {
      lastMods = mk;
      modules.set(ml);
    }
    const st = buildStats(sim);
    st.o2 = st.o2 === null ? null : Math.round(st.o2 * 10) / 10;
    const sk = JSON.stringify(st);
    if (sk !== lastStats) {
      lastStats = sk;
      stats.set(st);
    }
  };
  let loop: Loop | undefined;
  let lastSpeed: Speed = 1;

  const setSpeed = (speed: Speed) => {
    if (speed !== 0) lastSpeed = speed;
    loop?.setSpeed(speed);
    store.update((s) => ({ ...s, speed, paused: speed === 0 }));
  };

  return {
    snapshot: store,
    inspect,
    crew,
    modules,
    stats,
    setSelected(t) {
      selected = t;
      refreshInspect();
    },
    setHovered(t) {
      hovered = t;
      refreshInspect();
    },
    dispatch: (cmd) => sim.enqueue(cmd),
    setSpeed,
    togglePause: () => setSpeed(store.get().paused ? lastSpeed : 0),
    attachLoop(l) {
      loop = l;
    },
    update(stats, info) {
      store.update((s) => ({ ...s, ...stats, zoom: info?.zoom ?? s.zoom, sprites: info?.sprites ?? s.sprites }));
      refreshInspect();
      refreshCrew();
      refreshShip();
    },
  };
}
