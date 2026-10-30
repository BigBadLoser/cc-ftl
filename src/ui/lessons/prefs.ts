/**
 * Which lessons this browser profile has seen, and whether lessons are on. Kept in localStorage (not the save: a new game does not
 * repeat them). Every storage access is guarded: blocked storage just means nothing is remembered.
 */
export interface LessonPrefs {
  isSeen(id: string): boolean;
  markSeen(id: string): void;
  /** Forget every seen lesson ("Reset tutorials"). */
  reset(): void;
  enabled(): boolean;
  setEnabled(on: boolean): void;
}

export const PREFS_KEY = 'cc-ftl.lessons';

interface Stored { seen: string[]; off: boolean }

export function createLessonPrefs(storage: () => Pick<Storage, 'getItem' | 'setItem'> | null): LessonPrefs {
  let state: Stored | null = null;
  const load = (): Stored => {
    if (state) return state;
    state = { seen: [], off: false };
    try {
      const raw = storage()?.getItem(PREFS_KEY);
      const v = raw ? (JSON.parse(raw) as Partial<Stored>) : null;
      if (v && Array.isArray(v.seen)) state.seen = v.seen.filter((x): x is string => typeof x === 'string');
      if (v?.off === true) state.off = true;
    } catch { /* storage blocked or junk: start fresh */ }
    return state;
  };
  const save = () => {
    try { storage()?.setItem(PREFS_KEY, JSON.stringify(load())); } catch { /* storage may be blocked */ }
  };
  return {
    isSeen: (id) => load().seen.includes(id),
    markSeen(id) {
      if (load().seen.includes(id)) return;
      load().seen.push(id);
      save();
    },
    reset() {
      load().seen = [];
      save();
    },
    enabled: () => !load().off,
    setEnabled(on) {
      load().off = !on;
      save();
    },
  };
}

const browserStorage = (): Storage | null => {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
};

/** The page's prefs, shared by the lesson host and the settings that reset or disable lessons. */
export const lessonPrefs: LessonPrefs = createLessonPrefs(browserStorage);
