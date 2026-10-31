/**
 * Where saves live: a small store interface (list, read, write, remove, with metadata) so the menu and the loader never touch the storage
 * itself. The data is in IndexedDB (a save is over a megabyte; localStorage's quota held about four). Labels are also kept in memory after
 * `ready()`, so the menu lists saves without waiting. Saves an older build left in localStorage (`cc.save`, `cc.save.slotN`, index
 * `cc.saves`) are moved into IndexedDB on first run and removed from localStorage once they are safely stored.
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
  /** The campaign it belongs to: the sim seed, which a campaign keeps through every save and load (absent on older saves). */
  campaign?: number;
  /** The game was in combat when it was saved. */
  fight?: boolean;
  /** An autosave chain head: when this head was started (the last time the chain moved). Overwrites keep it, so the head's age is known. */
  since?: number;
}

export interface SaveStore {
  /** Open the database and move old localStorage saves into it. Resolves either way (a store that cannot open lists nothing and refuses writes). */
  ready(): Promise<void>;
  /** Every save that exists: the autosaves (newest first), the pre-combat snapshot, then the named slots. Read from memory; call after `ready()`. */
  list(): SaveMeta[];
  read(id: string): Promise<string | null>;
  /**
   * Store a save. False when the browser refuses (full, blocked, no IndexedDB): the save that was there stays (one transaction).
   * `shift`: a chain of ids starting with `meta.id`; the entries already in it move one place down (the last drops off) in the same
   * transaction, before this one is stored. `due` decides at that moment, from the newest entry's label (undefined: none yet), whether the
   * chain moves at all; the default is always. The stored label's `since` is set then: `meta.savedAt` when the chain moves or starts, else the
   * entry's earlier `since`.
   * Writes and removes run one after another (each starts once the previous settled, so `due` sees its label). When none is pending the
   * transaction starts before this returns, so it is safe in a `pagehide` handler.
   */
  write(meta: SaveMeta, json: string, shift?: readonly string[], due?: (current: SaveMeta | undefined) => boolean): Promise<boolean>;
  remove(id: string): Promise<boolean>;
}

export const AUTO_ID = 'auto';
/** The rotating autosaves, newest first: `auto` is written every time, the older ones are the autosaves that came before it. */
export const AUTO_IDS = [AUTO_ID, 'auto2', 'auto3'] as const;
/** The snapshot taken as combat starts: the way back to a fight that went wrong. */
export const PRECOMBAT_ID = 'precombat';
/** Where a save that could not be loaded is kept (never listed), so a failed load never deletes the only copy. */
export const BROKEN_ID = 'broken';
export const isAutoId = (id: string): boolean => (AUTO_IDS as readonly string[]).includes(id);
/** The named slots, in order. */
export const SLOT_IDS = ['slot1', 'slot2', 'slot3'] as const;
const LISTED: readonly string[] = [...AUTO_IDS, PRECOMBAT_ID, ...SLOT_IDS];

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const META = 'meta';
const DATA = 'data';
const LS_INDEX = 'cc.saves';
const lsKey = (id: string): string => (id === AUTO_ID ? 'cc.save' : id === BROKEN_ID ? 'cc.save.broken' : `cc.save.${id}`);
const done = (tx: IDBTransaction): Promise<boolean> =>
  new Promise((res) => {
    tx.oncomplete = () => res(true);
    tx.onerror = tx.onabort = () => res(false);
  });
const label = (id: string): SaveMeta => ({ id, name: isAutoId(id) ? 'Autosave' : id, savedAt: 0, turn: 0, node: '' });

