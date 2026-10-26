import { JobC, ItemStackC, nodeOf, Struct, stackAt, type Command, type Sim } from '../sim';
import type { FrameStats, Loop, Speed } from './loop';
import type { UiFtl, UiTrade, UiStory, UiCombat, UiPrize, UiMining, UiShuttles, UiCrew, UiFab, UiModule, UiGoals, UiJobs, UiSite, UiStats, UiStock, UiStorage } from '../ui/api';
import { buildFabs, buildStock, buildStorages } from './logisticsSnapshot';
import { buildModuleList, buildStats } from './moduleSnapshot';
import { buildSites } from './siteSnapshot';
import { buildJobs } from './jobsSnapshot';
import { buildGoals } from './goalsSnapshot';
import { buildCrewLists } from './crewSnapshot';
import { buildCombat } from './combatSnapshot';
import { buildFtl } from './ftlSnapshot';
import { buildPrizes } from './prizeSnapshot';
import { buildShuttles } from './shuttleSnapshot';
import { buildMining } from './miningSnapshot';
import { buildTrade } from './tradeSnapshot';
import { buildStory } from './storySnapshot';
import { warmOutlines } from './starmapClusters';
import { warmNebula } from './starmapNebula';
import { buildStarmap, emptyStarmap, planStarmapRoute, starmapStatus } from './starmapSnapshot';
import { PREFETCH_BOOST_BUDGET_MS, PREFETCH_BOOST_MS, PREFETCH_EVERY, prefetchGalaxy } from './galaxyPrefetch';
import type { UiDeploy, UiJumpWarnings, UiStarmap, UiStarRoute } from '../ui/starmapApi';
import { buildDeploy, buildJumpWarnings, deployError } from './deploySnapshot';
import { createStore, type Readable, type Writable } from './store';
import { shipGrid } from '../sim/regions';
import { findJobAt } from '../sim/crew/helpers';
import { crateInfo } from './jobsSnapshot';

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
  /** ShipC entity id of the ship the tile belongs to. */
  ship: number;
  x: number;
  y: number;
}

/** Plain-data description of one tile, for the inspector. */
export interface InspectSnapshot extends TileRef {
  /** The ship's grid number, for the readout only. */
  grid: number;
  /** The tile in its ship's local tiles (from the grid's top-left), for the readouts; `x`, `y` are sector tiles. */
  local: { x: number; y: number };
  structName: string;
  /** The loose item stack on the tile, or null. */
  stack: { item: string; name: string; count: number; crate: { job: number; title: string; to: string } | null } | null;
  /** Room id, or 0 when none. */
  room: number;
  fields: { name: string; value: number }[];
  /** A player job on the tile (building, forcing a door...), with its progress, or null. */
  job: { kind: string; progress: number; work: number } | null;
  /** True when this is the selected tile (false = hovered). */
  selected: boolean;
}

const STRUCT_NAMES: Record<number, string> = Object.fromEntries(Object.entries(Struct).map(([k, v]) => [v, k]));

