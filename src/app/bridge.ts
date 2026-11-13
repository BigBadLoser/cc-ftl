import { whereToSell } from './sellSnapshot';
import { CrewC, JobC, ItemStackC, nodeOf, Struct, stackAt, NOOP_PROBE, type Command, type Probe, type Sim, type SimEvent } from '../sim';
import type { FrameStats, Loop, Speed } from './loop';
import type { UiFtl, UiTrade, UiYard, UiStory, UiCombat, UiBoarding, UiPrize, UiMining, UiShuttles, UiCrew, UiFab, UiResearch, UiModule, UiModuleDef, UiGoals, UiStranded, UiJobs, UiSite, UiStats, UiStock, UiStorage } from '../ui/api';
import { buildFabs, buildStock, buildStorages } from './logisticsSnapshot';
import { buildModuleDefs, buildModuleList, buildStats } from './moduleSnapshot';
import { buildSites } from './siteSnapshot';
import { buildJobs } from './jobsSnapshot';
import { buildStranded } from './strandedSnapshot';
import { buildGoals } from './goalsSnapshot';
import { buildCrewLists } from './crewSnapshot';
import { buildCrewDetail } from './crewDetail';
import type { UiCrewDetail, UiOpinionHover } from '../ui/crewDetailApi';
import { opinionAt } from './bondSnapshot';
import { buildCombat } from './combatSnapshot';
import { buildBoarding } from './boardingSnapshot';
import { buildFtl } from './ftlSnapshot';
import { buildPrizes } from './prizeSnapshot';
import { buildShuttles } from './shuttleSnapshot';
import { buildMining } from './miningSnapshot';
import { buildTrade } from './tradeSnapshot';
import { StationLog } from './stationLog';
import { buildYard, yardInputs } from './yardSnapshot';
import { buildStory } from './storySnapshot';
import { warmOutlines } from './starmapClusters';
import { warmNebula } from './starmapNebula';
import { buildStarmap, emptyStarmap, planStarmapRoute, starmapStatus } from './starmapSnapshot';
import { PREFETCH_BOOST_BUDGET_MS, PREFETCH_BOOST_MS, PREFETCH_EVERY, prefetchGalaxy } from './galaxyPrefetch';
import type { UiDeploy, UiJumpWarnings, UiStarmap, UiStarRoute, UiSellGood } from '../ui/starmapApi';
import { buildDeploy, buildJumpWarnings, deployError, deployKey as deployKeyOf } from './deploySnapshot';
import { createStore, type Readable, type Writable } from './store';
import { shipGrid } from '../sim/regions';
import { ventableDoor } from '../sim/vents';
import { doorInfo, type DoorInfo } from '../sim/doorInfo';
import { findJobAt } from '../sim/crew/helpers';
import { crateInfo } from './jobsSnapshot';
import { buildResearch } from './researchSnapshot';
import { clockAt } from '../sim/clock';

/** Plain-data view of the sim published to the UI. Never holds sim references. */
export interface Snapshot {
  tick: number;
  /** The ship clock (#412): day from 1, hour 0..23, minute. */
  clock: { day: number; hour: number; minute: number };
  /** The starmap turn (`sim.galaxy.turn`), the one the save meta records. */
  turn: number;
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
  /** True when this tile is a door that can have a vent (`ventableDoor`: not an airlock's door). */
  ventable: boolean;
  /** The door's words and sides (`doorInfo`), or null when the tile is not a door. */
  door: DoorInfo | null;
  /** True when this is the selected tile (false = hovered). */
  selected: boolean;
}

const STRUCT_NAMES: Record<number, string> = Object.fromEntries(Object.entries(Struct).map(([k, v]) => [v, k]));