export function createIdbSaveStore(factory: () => IDBFactory | null, local: () => Store | null, dbName = 'cc-saves'): SaveStore {
  let db: IDBDatabase | null = null;
  let opening: Promise<void> | null = null;
  const metas = new Map<string, SaveMeta>();
  /** Writes and removes in order: a later one runs after the earlier one settled and its labels are in `metas`. */
  let pending = 0;
  let tail: Promise<void> = Promise.resolve();
  function enqueue<T>(job: () => Promise<T>): Promise<T> {
    const run = pending === 0 ? job() : tail.then(job);
    pending++;
    tail = run.then(() => undefined, () => undefined).then(() => { pending--; });
    return run;
  }

  const open = (): Promise<void> =>
    new Promise((res) => {
      try {
        const req = factory()?.open(dbName, 1);
        if (!req) return res();
        req.onupgradeneeded = () => {
          req.result.createObjectStore(META);
          req.result.createObjectStore(DATA);
        };
        req.onsuccess = () => {
          db = req.result;
          res();
        };
        req.onerror = req.onblocked = () => res();
      } catch {
        res();
      }
    });

  const loadMetas = (): Promise<void> =>
    new Promise((res) => {
      if (!db) return res();
      try {
        const tx = db.transaction(META, 'readonly');
        const req = tx.objectStore(META).getAll();
        req.onsuccess = () => {
          for (const m of req.result as SaveMeta[]) metas.set(m.id, m);
          res();
        };
        tx.onerror = tx.onabort = () => res();
      } catch {
        res();
      }
    });

  /**
   * Saves an older build left in localStorage that could not be copied (IndexedDB full or missing). They stay first-class until they are:
   * listed with their old labels, read from localStorage, removed there too. Once a write of the same id succeeds (it is newer) the old copy goes.
   */
  const legacy = new Map<string, SaveMeta>();
  const saveIndex = (ls: Store): void => {
    try {
      if (legacy.size) ls.setItem(LS_INDEX, JSON.stringify(Object.fromEntries(legacy)));
      else ls.removeItem(LS_INDEX);
    } catch { /* ignore */ }
  };
  function dropLegacy(id: string): void {
    const ls = local();
    if (!ls || !legacy.delete(id)) return;
    try { ls.removeItem(lsKey(id)); } catch { /* it stays; the newer copy in IndexedDB shadows it */ }
    saveIndex(ls);
  }

  /**
   * Move what the old localStorage store held into IndexedDB; each entry leaves localStorage only after its copy is stored. One that is
   * already in IndexedDB is dropped only if that copy is at least as new as the old one; a newer, never-copied save is copied over it.
   */
  async function migrate(): Promise<void> {
    const ls = local();
    if (!ls) return;
    let index: Record<string, SaveMeta> = {};
    try {
      const raw = ls.getItem(LS_INDEX);
      index = raw ? (JSON.parse(raw) as Record<string, SaveMeta>) ?? {} : {};
    } catch { /* an unreadable index only loses the labels */ }
    for (const id of [...LISTED, BROKEN_ID]) {
      let json: string | null = null;
      try { json = ls.getItem(lsKey(id)); } catch { /* blocked storage: nothing to move */ }
      if (json === null) continue;
      const old = index[id] ?? label(id);
      const there = metas.get(id);
      const moved = there && there.savedAt >= old.savedAt ? true : await put(old, json);
      if (moved) {
        try { ls.removeItem(lsKey(id)); } catch { /* it stays; the copy in IndexedDB wins next time */ }
      } else {
        legacy.set(id, old);
      }
    }
    // The index goes only when every save it labels has moved; the labels of the ones that stayed are kept for the next start.
    saveIndex(ls);
  }

  function put(meta: SaveMeta, json: string, shift: readonly string[] = [], due?: (current: SaveMeta | undefined) => boolean): Promise<boolean> {
    if (!db) return Promise.resolve(false);
    try {
      const tx = db.transaction([META, DATA], 'readwrite');
      const m = tx.objectStore(META);
      const d = tx.objectStore(DATA);
      const cur = metas.get(meta.id);
      const moving = shift.length > 0 && (!due || due(cur));
      const chain = moving ? shift : [meta.id];
      if (shift.length) meta = { ...meta, since: moving || !cur ? meta.savedAt : (cur.since ?? cur.savedAt) };
      const moved: Array<[string, SaveMeta]> = [];
      // Queue the reads of the old entries before this write, so they see the old values; the copies go in once they are read.
      for (let i = chain.length - 1; i > 0; i--) {
        const from = chain[i - 1]!;
        const to = chain[i]!;
        const old = metas.get(from);
        if (!old) continue;
        moved.push([to, { ...old, id: to }]);
        const rd = d.get(from);
        rd.onsuccess = () => {
          if (rd.result === undefined) return;
          d.put(rd.result, to);
          m.put({ ...old, id: to }, to);
        };
      }
      m.put(meta, meta.id);
      d.put(json, meta.id);
      return done(tx).then((ok) => {
        if (ok) {
          for (const [to, mm] of moved) metas.set(to, mm);
          metas.set(meta.id, meta);
          for (const id of [meta.id, ...moved.map(([to]) => to)]) dropLegacy(id);
        }
        return ok;
      });
    } catch {
      return Promise.resolve(false);
    }
  }

  return {
    ready() {
      opening ??= open().then(loadMetas).then(migrate);
      return opening;
    },
    list: () => LISTED.filter((id) => legacy.has(id) || metas.has(id)).map((id) => legacy.get(id) ?? metas.get(id) ?? label(id)),
    read(id) {
      if (legacy.has(id)) {
        try { return Promise.resolve(local()?.getItem(lsKey(id)) ?? null); } catch { return Promise.resolve(null); }
      }
      return new Promise((res) => {
        if (!db) return res(null);
        try {
          const req = db.transaction(DATA, 'readonly').objectStore(DATA).get(id);
          req.onsuccess = () => res(typeof req.result === 'string' ? req.result : null);
          req.onerror = () => res(null);
        } catch {
          res(null);
        }
      });
    },
    write: (meta, json, shift, due) => enqueue(() => put(meta, json, shift, due)),
    remove: (id) => enqueue(() => drop(id)),
  };

  function drop(id: string): Promise<boolean> {
      if (!db) {
        const had = legacy.has(id);
        dropLegacy(id);
        return Promise.resolve(had);
      }
      try {
        const tx = db.transaction([META, DATA], 'readwrite');
        tx.objectStore(META).delete(id);
        tx.objectStore(DATA).delete(id);
        return done(tx).then((ok) => {
          if (ok) {
            metas.delete(id);
            dropLegacy(id);
          }
          return ok;
        });
      } catch {
        return Promise.resolve(false);
      }
  }
}

const browserStorage = (): Store | null => {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
};
const browserIdb = (): IDBFactory | null => (typeof indexedDB === 'undefined' ? null : indexedDB);

let current: SaveStore = createIdbSaveStore(browserIdb, browserStorage);
/** Swap the backing store (tests). */
export function setSaveStore(s: SaveStore): void {
  current = s;
}
/** The browser's saves. */
export const saveStore: SaveStore = {
  ready: () => current.ready(),
  list: () => current.list(),
  read: (id) => current.read(id),
  write: (meta, json, shift, due) => current.write(meta, json, shift, due),
  remove: (id) => current.remove(id),
};
