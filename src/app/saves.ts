import { content } from '../content';
import { starterShips } from '../content/ships/starterShips';
import { deserialize, homeShip, newGame, nodeOf, SAVE_VERSION, serialize, ShipC, type Sim } from '../sim';
import { AUTO_ID, AUTO_IDS, BROKEN_ID, PRECOMBAT_ID, isAutoId, saveStore, type SaveMeta } from './saveStore';
import { playerCrew } from '../sim/story/world';

/**
 * The browser saves (saveStore.ts): the autosave plus a few named slots. `startGame` loads the autosave on page load (or the slot the
 * player picked, see `loadSlot`); the main loop writes the autosave with `createSaver`. Starting over or loading a save reloads the page:
 * the renderer, bridge and controller are all built around one Sim, and a reload is the clean way to swap it.
 */

/** Set before a reload to start a new game instead of loading the save. */
const NEW_GAME = 'cc.newGame';
/** Set before a reload to load this save slot instead of the autosave. */
const LOAD_SLOT = 'cc.loadSlot';
/** A save is being loaded: the reload's pagehide must not write this game over the autosave first. */
let loading = false;

function take(key: string): string | null {
  const v = read(key, sessionStorage);
  if (v !== null) {
    try {
      sessionStorage.removeItem(key);
    } catch {
      /* the flag only lasts the reload */
    }
  }
  return v;
}

function read(key: string, store: Storage = localStorage): string | null {
  try {
    return store.getItem(key);
  } catch {
    return null;
  }
}

export interface Start {
  sim: Sim;
  /** Shown once on start: the save could not be loaded (an older version), so this is a new game. */
  notice: string | null;
  /** False for a `?seed=` debug game: it must never write over the player's campaign save. */
  persist: boolean;
  /** A new game started because the saved campaign could not be loaded: list every autosave, whatever campaign it belongs to. */
  showAll?: boolean;
}

/**
 * The game to play: `?seed=` asks for a new game of that seed (debug and screenshot scripts); a requested new game is a
 * fresh random seed; otherwise the saved game, else a new one. A save from another SAVE_VERSION cannot be loaded
 * (no migrations while this is a prototype): it is dropped, with a notice.
 */
export async function startGame(seedParam: string | null, starterParam: string | null = null): Promise<Start> {
  // `?starter=wayfarer|prospector|lancer` (debug, until the new-game picker lands): a new game with that starter ship, never saved over the campaign.
  const starter = starterParam ? starterShips.find((s) => s.id === `ship.${starterParam}` || s.id === starterParam) : undefined;
  const fresh = (seed: number) => newGame(seed >>> 0, content, starter?.id, true);
  const random = () => (Math.random() * 0x100000000) >>> 0;
  await saveStore.ready(); // every session opens the store (Load and named slots work in a debug game); `persist: false` keeps it off the autosave
  if (seedParam !== null && Number.isFinite(Number(seedParam))) return { sim: fresh(Number(seedParam)), notice: null, persist: false };
  if (starter) return { sim: fresh(random()), notice: null, persist: false };
  if (take(NEW_GAME)) return { sim: fresh(random()), notice: null, persist: true };
  const slot = take(LOAD_SLOT);
  if (slot && slot !== AUTO_ID) {
    const picked = await saveStore.read(slot);
    try {
      if (picked) return { sim: deserialize(picked, content), notice: null, persist: true };
    } catch {
      /* falls through to the autosave below; the slot itself is left as it is */
    }
    const auto = await loadAuto(fresh, random);
    const why = 'The save you picked could not be loaded (it may be from another version of the game). It was kept; you are playing your autosave instead.';
    return { ...auto, notice: auto.notice ?? why };
  }
  return loadAuto(fresh, random);
}

