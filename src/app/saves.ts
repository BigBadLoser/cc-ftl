import { content } from '../content';
import { deserialize, homeShip, newGame, serialize, ShipC, type Sim } from '../sim';
import { playerCrew } from '../sim/story/world';

/**
 * The browser save: one slot in localStorage (a save is well under a megabyte early on). `startGame` loads it on page load;
 * the main loop writes it with `autosave`. Starting over or reloading the last save reloads the page: the renderer, bridge
 * and controller are all built around one Sim, and a reload is the clean way to swap it.
 */

const SLOT = 'cc.save';
/** Set before a reload to start a new game instead of loading the save. */
const NEW_GAME = 'cc.newGame';

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
  if (read(NEW_GAME, sessionStorage)) {
    try {
      sessionStorage.removeItem(NEW_GAME);
    } catch {
      /* the flag only lasts the reload */
    }
    return { sim: fresh(random()), notice: null, persist: true };
  }
  const json = read(SLOT);
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
    if (!persist || isLost() || lostReason(sim)) return;
    onResult(writeSave(sim));
  };
}

/** Write the save. False when the browser refuses (storage full or blocked). */
export function writeSave(sim: Sim): boolean {
  try {
    localStorage.setItem(SLOT, serialize(sim));
    return true;
  } catch {
    return false;
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(SLOT);
  } catch {
    /* nothing to clear */
  }
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