export interface Bridge {
  snapshot: Readable<Snapshot>;
  inspect: Readable<InspectSnapshot | null>;
  crew: Readable<UiCrew[]>;
  hostiles: Readable<UiCrew[]>;
  modules: Readable<UiModule[]>;
  sites: Writable<UiSite[]>;
  jobs: Readable<UiJobs>;
  goals: Readable<UiGoals | null>;
  stats: Readable<UiStats>;
  stock: Readable<UiStock[]>;
  storages: Readable<UiStorage[]>;
  fabs: Readable<UiFab[]>;
  combat: Readable<UiCombat>;
  ftl: Readable<UiFtl | null>;
  shuttles: Readable<UiShuttles>;
  trade: Readable<UiTrade>;
  prizes: Readable<UiPrize[]>;
  mining: Readable<UiMining>;
  story: Readable<UiStory>;
  /** The generated starmap (geometry rebuilt when the galaxy changes; fuel and charge kept fresh). */
  starmap: Readable<UiStarmap>;
  planRoute(to: string): UiStarRoute | null;
  /** The deploy picker's data while the ship waits to be placed (null otherwise), the gap-rule check of a spot, and the jump confirm's list. */
  deploy: Readable<UiDeploy | null>;
  deployCheck(x: number, y: number): string | null;
  jumpWarnings(ship: number): UiJumpWarnings;
  /** The starmap screen opens (builds and keeps its data fresh) or closes (stops refreshing). */
  setStarmapOpen(open: boolean): void;
  /** Build the starmap's geometry ahead of the first open, one small piece per call (idle time); returns true while more is left. */
  warmStarmap(): boolean;
  /** Pick an option of the open event decision and resume the speed the game was on. */
  chooseStory(choice: string): void;
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
  const hostiles = createStore<UiCrew[]>([]);
  let lastHostiles = '';
  const modules = createStore<UiModule[]>([]);
  const sites = createStore<UiSite[]>([]);
  const jobs = createStore<UiJobs>({ here: null, offers: [], active: [], max: 0, mine: null });
  const goals = createStore<UiGoals | null>(null);
  let lastGoals = '';
  let lastJobsKey = '';
  let lastSites = '[]';
  const stats = createStore<UiStats>({ supply: 0, demand: 0, food: { units: 0, eaters: 0, perHour: 0, hours: null }, heat: { notoriety: 0, wanted: false, wantedAt: 10, hunters: [], clearCost: 0, clearBlocker: null }, o2: null });
  const stock = createStore<UiStock[]>([]);
  const storages = createStore<UiStorage[]>([]);
  const fabs = createStore<UiFab[]>([]);
  const combat = createStore<UiCombat>({ inCombat: false, player: null, enemies: [] });
  const ftl = createStore<UiFtl | null>(null);
  let lastFtl = '';
  const shuttles = createStore<UiShuttles>({ shuttles: [], airlocks: [], targets: [], roster: [], bays: [], regions: [], transfers: [], ferryReady: false });
  const trade = createStore<UiTrade>({ credits: sim.trade.credits, partners: [], deals: [] });
  let lastTrade = '';
  const prizes = createStore<UiPrize[]>([]);
  const mining = createStore<UiMining>({ asteroids: [], pods: [] });
  let lastMining = '';
  const story = createStore<UiStory>({ active: null, last: null });
  let lastStory = '';
  // The starmap is built lazily: when the screen first opens, or in idle time after loading (`warmStarmap`), never in createBridge.
  const starmap = createStore<UiStarmap>(emptyStarmap());
  const deploy = createStore<UiDeploy | null>(null);
  let deployKey = '';
  let starOpen = false;
  let lastStatus = '';
  const warmedChunks = new Set<string>();
  let starFrame = 0;
  const syncStarmap = () => {
    if (starmap.get().rev !== sim.galaxy.rev) starmap.set(buildStarmap(sim));
    else starmap.set({ ...starmap.get(), ...starmapStatus(sim) });
  };
  /** Speed to return to when the open decision is answered (null = no decision is holding the game). */
  let heldSpeed: Speed | null = null;
  let lastPrizes = '';
  let lastShuttles = '';
  let lastCombat = '';
  let combatFrame = 0;
  const lastLog = ['', '', ''];
  let lastMods = '';
  let lastStats = '';
  let frame = 0;
  let lastCrew = '';
  let selected: TileRef | null = null;
  let hovered: TileRef | null = null;
  let lastInspect = '';

