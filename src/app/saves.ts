import { content } from '../content';
import { deserialize, homeShip, newGame, nodeOf, serialize, ShipC, type Sim } from '../sim';
import { AUTO_ID, saveStore, type SaveMeta } from './saveStore';
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
      const old = e instanceof Error && e.message.startsWith(VERSION_MISMATCH);
      const kept = keepBroken(json);
      const why = old ? 'is from another version of the game' : 'is damaged';
      return {
        sim: fresh(random()),
        notice: `Your saved game ${why} and could not be loaded. A new game has started.${kept ? ' The old save was kept in the browser.' : ''}`,
        persist: true,
      };
    }
  }
  return { sim: fresh(random()), notice: null, persist: true };
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
    onResult(writeSave(sim));
  };
}

/** Write the save. False when the browser refuses (storage full or blocked). */
export function writeSave(sim: Sim, id = AUTO_ID, name = 'Autosave'): boolean {
  let json: string;
  try {
    json = serialize(sim);
  } catch {
    return false;
  }
  return saveStore.write(saveMeta(sim, id, name), json);
}

/** The list label of a save of this game now. */
export function saveMeta(sim: Sim, id: string, name: string): SaveMeta {
  return { id, name, savedAt: Date.now(), turn: sim.galaxy.turn, node: nodeOf(sim, sim.galaxy.current)?.name ?? '' };
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