async function loadAuto(fresh: (seed: number) => Sim, random: () => number): Promise<Start> {
  const json = await saveStore.read(AUTO_ID);
  let why: unknown = null;
  let kept = false;
  const head = saveStore.list().find((m) => m.id === AUTO_ID); // its label, read before keepBroken moves it
  if (json) {
    try {
      return { sim: deserialize(json, content), notice: null, persist: true };
    } catch (e) {
      why = e;
      kept = await keepBroken(json, head?.campaign);
    }
  }
  // The newest autosave is gone or unloadable: the older autosaves and the pre-combat snapshot of the same campaign are the way back, newest
  // first (a save without a campaign matches only a head without one). Another campaign's saves stay listed for the player to pick.
  // Whose saves may stand in: the failed head's campaign, or (a reload before the new game's first autosave) the one recorded on the set-aside save.
  const scope = head ?? saveStore.meta(BROKEN_ID);
  const rest = saveStore.list().filter((m) => m.id !== AUTO_ID && (isAutoId(m.id) || m.id === PRECOMBAT_ID) && (!scope || m.campaign === scope.campaign)).sort((x, y) => y.savedAt - x.savedAt);
  for (const m of rest) {
    const alt = await saveStore.read(m.id);
    if (!alt) continue;
    try {
      const sim = deserialize(alt, content);
      const min = Math.max(1, Math.round((Date.now() - m.savedAt) / 60_000));
      const was = why ? `The latest autosave ${unloadableWhy(why)} and couldn't be loaded.` : 'The latest autosave is missing.';
      return { sim, notice: `${was} Loaded ${m.id === PRECOMBAT_ID ? 'the snapshot from before combat' : 'the autosave'} from ${m.savedAt ? `${min} min ago` : 'earlier'} instead.${kept ? ' The broken one was kept in the browser.' : ''}`, persist: true };
    } catch { /* the next one */ }
  }
  if (!json) return { sim: fresh(random()), notice: null, persist: true };
  // A new game, and the old campaign's saves stay listed: they are the only way back to it.
  return { sim: fresh(random()), notice: unloadableNotice(why, kept, saveStore.list()), persist: true, showAll: true };
}

/** Saves written by another SAVE_VERSION than this build's (a save without the version in its label is not counted: it may well load). */
export function incompatibleSaves(metas: readonly SaveMeta[]): SaveMeta[] {
  return metas.filter((m) => m.version !== undefined && m.version !== SAVE_VERSION);
}

/** The start-up notice for a save that would not load, saying why, what was kept, and how many other saves are in the same state. */
export function unloadableNotice(e: unknown, kept: boolean, metas: readonly SaveMeta[]): string {
  const others = incompatibleSaves(metas).length;
  return `Your saved game ${unloadableWhy(e)} and could not be loaded. A new game has started.${kept ? ' The old save was kept in the browser.' : ''}`
    + (others ? ` ${others} other save${others === 1 ? '' : 's'} in the Load list ${others === 1 ? 'is' : 'are'} from another version too and cannot be loaded.` : '');
}

/** Why a save would not load: another version (naming both), or damaged. */
function unloadableWhy(e: unknown): string {
  const msg = e instanceof Error ? e.message : '';
  const was = /^Save version (\S+) is not/.exec(msg)?.[1];
  return msg.startsWith(VERSION_MISMATCH) ? `is from another version of the game${was && was !== 'undefined' ? ` (v${was}; this is v${SAVE_VERSION})` : ''}` : 'is damaged';
}

/** Message prefix `migrate` throws for a save of another SAVE_VERSION (as opposed to a corrupt payload). */
const VERSION_MISMATCH = 'Save version';
/** Move an unloadable save out of the main slot, keeping it. False when it could not be copied (it then stays in the main slot). */
async function keepBroken(json: string, campaign?: number): Promise<boolean> {
  // The label keeps the failed campaign's id: a reload before the fresh game autosaves must not recover another campaign's saves. Once an `auto` exists again its own label rules.
  if (!(await saveStore.write({ id: BROKEN_ID, name: 'Unloadable save', savedAt: Date.now(), turn: 0, node: '', campaign }, json))) return false;
  await clearSave();
  return true;
}

/**
 * The save function for the main loop (periodic, tab-hide and pagehide saves all go through it). Does nothing for a game that
 * must not persist (`?seed=`) or that is lost; otherwise writes and reports whether the write worked. A failed write leaves
 * the previous save in the slot untouched (the last known good one).
 */
export function createSaver(sim: Sim, persist: boolean, isLost: () => boolean, onResult: (ok: boolean) => void): () => void {
  return () => {
    if (!persist || loading || isLost() || lostReason(sim)) return;
    void writeAutosave(sim).then(onResult);
  };
}

/** The newest autosave is pushed down the chain (`auto` to `auto2` to `auto3`) once its head has been this long in place (`SaveMeta.since`, not the last write: autosaves overwrite it every 30 s); younger ones are overwritten. */
export const ROTATE_MS = 3 * 60_000;