  const refreshInspect = () => {
    const ref = selected ?? hovered;
    const shipId = ref ? ref.ship : 0;
    const grid = shipGrid(sim, shipId);
    let snap: InspectSnapshot | null = null;
    if (ref && grid?.inBounds(ref.x, ref.y)) {
      const fields = grid.fieldNames().map((name) => ({ name, value: grid.get(name, ref.x, ref.y) }));
      const struct = fields.find((f) => f.name === 'struct')?.value ?? 0;
      const sid = stackAt(sim, shipId, ref.x, ref.y);
      const st = sid ? sim.world.get(sid, ItemStackC) : undefined;
      const jobId = findJobAt(sim, shipId, ref.x, ref.y);
      const job = jobId ? sim.world.get(jobId, JobC) : undefined;
      snap = {
        ...ref,
        job: job ? { kind: job.kind, progress: job.progress, work: job.work } : null,
        grid: shipId,
        local: { x: ref.x - grid.x0, y: ref.y - grid.y0 },
        stack: st ? { item: st.item, name: sim.content.items[st.item]?.name ?? st.item, count: st.count, crate: crateInfo(sim, st.job) } : null,
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
    const lists = buildCrewLists(sim);
    const key = JSON.stringify(lists.crew);
    if (key !== lastCrew) {
      lastCrew = key;
      crew.set(lists.crew);
    }
    const hk = JSON.stringify(lists.hostiles);
    if (hk !== lastHostiles) {
      lastHostiles = hk;
      hostiles.set(lists.hostiles);
    }
  };
  const refreshShip = () => {
    if (frame++ % 4) return;
    const ml = buildModuleList(sim);
    const mk = JSON.stringify(ml);
    if (mk !== lastMods) {
      lastMods = mk;
      modules.set(ml);
    }
    const sl = buildSites(sim);
    const slk = JSON.stringify(sl);
    if (slk !== lastSites) {
      lastSites = slk;
      sites.set(sl);
    }
    // The board only changes with the galaxy (offers, jobs, the player's node) or the cargo a delivery needs: rebuilt on those, not every frame.
    const g = sim.galaxy;
    const jk = `${g.rev}|${g.turn}|${g.current}|${sim.sector.state}|${sim.trade.credits}|${frame >> 5}`;
    if (jk !== lastJobsKey) {
      lastJobsKey = jk;
      jobs.set(buildJobs(sim));
    }
    // The goal chain: cheap, but only sent on when it changed.
    if ((frame >> 2) % 4 === 0) {
      const gl = buildGoals(sim);
      const gk = JSON.stringify(gl);
      if (gk !== lastGoals) {
        lastGoals = gk;
        goals.set(gl);
      }
    }
    const logs = [buildStock(sim), buildStorages(sim), buildFabs(sim)] as const;
    const keys = logs.map((l) => JSON.stringify(l));
    if (keys[0] !== lastLog[0]) stock.set(logs[0]);
    if (keys[1] !== lastLog[1]) storages.set(logs[1]);
    if (keys[2] !== lastLog[2]) fabs.set(logs[2]);
    keys.forEach((k, i) => (lastLog[i] = k));
    const st = buildStats(sim);
    st.o2 = st.o2 === null ? null : Math.round(st.o2 * 10) / 10;
    const sk = JSON.stringify(st);
    if (sk !== lastStats) {
      lastStats = sk;
      stats.set(st);
    }
  };
  const refreshCombat = () => {
    if (combatFrame++ % 3) return;
    const snap = buildCombat(sim);
    const key = JSON.stringify(snap);
    if (key === lastCombat) return;
    lastCombat = key;
    combat.set(snap);
  };
  const refreshFtl = () => {
    if (combatFrame % 3) return;
    const snap = buildFtl(sim);
    const key = JSON.stringify(snap);
    if (key === lastFtl) return;
    lastFtl = key;
    ftl.set(snap);
  };
  const refreshShuttles = () => {
    if (combatFrame % 3) return;
    const snap = buildShuttles(sim);
    const key = JSON.stringify(snap);
    if (key === lastShuttles) return;
    lastShuttles = key;
    shuttles.set(snap);
  };
  const refreshTrade = () => {
    if (combatFrame % 3) return;
    const snap = buildTrade(sim);
    const key = JSON.stringify(snap);
    if (key === lastTrade) return;
    lastTrade = key;
    trade.set(snap);
  };
  const refreshMining = () => {
    if (combatFrame % 6) return;
    const snap = buildMining(sim);
    const key = JSON.stringify(snap);
    if (key === lastMining) return;
    lastMining = key;
    mining.set(snap);
  };
  const refreshPrizes = () => {
    if (combatFrame % 3) return;
    const snap = buildPrizes(sim);
    const key = JSON.stringify(snap);
    if (key === lastPrizes) return;
    lastPrizes = key;
    prizes.set(snap);
  };
  let loop: Loop | undefined;
  let lastSpeed: Speed = 1;

  /** An open event decision pauses the game; answering it restores the speed. */
  const refreshStory = () => {
    const snap = buildStory(sim);
    const key = JSON.stringify(snap);
    if (key === lastStory) return;
    lastStory = key;
    story.set(snap);
    if (snap.active && heldSpeed === null) {
      heldSpeed = loop?.getSpeed() ?? 1;
      applySpeed(0);
    }
  };
  let prefetchFrame = 0;
  let lastNode = sim.galaxy.current;
  let boostUntil = 0;
  const runPrefetch = () => {
    const now = performance.now();
    if (sim.galaxy.current !== lastNode) {
      lastNode = sim.galaxy.current;
      boostUntil = now + PREFETCH_BOOST_MS;
    }
    if (now < boostUntil) {
      while (performance.now() - now < PREFETCH_BOOST_BUDGET_MS && prefetchGalaxy(sim, starmap.get().rev >= 0));
    } else if (prefetchFrame++ % PREFETCH_EVERY === 0) prefetchGalaxy(sim, starmap.get().rev >= 0);
  };
  /** While the screen is open: full rebuild on a galaxy revision, otherwise only the fuel and FTL figures (about six times a second). */
  const refreshStarmap = () => {
    // Closed: only the status (state and trip) is kept fresh, so the game view can tell the player they are in hyperspace.
    if ((!starOpen && sim.sector.state === 'active' && starmap.get().state === 'active' && !starmap.get().travel) || starFrame++ % 5) return;
    const cur = starmap.get();
    if (starOpen && cur.rev !== sim.galaxy.rev) return starmap.set(buildStarmap(sim));
    const st = starmapStatus(sim);
    const key = JSON.stringify(st);
    if (key !== lastStatus) {
      lastStatus = key;
      starmap.set({ ...cur, ...st });
    }
  };
  /** The deploy picker's data, built once when a ship starts waiting (the sector is frozen meanwhile). */
  const refreshDeploy = () => {
    const waiting = sim.sector.state === 'deploying' && !!sim.sector.packet;
    const key = waiting ? `${sim.sector.node}:${sim.tick}` : '';
    if (key === deployKey) return;
    deployKey = key;
    deploy.set(waiting ? buildDeploy(sim) : null);
  };
  const applySpeed = (speed: Speed) => {
    loop?.setSpeed(speed);
    store.update((s) => ({ ...s, speed, paused: speed === 0 }));
  };

  const setSpeed = (speed: Speed) => {
    if (heldSpeed !== null) return; // a decision is open: only answering it resumes play
    if (speed !== 0) lastSpeed = speed;
    applySpeed(speed);
  };

  return {
    snapshot: store,
    inspect,
    crew,
    hostiles,
    modules,
    sites,
    jobs,
    goals,
    stats,
    stock,
    storages,
    fabs,
    combat,
    ftl,
    shuttles,
    trade,
    prizes,
    mining,
    story,
    starmap,
    planRoute: (to) => planStarmapRoute(sim, to),
    deploy,
    deployCheck: (x, y) => deployError(sim, x, y),
    jumpWarnings: (ship) => buildJumpWarnings(sim, ship),
    setStarmapOpen(open) {
      starOpen = open;
      if (open) syncStarmap();
    },
    warmStarmap() {
      if (starmap.get().rev >= 0) return false;
      // One sector-outline chunk, then one nebula tile per call; the last call assembles the (now cheap) snapshot.
      const chunk = Object.values(sim.galaxy.chunks).find((c) => !warmedChunks.has(c.key));
      if (chunk) {
        warmedChunks.add(chunk.key);
        warmOutlines(chunk);
        return true;
      }
      const at = nodeOf(sim, sim.galaxy.current);
      if (at && warmNebula(sim, at.x, at.y)) return true;
      starmap.set(buildStarmap(sim));
      return false;
    },
    chooseStory(choice) {
      sim.enqueue({ type: 'story.choose', choice });
      const back = heldSpeed;
      heldSpeed = null;
      if (back !== null) applySpeed(back === 0 ? lastSpeed : back);
    },
    setSelected(t) {
      selected = t;
      refreshInspect();
    },
    setHovered(t) {
      hovered = t;
      refreshInspect();
    },
    dispatch(cmd) {
      sim.enqueue(cmd);
      // Trade offers are answered at once even with the game paused: the window would otherwise wait for time to run.
      if (cmd.type.startsWith('trade.') && store.get().paused) loop?.flush();
    },
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
      refreshShuttles();
      refreshTrade();
      refreshPrizes();
      refreshMining();
      refreshCombat();
      refreshFtl();
      refreshStory();
      refreshDeploy();
      refreshStarmap();
      runPrefetch();
    },
  };
}
