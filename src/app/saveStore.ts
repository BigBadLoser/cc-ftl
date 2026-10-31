/**
 * Where saves live: a small store interface (list, read, write, remove, with metadata) so the menu and the loader never touch the storage
 * itself. Today it is localStorage; issue #204 swaps in IndexedDB behind the same interface.
 *
 * The autosave keeps its old key (`cc.save`), so existing saves still load; named slots get their own keys; one index key holds the metadata.
 */
export interface SaveMeta {
  /** 'auto' for the autosave, 'slot1'... for the named slots. */
  id: string;
  name: string;
  /** Real time of the save (ms since the epoch). */
  savedAt: number;
  /** Starmap turn and the node's name, for the list. */
  turn: number;
  node: string;
  /** SAVE_VERSION it was written with (absent on saves from before this field). */
  version?: number;
  /** The game was in combat when it was saved. */
  fight?: boolean;
}

export interface SaveStore {
  /** Every save that exists: the autosaves (newest first), the pre-combat snapshot, then the named slots. */
  list(): SaveMeta[];
  read(id: string): string | null;
  /** False when the browser refuses the write (full or blocked): the save that was there stays. */
  write(meta: SaveMeta, json: string): boolean;
  remove(id: string): boolean;
}

export const AUTO_ID = 'auto';
/** The rotating autosaves, newest first: `auto` is written every time, the older ones are the autosaves that came before it. */
export const AUTO_IDS = [AUTO_ID, 'auto2', 'auto3'] as const;
/** The snapshot taken as combat starts: the way back to a fight that went wrong. */
export const PRECOMBAT_ID = 'precombat';
export const isAutoId = (id: string): boolean => (AUTO_IDS as readonly string[]).includes(id);
/** The named slots, in order. */
export const SLOT_IDS = ['slot1', 'slot2', 'slot3'] as const;
const INDEX = 'cc.saves';
const keyOf = (id: string): string => (id === AUTO_ID ? 'cc.save' : `cc.save.${id}`);

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function createLocalSaveStore(storage: () => Store | null): SaveStore {
  const index = (): Record<string, SaveMeta> => {
    try {
      const raw = storage()?.getItem(INDEX);
      const v = raw ? (JSON.parse(raw) as Record<string, SaveMeta>) : {};
      return v && typeof v === 'object' ? v : {};
    } catch {
      return {};
    }
  };
  const has = (id: string): boolean => {
    try { return storage()?.getItem(keyOf(id)) != null; } catch { return false; }
  };
  return {
    list() {
      const idx = index();
      return [...AUTO_IDS, PRECOMBAT_ID, ...SLOT_IDS].filter(has).map((id) => idx[id] ?? { id, name: isAutoId(id) ? 'Autosave' : id, savedAt: 0, turn: 0, node: '' });
    },
    read(id) {
      try { return storage()?.getItem(keyOf(id)) ?? null; } catch { return null; }
    },
    write(meta, json) {
      const s = storage();
      if (!s) return false;
      try {
        s.setItem(keyOf(meta.id), json);
      } catch {
        return false;
      }
      try { s.setItem(INDEX, JSON.stringify({ ...index(), [meta.id]: meta })); } catch { /* the save is written; only its label is missing */ }
      return true;
    },
    remove(id) {
      const s = storage();
      if (!s) return false;
      try {
        s.removeItem(keyOf(id));
        const idx = index();
        delete idx[id];
        s.setItem(INDEX, JSON.stringify(idx));
        return true;
      } catch {
        return false;
      }
    },
  };
}

const browserStorage = (): Store | null => {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
};

/** The browser's saves. */
export const saveStore: SaveStore = createLocalSaveStore(browserStorage);