export interface Bridge {
  /** The sim's drained output events, for the app's own readers of them (the station traffic log). */
  onEvents(events: SimEvent[]): void;
  snapshot: Readable<Snapshot>;
  inspect: Readable<InspectSnapshot | null>;
  crew: Readable<UiCrew[]>;
  guests: Readable<UiCrew[]>;
  hostiles: Readable<UiCrew[]>;
  /** The inspector's detail tabs for the one selected crew member of the player's (null otherwise). */
  crewDetail: Readable<UiCrewDetail | null>;
  /** What the selected crew member thinks of the crewmate the pointer is on (null with none, or no opinion). */
  opinionHover: Readable<UiOpinionHover | null>;
  modules: Readable<UiModule[]>;
  /** The build menu's modules; rebuilt when a blueprint is learnt. */
  moduleDefs: Readable<UiModuleDef[]>;
  sites: Writable<UiSite[]>;
  jobs: Readable<UiJobs>;
  goals: Readable<UiGoals | null>;
  stranded: Readable<UiStranded | null>;
  stats: Readable<UiStats>;
  stock: Readable<UiStock[]>;
  storages: Readable<UiStorage[]>;
  fabs: Readable<UiFab[]>;
  research: Readable<UiResearch>;
  combat: Readable<UiCombat>;
  boarding: Readable<UiBoarding[]>;
  ftl: Readable<UiFtl | null>;
  shuttles: Readable<UiShuttles>;
  trade: Readable<UiTrade>;
  /** The hull plan, the quote of the watched station (the open station panel) and the yard order. */
  yard: Writable<UiYard>;
  watchYard(station: number): void;
  prizes: Readable<UiPrize[]>;
  mining: Readable<UiMining>;
  story: Readable<UiStory>;
  /** The generated starmap (geometry rebuilt when the galaxy changes; fuel and charge kept fresh). */
  starmap: Readable<UiStarmap>;
  planRoute(to: string): UiStarRoute | null;
  whereToSell(): UiSellGood[];
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
  /** An enemy crew member being inspected: listed among the hostiles even where none of your crew stand. */
  watchCrew(id: number | null): void;
  setHovered(tile: TileRef | null): void;
  dispatch(cmd: Command): void;
  setSpeed(speed: Speed): void;
  togglePause(): void;
  /** Called by main once the loop exists. */
  attachLoop(loop: Loop): void;
  /** Called by the loop each frame. */
  update(stats: FrameStats, info?: { sprites: number; zoom: number }): void;
  /** Rebuild every snapshot now, skipping the per-panel frame throttle (a tool that steps the paused sim and reads the UI data at once). */
  refresh(): void;
}