/**
 * The periodic autosave: writes `auto`, first keeping the previous one as `auto2` (and that as `auto3`) when it was started at least ROTATE_MS ago.
 * Never rotates during a fight, and never moves a head that was saved in one (it is overwritten, keeping its age), so the older autosaves stay calm ones to go back to. A write that fails leaves the chain as it was.
 */
export function writeAutosave(sim: Sim, now = Date.now()): Promise<boolean> {
  // Whether the chain moves is decided by the store when this write's turn comes, from the label the writes before it left.
  const due = (newest: SaveMeta | undefined) => !!newest && newest.savedAt > 0 && !newest.fight && (newest.campaign ?? sim.seed) === sim.seed && now - (newest.since ?? newest.savedAt) >= ROTATE_MS && !sim.sector.inCombat;
  return writeSave(sim, AUTO_ID, 'Autosave', now, AUTO_IDS, due);
}

/** The snapshot taken as a fight starts (overwritten by the next fight). */
export function writePrecombat(sim: Sim, now = Date.now()): Promise<boolean> {
  return writeSave(sim, PRECOMBAT_ID, 'Before combat', now);
}

/**
 * Whether a save in the list belongs to this game's campaign. The pre-combat snapshot must (an older one has no campaign and never does);
 * the older autosaves must not be another campaign's; the newest autosave and the named slots are always the player's to pick.
 */
export function inThisCampaign(sim: Sim, m: Pick<SaveMeta, 'id' | 'campaign'>): boolean {
  if (m.id === PRECOMBAT_ID) return m.campaign === sim.seed;
  if (AUTO_IDS.includes(m.id as never) && m.id !== AUTO_ID) return (m.campaign ?? sim.seed) === sim.seed;
  return true;
}

/** Write the save (async; the write is started at once). False when the browser refuses (storage full or blocked). */
export function writeSave(sim: Sim, id = AUTO_ID, name = 'Autosave', now = Date.now(), shift?: readonly string[], due?: (newest: SaveMeta | undefined) => boolean): Promise<boolean> {
  let json: string;
  try {
    json = serialize(sim);
  } catch {
    return Promise.resolve(false);
  }
  // The store starts its transaction before this returns, so a save made in a `pagehide` handler is already under way.
  return saveStore.write(saveMeta(sim, id, name, now), json, shift, due);
}

/** The list label of a save of this game now. */
export function saveMeta(sim: Sim, id: string, name: string, now = Date.now()): SaveMeta {
  return { id, name, savedAt: now, turn: sim.galaxy.turn, node: nodeOf(sim, sim.galaxy.current)?.name ?? '', version: SAVE_VERSION, fight: sim.sector.inCombat, campaign: sim.seed };
}

export function clearSave(): Promise<boolean> {
  return saveStore.remove(AUTO_ID);
}

/** Load a save slot (a reload: the game is rebuilt around it). Progress since the last save is lost. The page drops its debug query. */
export function loadSlot(id: string): void {
  loading = true;
  try {
    sessionStorage.setItem(LOAD_SLOT, id);
  } catch {
    /* without the flag the reload plays the autosave */
  }
  // Without the query: a debug start (`?seed=`, `?scenario=`) would otherwise replace the loaded game.
  location.assign(location.pathname);
}

/** Throw this game away and start a new one (a reload). */
export async function restartNewGame(): Promise<void> {
  try {
    sessionStorage.setItem(NEW_GAME, '1');
  } catch {
    /* without it the reload loads the save; clear it so it starts fresh anyway */
  }
  loading = true; // the reload's pagehide must not write the old game back
  await Promise.all([...AUTO_IDS, PRECOMBAT_ID].map((id) => saveStore.remove(id))); // nothing of the old campaign is left to load into the new one
  location.reload();
}

/** Go back to the last save (a reload: the save on disk is the one before the loss). */
export function reloadLastSave(): void {
  location.reload();
}

/**
 * Why the game is lost, or null: the player's ship destroyed, or no living crew left aboard. Only checked while the ship
 * is in a node: in hyperspace the ship and crew are packed away and read as absent.
 */
export function lostReason(sim: Sim): string | null {
  if (sim.sector.state !== 'active') return null;
  const ship = homeShip(sim);
  if (!ship || sim.world.get(ship, ShipC)?.state === 'wreck') return 'Your ship was destroyed.';
  if (!playerCrew(sim).length) return 'Your crew is gone.';
  return null;
}
