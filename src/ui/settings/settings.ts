/**
 * Player settings, per browser profile (localStorage, every access guarded), applied live: whoever needs one subscribes. Lessons keep their
 * own prefs (lessons/prefs.ts); the Settings page shows both.
 */
export interface Settings {
  /** Pause the game when an urgent alert appears. */
  pauseOnAlert: boolean;
  /** Pause while the window is in the background; resume on return if this paused it. */
  pauseOnBlur: boolean;
  /** Game speed a loaded or new game starts at (0 = paused). */
  startSpeed: 0 | 1 | 2 | 3;
  /** Pan the camera when the mouse rests at a window edge. */
  edgeScroll: boolean;
  /** Keyboard and edge pan speed, as a multiple of the default. */
  scrollSpeed: number;
  /** Mouse-wheel and key zoom speed, as a multiple of the default. */
  zoomSpeed: number;
  /** Dragging the view moves the camera the other way (grab the camera, not the world). */
  invertDrag: boolean;
  showFps: boolean;
  tooltips: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  pauseOnAlert: false,
  pauseOnBlur: false,
  startSpeed: 1,
  edgeScroll: false,
  scrollSpeed: 1,
  zoomSpeed: 1,
  invertDrag: false,
  showFps: false,
  tooltips: true,
};

/** The allowed range of each number setting. */
export const RANGES = {
  scrollSpeed: { min: 0.5, max: 2, step: 0.25 },
  zoomSpeed: { min: 0.5, max: 2, step: 0.25 },
} as const;

export const SETTINGS_STORE = 'cc-ftl.settings';

type Store = Pick<Storage, 'getItem' | 'setItem'>;

export interface SettingsStore {
  subscribe(run: (s: Settings) => void): () => void;
  get(): Settings;
  set(patch: Partial<Settings>): void;
  reset(): void;
}

/** A stored value of the right type and range, else the default. */
function clean(raw: Record<string, unknown>): Settings {
  const out = { ...DEFAULT_SETTINGS };
  for (const k of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
    const v = raw[k];
    if (typeof v !== typeof DEFAULT_SETTINGS[k]) continue;
    if (k in RANGES) {
      const r = RANGES[k as keyof typeof RANGES];
      if (typeof v !== 'number' || !Number.isFinite(v) || v < r.min || v > r.max) continue;
    }
    if (k === 'startSpeed' && ![0, 1, 2, 3].includes(v as number)) continue;
    (out as Record<string, unknown>)[k] = v;
  }
  return out;
}

export function createSettings(storage: () => Store | null): SettingsStore {
  let cur = { ...DEFAULT_SETTINGS };
  try {
    const raw = storage()?.getItem(SETTINGS_STORE);
    if (raw) cur = clean(JSON.parse(raw) as Record<string, unknown>);
  } catch { /* blocked or junk: the defaults */ }
  const subs = new Set<(s: Settings) => void>();
  const commit = (next: Settings) => {
    cur = next;
    try { storage()?.setItem(SETTINGS_STORE, JSON.stringify(cur)); } catch { /* not remembered */ }
    for (const fn of [...subs]) fn(cur);
  };
  return {
    subscribe(run) {
      subs.add(run);
      run(cur);
      return () => subs.delete(run);
    },
    get: () => cur,
    set: (patch) => commit(clean({ ...cur, ...patch })),
    reset: () => commit({ ...DEFAULT_SETTINGS }),
  };
}

const browserStorage = (): Store | null => {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
};

/** The page's settings. */
export const settings: SettingsStore = createSettings(browserStorage);
