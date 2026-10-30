import { ACTION_BY_ID, ACTIONS, type ActionDef, type ActionId, type KeyContext, type KeyGroup } from './actions';
import { chordLabel, chordOf, codeOf } from './chords';

/**
 * The player's key bindings: the defaults in actions.ts with their changes on top, kept per browser profile in localStorage (every access
 * guarded). Key handlers ask `matches(e, id)`; the Controls page rebinds through `bind` and reads conflicts from `conflicts`.
 */
export type Bindings = Readonly<Record<string, readonly string[]>>;

export const KEYS_STORE = 'cc-ftl.keys';
/** Slots per action (primary and alternate). */
export const SLOTS = 2;

type Store = Pick<Storage, 'getItem' | 'setItem'>;

const defaults = (): Record<string, string[]> => Object.fromEntries(ACTIONS.map((x) => [x.id, [...x.keys]]));

/**
 * Which contexts' handlers can run at the same moment (actions.ts, KeyContext). Only build and combat never meet: a fight drops the build
 * tools and hides the tool bar.
 */
const LIVE_WITH: Record<KeyContext, readonly KeyContext[]> = {
  global: ['global', 'world', 'build', 'combat'],
  world: ['global', 'world', 'build', 'combat'],
  build: ['global', 'world', 'build'],
  combat: ['global', 'world', 'combat'],
};

/** Two actions on one key clash when their handlers can run together, unless one says it shares the key on purpose. */
export function overlaps(x: ActionDef, y: ActionDef): boolean {
  if (x.shares?.includes(y.id) || y.shares?.includes(x.id)) return false;
  return LIVE_WITH[x.context].includes(y.context);
}

/** An action that lost a key to keep the map free of conflicts: `chord` now belongs only to `to`. */
export interface LostKey {
  id: ActionId;
  chord: string;
  to: ActionId[];
}

/**
 * Make a key map conflict-free with the same rule the Controls page shows (`overlaps`): wherever two actions share a key in overlapping
 * contexts, one keeps it and the other is unbound from it, never silently shared. Who keeps it: the actions the player just set (`target`),
 * then actions the change did not touch, then actions it moved as a side effect (a swap's displaced key); between equals, the one listed
 * first in actions.ts. Returns the clean map and every key an action lost.
 */
export function resolveConflicts(next: Record<string, string[]>, prev: Bindings, target: ReadonlySet<string>): { map: Record<string, string[]>; lost: LostKey[] } {
  const map: Record<string, string[]> = Object.fromEntries(Object.entries(next).map(([k, v]) => [k, [...v]]));
  const rank = (id: string) => (target.has(id) ? 2 : (prev[id] ?? []).join() === (next[id] ?? []).join() ? 1 : 0);
  const order = new Map(ACTIONS.map((a, i) => [a.id, i]));
  const lost = new Map<string, LostKey>();
  for (let i = 0; i < ACTIONS.length; i++) {
    for (let j = i + 1; j < ACTIONS.length; j++) {
      const a = ACTIONS[i]!;
      const b = ACTIONS[j]!;
      if (!overlaps(a, b)) continue;
      for (const chord of [...(map[a.id] ?? [])]) {
        if (!(map[b.id] ?? []).includes(chord)) continue;
        let [, lose] = rank(a.id) > rank(b.id) || (rank(a.id) === rank(b.id) && order.get(a.id)! < order.get(b.id)!) ? [a, b] : [b, a];
        if (lose.fixed) lose = lose === a ? b : a; // a fixed key (Esc) is never taken away: whoever tried to share it loses
        if (lose.fixed) continue;
        map[lose.id] = map[lose.id]!.filter((c) => c !== chord);
        // Name every action that still uses the key where the loser listens, not only the one it was weighed against.
        const to = ACTIONS.filter((o) => o.id !== lose.id && (map[o.id] ?? []).includes(chord) && overlaps(lose, o)).map((o) => o.id as ActionId);
        const key = `${lose.id}|${chord}`;
        if (!lost.has(key)) lost.set(key, { id: lose.id as ActionId, chord, to });
      }
    }
  }
  return { map, lost: [...lost.values()] };
}

