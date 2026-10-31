import { content } from '../content';
import { deserialize, homeShip, newGame, nodeOf, SAVE_VERSION, serialize, ShipC, type Sim } from '../sim';
import { AUTO_ID, AUTO_IDS, PRECOMBAT_ID, saveStore, type SaveMeta } from './saveStore';
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
}

/**
 * The game to play: `?seed=` asks for a new game of that seed (debug and screenshot scripts); a requested new game is a
 * fresh random seed; otherwise the saved game, else a new one. A save from another SAVE_VERSION cannot be loaded
 * (no migrations while this is a prototype): it is dropped, with a notice.
 */
export function startGame(seedParam: string | null): Start {
  const fresh = (seed: number) => newGame(seed >>> 0, content, undefined, true);
  const random = () => (Math.random() * 0x100000000) >>> 0;
  if (seedParam !== null && Number.isFinite(Number(seedParam))) return { sim: fresh(Number(seedParam)), notice: null, persist: false };
  if (take(NEW_GAME)) return { sim: fresh(random()), notice: null, persist: true };
  const slot = take(LOAD_SLOT);
  if (slot && slot !== AUTO_ID) {
    const picked = saveStore.read(slot);
    try {
      if (picked) return { sim: deserialize(picked, content), notice: null, persist: true };
    } catch {
      /* falls through to the autosave below; the slot itself is left as it is */
    }
    const auto = loadAuto(fresh, random);
    const why = 'The save you picked could not be loaded (it may be from another version of the game). It was kept; you are playing your autosave instead.';
    return { ...auto, notice: auto.notice ?? why };
  }
  return loadAuto(fresh, random);
}

function loadAuto(fresh: (seed: number) => Sim, random: () => number): Start {
  const json = saveStore.read(AUTO_ID);
  if (json) {
    try {
      return { sim: deserialize(json, content), notice: null, persist: true };
    } catch (e) {
      const kept = keepBroken(json);
      return { sim: fresh(random()), notice: unloadableNotice(e, kept, saveStore.list()), persist: true };
    }
  }
  return { sim: fresh(random()), notice: null, persist: true };
}

/** Saves written by another SAVE_VERSION than this build's (a save without the version in its label is not counted: it may well load). */
export function incompatibleSaves(metas: readonly SaveMeta[]): SaveMeta[] {
  return metas.filter((m) => m.version !== undefined && m.version !== SAVE_VERSION);
}

/** The start-up notice for a save that would not load, saying why, what was kept, and how many other saves are in the same state. */
export function unloadableNotice(e: unknown, kept: boolean, metas: readonly SaveMeta[]): string {
  const msg = e instanceof Error ? e.message : '';
  const old = msg.startsWith(VERSION_MISMATCH);
  const was = /^Save version (\S+) is not/.exec(msg)?.[1];
  const why = old ? `is from another version of the game${was && was !== 'undefined' ? ` (v${was}; this is v${SAVE_VERSION})` : ''}` : 'is damaged';
  const others = incompatibleSaves(metas).length;
  return `Your saved game ${why} and could not be loaded. A new game has started.${kept ? ' The old save was kept in the browser.' : ''}`
    + (others ? ` ${others} other save${others === 1 ? '' : 's'} in the Load list ${others === 1 ? 'is' : 'are'} from another version too and cannot be loaded.` : '');
}

/** Message prefix `migrate` throws for a save of another SAVE_VERSION (as opposed to a corrupt payload). */
const VERSION_MISMATCH = 'Save version';
/** Where a save that could not be loaded is kept, so a failed load never deletes the only copy. */
export const BROKEN_SLOT = 'cc.save.broken';

/** Move an unloadable save out of the main slot, keeping it. False when it could not be copied (it then stays in the main slot). */
function keepBroken(json: string): boolean {
  try {
    localStorage.setItem(BROKEN_SLOT, json);
  } catch {
    return false;
  }
  clearSave();
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
    onResult(writeAutosave(sim));
  };
}

/** The newest autosave is pushed down the chain (`auto` to `auto2` to `auto3`) once it is this old; younger ones are overwritten in place. */
export const ROTATE_MS = 3 * 60_000;

/**
 * The periodic autosave: writes `auto`, first keeping the previous one as `auto2` (and that as `auto3`) when it is at least ROTATE_MS old.
 * Never rotates during a fight, so the older autosaves stay calm ones to go back to. A write that fails leaves the chain as it was.
 */
export function writeAutosave(sim: Sim, now = Date.now()): boolean {
  const metas = new Map(saveStore.list().map((m) => [m.id, m]));
  const newest = metas.get(AUTO_ID);
  if (newest && newest.savedAt > 0 && now - newest.savedAt >= ROTATE_MS && !sim.sector.inCombat) {
    for (let i = AUTO_IDS.length - 1; i > 0; i--) {
      const from = AUTO_IDS[i - 1]!;
      const meta = metas.get(from);
      const json = saveStore.read(from);
      if (meta && json !== null) saveStore.write({ ...meta, id: AUTO_IDS[i]! }, json);
    }
  }
  return writeSave(sim, AUTO_ID, 'Autosave', now);
}

/** The snapshot taken as a fight starts (overwritten by the next fight). */
export function writePrecombat(sim: Sim, now = Date.now()): boolean {
  return writeSave(sim, PRECOMBAT_ID, 'Before combat', now);
}

/** Write the save. False when the browser refuses (storage full or blocked). */
export function writeSave(sim: Sim, id = AUTO_ID, name = 'Autosave', now = Date.now()): boolean {
  let json: string;
  try {
    json = serialize(sim);
  } catch {
    return false;
  }
  return saveStore.write(saveMeta(sim, id, name, now), json);
}

/** The list label of a save of this game now. */
export function saveMeta(sim: Sim, id: string, name: string, now = Date.now()): SaveMeta {
  return { id, name, savedAt: now, turn: sim.galaxy.turn, node: nodeOf(sim, sim.galaxy.current)?.name ?? '', version: SAVE_VERSION, fight: sim.sector.inCombat };
}

export function clearSave(): void {
  saveStore.remove(AUTO_ID);
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
export function restartNewGame(): void {
  try {
    sessionStorage.setItem(NEW_GAME, '1');
  } catch {
    /* without it the reload loads the save; clear it so it starts fresh anyway */
  }
  clearSave();
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
