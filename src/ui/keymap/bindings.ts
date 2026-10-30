import { ACTION_BY_ID, ACTIONS, type ActionDef, type ActionId, type KeyGroup } from './actions';
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

/** Two actions can share a key without conflict: their contexts never overlap, or one says it shares on purpose. */
export function overlaps(x: ActionDef, y: ActionDef): boolean {
  if (x.shares?.includes(y.id) || y.shares?.includes(x.id)) return false;
  return x.context === 'global' || y.context === 'global' || x.context === y.context;
}

export interface Keymap {
  subscribe(run: (b: Bindings) => void): () => void;
  get(): Bindings;
  /** The action's chords now (primary first). */
  keys(id: ActionId): readonly string[];
  /** Does this key press trigger the action? */
  matches(e: Pick<KeyboardEvent, 'code' | 'shiftKey'>, id: ActionId): boolean;
  /** The same, ignoring Shift (held camera pans). */
  matchesCode(code: string, id: ActionId): boolean;
  /** Actions (other than `id`) whose bindings would clash with `chord` on `id`. */
  conflicts(id: ActionId, chord: string): ActionId[];
  /** Put `chord` in the action's slot (null clears it). With `swap`, the actions it conflicts with get the chord that slot had. */
  bind(id: ActionId, slot: number, chord: string | null, swap?: boolean): void;
  /** Back to the defaults: one group, or everything. */
  reset(group?: KeyGroup): void;
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
  } catch { /* blocked or junk: the defaults */ }
  const subs = new Set<(b: Bindings) => void>();
  const commit = (next: Record<string, string[]>) => {
    cur = next;
    // Only the changes are stored, so a later default change still reaches untouched actions.
    const diff: Record<string, string[]> = {};
    for (const def of ACTIONS) if (cur[def.id]!.join() !== def.keys.join()) diff[def.id] = cur[def.id]!;
    try { storage()?.setItem(KEYS_STORE, JSON.stringify(diff)); } catch { /* not remembered */ }
    for (const fn of [...subs]) fn(cur);
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
      const c = chordOf(e);
      return !!c && km.keys(id).includes(c);
    },
    matchesCode: (code, id) => km.keys(id).some((c) => codeOf(c) === code),
    conflicts(id, chord) {
      const me = ACTION_BY_ID.get(id);
      if (!me) return [];
      return ACTIONS.filter((o) => o.id !== id && (cur[o.id] ?? []).includes(chord) && overlaps(me, o)).map((o) => o.id);
    },
    bind(id, slot, chord, swap = false) {
      const def = ACTION_BY_ID.get(id);
      if (!def || def.fixed) return;
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
      commit(next);
    },
    reset(group) {
      const d = defaults();
      commit(group ? { ...cur, ...Object.fromEntries(ACTIONS.filter((x) => x.group === group).map((x) => [x.id, d[x.id]!])) } : d);
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