export interface Keymap {
  subscribe(run: (b: Bindings) => void): () => void;
  get(): Bindings;
  /** The action's chords now (primary first). */
  keys(id: ActionId): readonly string[];
  /** Does this key press trigger the action? Never with Ctrl, Alt or Meta held: those chords are the browser's (Ctrl+P prints). */
  matches(e: Pick<KeyboardEvent, 'code' | 'shiftKey'> & Partial<Pick<KeyboardEvent, 'ctrlKey' | 'altKey' | 'metaKey'>>, id: ActionId): boolean;
  /** Actions (other than `id`) whose bindings would clash with `chord` on `id`. */
  conflicts(id: ActionId, chord: string): ActionId[];
  /**
   * Put `chord` in the action's slot (null clears it). With `swap`, the actions it conflicts with get the chord that slot had. Every change
   * leaves the map conflict-free (`resolveConflicts`); returns the keys other actions lost on the way, for the player to rebind.
   */
  bind(id: ActionId, slot: number, chord: string | null, swap?: boolean): LostKey[];
  /** Back to the defaults: one group, or everything. Returns the keys other actions lost (a group's defaults win over custom keys). */
  reset(group?: KeyGroup): LostKey[];
}

export function createKeymap(storage: () => Store | null): Keymap {
  let cur = defaults();
  try {
    const raw = storage()?.getItem(KEYS_STORE);
    const saved = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    for (const [id, v] of Object.entries(saved)) {
      const def = ACTION_BY_ID.get(id);
      if (def && !def.fixed && Array.isArray(v)) cur[id] = v.filter((c): c is string => typeof c === 'string').slice(0, SLOTS);
    }
    cur = resolveConflicts(cur, cur, new Set()).map; // stored keys from an older or hand-edited map: no conflict survives a load
  } catch { /* blocked or junk: the defaults */ }
  const subs = new Set<(b: Bindings) => void>();
  /** The one way the map changes: resolve conflicts (the `target` actions keep their keys), store, notify. */
  const commit = (raw: Record<string, string[]>, target: ReadonlySet<string>): LostKey[] => {
    const { map: next, lost } = resolveConflicts(raw, cur, target);
    cur = next;
    // Only the changes are stored, so a later default change still reaches untouched actions.
    const diff: Record<string, string[]> = {};
    for (const def of ACTIONS) if (cur[def.id]!.join() !== def.keys.join()) diff[def.id] = cur[def.id]!;
    try { storage()?.setItem(KEYS_STORE, JSON.stringify(diff)); } catch { /* not remembered */ }
    for (const fn of [...subs]) fn(cur);
    return lost;
  };
  const km: Keymap = {
    subscribe(run) {
      subs.add(run);
      run(cur);
      return () => subs.delete(run);
    },
    get: () => cur,
    keys: (id) => cur[id] ?? [],
    matches(e, id) {
      if (e.ctrlKey || e.altKey || e.metaKey) return false;
      const c = chordOf(e);
      return !!c && km.keys(id).includes(c);
    },
    conflicts(id, chord) {
      const me = ACTION_BY_ID.get(id);
      if (!me) return [];
      return ACTIONS.filter((o) => o.id !== id && (cur[o.id] ?? []).includes(chord) && overlaps(me, o)).map((o) => o.id);
    },
    bind(id, slot, chord, swap = false) {
      const def = ACTION_BY_ID.get(id);
      if (!def || def.fixed) return [];
      const next = { ...cur, [id]: [...(cur[id] ?? [])] };
      const old = next[id]![slot] ?? null;
      if (chord && swap) {
        for (const o of km.conflicts(id, chord)) {
          const keys = next[o]!.map((c) => (c === chord ? old : c)).filter((c): c is string => !!c);
          next[o] = keys;
        }
      }
      const mine = next[id]!;
      if (chord) mine[slot] = chord;
      else mine.splice(slot, 1);
      next[id] = [...new Set(mine.filter(Boolean))].slice(0, SLOTS);
      return commit(next, new Set([id]));
    },
    reset(group) {
      const d = defaults();
      if (!group) return commit(d, new Set(ACTIONS.map((x) => x.id)));
      const ids = ACTIONS.filter((x) => x.group === group).map((x) => x.id);
      return commit({ ...cur, ...Object.fromEntries(ids.map((id) => [id, d[id]!])) }, new Set(ids));
    },
  };
  return km;
}

const browserStorage = (): Store | null => {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
};

/** The page's key bindings. */
export const keymap: Keymap = createKeymap(browserStorage);

/** An action's primary key as the player reads it ('Q'), or '' when unbound. */
export const keyLabel = (b: Bindings, id: ActionId): string => {
  const c = b[id]?.[0];
  return c ? chordLabel(c) : '';
};

export { chordLabel, chordOf, codeOf };