export function createBridge(sim: Sim, getProbe: () => Probe = () => NOOP_PROBE): Bridge {
  const store = createStore<Snapshot>({
    tick: sim.tick,
    clock: clockAt(sim.tick),
    turn: sim.galaxy.turn,
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
  const guests = createStore<UiCrew[]>([]);
  let lastGuests = '';
  const hostiles = createStore<UiCrew[]>([]);
  let lastHostiles = '';
  const crewDetail = createStore<UiCrewDetail | null>(null);
  let lastDetail = 'null';
  const opinionHover = createStore<UiOpinionHover | null>(null);
  let lastOpinion = 'null';
  const modules = createStore<UiModule[]>([]);
  const moduleDefs = createStore<UiModuleDef[]>(buildModuleDefs(sim));
  let lastBlueprints = sim.story.blueprints.join(',');
  const sites = createStore<UiSite[]>([]);
  const jobs = createStore<UiJobs>({ here: null, offers: [], active: [], handIn: [], asked: [], max: 0, mine: null });
  const goals = createStore<UiGoals | null>(null);
  const stranded = createStore<UiStranded | null>(null);
  let lastStranded = 'null';
  let lastGoals = '';
  let lastJobsKey = '';
  let lastSites = '[]';
  const stats = createStore<UiStats>({ supply: 0, demand: 0, fuel: null, battery: null, food: { units: 0, eaters: 0, perHour: 0, hours: null }, heat: { notoriety: 0, wanted: false, wantedAt: 10, hunters: [], clearCost: 0, clearBlocker: null }, o2: null, hull: { tiles: 0, capacity: 0 } });
  const stock = createStore<UiStock[]>([]);
  const storages = createStore<UiStorage[]>([]);
  const fabs = createStore<UiFab[]>([]);
  const research = createStore<UiResearch>(buildResearch(sim));
  let lastResearch = '';
  const combat = createStore<UiCombat>({ inCombat: false, player: null, enemies: [] });
  const boarding = createStore<UiBoarding[]>([]);
  let lastBoarding = '[]';
  const ftl = createStore<UiFtl | null>(null);
  let lastFtl = '';
  const shuttles = createStore<UiShuttles>({ shuttles: [], airlocks: [], targets: [], roster: [], bays: [], regions: [], transfers: [], ferryReady: false });
  const trade = createStore<UiTrade>({ credits: sim.trade.credits, partners: [], deals: [] });
  let lastTrade = '';
  const stationLog = new StationLog();
  const yard = createStore<UiYard>({ plan: { ship: 0, tiles: [], connected: [], loose: [], blocked: [], floor: [], bad: [], hull: { now: 0, afterAll: 0, capacity: 0 } }, quote: null, order: null });
  let yardStation = 0;
  let lastYard = '';
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
  const lastLog = ['', '', ''];
  let lastMods = '';
  let lastStats = '';
  let uiFrame = 0;
  /** Set while `refresh` runs: every panel is due. */
  let fresh = false;
  let lastCrew = '';
  let selected: TileRef | null = null;
  let hovered: TileRef | null = null;
  let lastInspect = '';

  /**
   * The sim only changes in a tick or when a command applies (paused), so a snapshot built from it is the same on a frame that saw
   * neither. `unchanged(id)` is true when nothing changed since `id` last ran (and records that it runs now); `local` counts the
   * bridge's own inputs (the watched crew, the yard, the open screens), which a snapshot also reads.
   */
  let local = 0;
  const seenTick = new Map<string, number>();
  const seenApplied = new Map<string, number>();
  const seenLocal = new Map<string, number>();
  const unchanged = (id: string): boolean => {
    const applied = sim.commands.applied;
    if (seenTick.get(id) === sim.tick && seenApplied.get(id) === applied && seenLocal.get(id) === local) return true;
    seenTick.set(id, sim.tick);
    seenApplied.set(id, applied);
    seenLocal.set(id, local);
    return false;
  };

  /** A panel's turn: every `period` frames (`offset` staggers them so they do not all land on one frame), or at once after a command applied. */
  const due = (id: string, period: number, offset: number): boolean => fresh || (uiFrame + offset) % period === 0 || seenApplied.get(id) !== sim.commands.applied;

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
        ventable: ventableDoor(sim, grid, ref.x, ref.y),
        door: doorInfo(sim, grid, ref.x, ref.y),
        selected: selected !== null,
      };
    }
    const key = JSON.stringify(snap);
    if (key === lastInspect) return;
    lastInspect = key;
    inspect.set(snap);
  };
  let watched: number | null = null;
  const refreshOpinion = () => {
    const op = watched !== null && hovered && sim.world.has(watched, CrewC) ? opinionAt(sim, watched, hovered.ship, hovered.x, hovered.y) : null;
    const key = JSON.stringify(op);
    if (key === lastOpinion) return;
    lastOpinion = key;
    opinionHover.set(op);
  };
  const refreshCrew = () => {
    refreshOpinion();
    if (unchanged('crew')) return;
    const lists = buildCrewLists(sim, watched);
    const key = JSON.stringify(lists.crew);
    if (key !== lastCrew) {
      lastCrew = key;
      crew.set(lists.crew);
    }
    const gk = JSON.stringify(lists.guests);
    if (gk !== lastGuests) {
      lastGuests = gk;
      guests.set(lists.guests);
    }
    const hk = JSON.stringify(lists.hostiles);
    if (hk !== lastHostiles) {
      lastHostiles = hk;
      hostiles.set(lists.hostiles);
    }
    const detail = watched !== null && (lists.crew.some((c) => c.id === watched) || lists.guests.some((c) => c.id === watched) || lists.hostiles.some((c) => c.id === watched)) ? buildCrewDetail(sim, watched) : null;
    const dk = JSON.stringify(detail);
    if (dk !== lastDetail) {
      lastDetail = dk;
      crewDetail.set(detail);
    }
  };
  const refreshShip = () => {
    if (!due('ship', 8, 0) || unchanged('ship')) return;
    const ml = buildModuleList(sim);
    const mk = JSON.stringify(ml);
    if (mk !== lastMods) {
      lastMods = mk;
      modules.set(ml);
    }
    const bk = sim.story.blueprints.join(',');
    if (bk !== lastBlueprints) {
      lastBlueprints = bk;
      moduleDefs.set(buildModuleDefs(sim));
    }
    const sl = buildSites(sim);
    const slk = JSON.stringify(sl);
    if (slk !== lastSites) {
      lastSites = slk;
      sites.set(sl);
    }
    // The board reads the galaxy and also the ship (its strength rates a bounty, the cargo a delivery needs): rebuilt with every ship pass, sent on when changed.
    const jb = buildJobs(sim);
    const jbk = JSON.stringify(jb);
    if (jbk !== lastJobsKey) {
      lastJobsKey = jbk;
      jobs.set(jb);
    }
    // Stranded without fuel: cheap checks, sent on when changed.
    {
      const st = buildStranded(sim);
      const sk = JSON.stringify(st);
      if (sk !== lastStranded) {
        lastStranded = sk;
        stranded.set(st);
      }
    }
    // The goal chain: cheap, but only sent on when it changed.
    {
      const gl = buildGoals(sim);
      const gk = JSON.stringify(gl);
      if (gk !== lastGoals) {
        lastGoals = gk;
        goals.set(gl);
      }
    }
    const rs = buildResearch(sim);
    const rk = JSON.stringify(rs);
    if (rk !== lastResearch) {
      lastResearch = rk;
      research.set(rs);
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
    // Out of a fight the panel's weapons idle: five times a second is plenty. In one, the charge bars run at 20 Hz.
    if (!due('combat', sim.sector.inCombat ? 3 : 12, 1) || unchanged('combat')) return;
    const snap = buildCombat(sim);
    const key = JSON.stringify(snap);
    if (key === lastCombat) return;
    lastCombat = key;
    combat.set(snap);
  };
  const refreshBoarding = () => {
    if (!due('boarding', 3, 2) || unchanged('boarding')) return;
    const snap = buildBoarding(sim);
    const key = JSON.stringify(snap);
    if (key === lastBoarding) return;
    lastBoarding = key;
    boarding.set(snap);
  };
  const refreshFtl = () => {
    if (!due('ftl', 3, 0) || unchanged('ftl')) return;
    const snap = buildFtl(sim);
    const key = JSON.stringify(snap);
    if (key === lastFtl) return;
    lastFtl = key;
    ftl.set(snap);
  };
  const refreshShuttles = () => {
    if (!due('shuttles', 12, 3) || unchanged('shuttles')) return;
    const snap = buildShuttles(sim);
    const key = JSON.stringify(snap);
    if (key === lastShuttles) return;
    lastShuttles = key;
    shuttles.set(snap);
  };
  const refreshTrade = () => {
    if (!due('trade', 6, 4) || unchanged('trade')) return;
    const snap = buildTrade(sim, stationLog);
    const key = JSON.stringify(snap);
    if (key === lastTrade) return;
    lastTrade = key;
    trade.set(snap);
  };
  let yardInputsKey = '';
  const refreshYard = (force = false) => {
    if (!force && !due('yard', 3, 1)) return;
    if (unchanged('yard') && !force) return;
    const inputs = yardInputs(sim, yardStation);
    if (!force && inputs === yardInputsKey) return; // nothing the yard view depends on has changed: no need to quote the plan again
    yardInputsKey = inputs;
    const snap = buildYard(sim, yardStation);
    const key = JSON.stringify(snap);
    if (key === lastYard) return;
    lastYard = key;
    yard.set(snap);
  };
  const refreshMining = () => {
    if (!due('mining', 12, 5) || unchanged('mining')) return;
    const snap = buildMining(sim);
    const key = JSON.stringify(snap);
    if (key === lastMining) return;
    lastMining = key;
    mining.set(snap);
  };
  const refreshPrizes = () => {
    if (!due('prizes', 12, 7) || unchanged('prizes')) return;
    const snap = buildPrizes(sim);
    const key = JSON.stringify(snap);
    if (key === lastPrizes) return;
    lastPrizes = key;
    prizes.set(snap);
  };
  let loop: Loop | undefined;
  let lastSpeed: Speed = 1;

  /**
   * An open event decision pauses the game; play resumes (at the speed it interrupted) only once the sim has closed it. A rejected
   * choice leaves it open, so the game stays paused (#152).
   */
  const refreshStory = () => {
    if (unchanged('story')) return;
    const snap = buildStory(sim);
    const key = JSON.stringify(snap);
    if (key === lastStory) return;
    lastStory = key;
    story.set(snap);
    if (snap.active && heldSpeed === null) {
      heldSpeed = loop?.getSpeed() ?? 1;
      applySpeed(0);
    } else if (!snap.active && heldSpeed !== null) {
      const back = heldSpeed;
      heldSpeed = null;
      applySpeed(back === 0 ? lastSpeed : back);
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
    // Closed: only the status (state and trip) is kept fresh, so the game view can tell the player they are in hyperspace, and answer a scan that found contraband.
    const scanning = sim.galaxy.encounters.some((e) => !!e.scan) || starmap.get().encounters.some((e) => !!e.contraband);
    if ((!starOpen && sim.sector.state === 'active' && starmap.get().state === 'active' && !starmap.get().travel && !scanning) || (starFrame++ % 5 && !fresh)) return;
    const cur = starmap.get();
    if (starOpen && cur.rev !== sim.galaxy.rev) return starmap.set(buildStarmap(sim));
    const st = starmapStatus(sim);
    const key = JSON.stringify(st);
    if (key !== lastStatus) {
      lastStatus = key;
      starmap.set({ ...cur, ...st });
    }
  };
  /** The deploy picker's data, rebuilt only when what it reads changes (the sector is frozen while a ship waits). */
  const refreshDeploy = () => {
    const key = deployKeyOf(sim);
    if (key === deployKey) return;
    deployKey = key;
    deploy.set(key ? buildDeploy(sim) : null);
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
    guests,
    hostiles,
    crewDetail,
    opinionHover,
    modules,
    moduleDefs,
    sites,
    jobs,
    goals,
    stranded,
    stats,
    stock,
    storages,
    fabs,
    research,
    combat,
    boarding,
    ftl,
    shuttles,
    trade,
    prizes,
    mining,
    story,
    starmap,
    planRoute: (to) => planStarmapRoute(sim, to),
    whereToSell: () => whereToSell(sim),
    deploy,
    deployCheck: (x, y) => deployError(sim, x, y),
    jumpWarnings: (ship) => buildJumpWarnings(sim, ship),
    setStarmapOpen(open) {
      starOpen = open;
      local++;
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
      // Answer it now, paused as the game is: the sim either closes the decision (refreshStory then resumes play) or rejects the
      // choice (the toast says why, and the decision and the pause stay).
      if (store.get().paused) loop?.flush();
      refreshStory();
    },
    watchCrew(id) {
      if (id === watched) return;
      watched = id;
      local++;
      refreshCrew();
    },
    setSelected(t) {
      selected = t;
      refreshInspect();
    },
    yard,
    watchYard(station) {
      yardStation = station;
      local++;
      refreshYard(true);
    },
    setHovered(t) {
      hovered = t;
      refreshOpinion();
      refreshInspect();
    },
    dispatch(cmd) {
      sim.enqueue(cmd);
      // A UI command (accept a job, answer a trade offer, hire, ...) takes effect at once even with the game paused: the panel would
      // otherwise sit unchanged until time runs. The command still goes through the queue; flush() drains it without running a tick.
      if (store.get().paused) loop?.flush();
    },
    setSpeed,
    togglePause: () => setSpeed(store.get().paused ? lastSpeed : 0),
    attachLoop(l) {
      loop = l;
    },
    onEvents(events) {
      stationLog.onEvents(sim, events);
    },
    update(stats, info) {
      uiFrame++;
      const probe = getProbe();
      const step = (label: string, fn: () => void): void => {
        probe.begin(label);
        fn();
        probe.end(label);
      };
      step('ui/bridge/store', () => store.update((s) => ({ ...s, ...stats, clock: clockAt(stats.tick), turn: sim.galaxy.turn, zoom: info?.zoom ?? s.zoom, sprites: info?.sprites ?? s.sprites })));
      step('ui/bridge/inspect', refreshInspect);
      step('ui/bridge/crew', refreshCrew);
      step('ui/bridge/ship', refreshShip);
      step('ui/bridge/shuttles', refreshShuttles);
      step('ui/bridge/trade', refreshTrade);
      step('ui/bridge/yard', refreshYard);
      step('ui/bridge/prizes', refreshPrizes);
      step('ui/bridge/mining', refreshMining);
      step('ui/bridge/combat', refreshCombat);
      step('ui/bridge/boarding', refreshBoarding);
      step('ui/bridge/ftl', refreshFtl);
      step('ui/bridge/story', refreshStory);
      step('ui/bridge/deploy', refreshDeploy);
      step('ui/bridge/starmap', refreshStarmap);
      step('ui/bridge/prefetch', runPrefetch);
    },
    refresh() {
      const s = store.get();
      fresh = true;
      try {
        this.update({ tick: sim.tick, entityCount: sim.world.entityCount, fps: s.fps, frameMs: s.frameMs, tickMs: s.tickMs });
      } finally {
        fresh = false;
      }
    },
  };
}
