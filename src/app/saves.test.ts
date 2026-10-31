import { IDBDatabase, IDBFactory } from 'fake-indexeddb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { content } from '../content';
import { deserialize, homeShip, newGame, SAVE_VERSION, serialize, ShipC } from '../sim';
import { DeadC } from '../sim/crew/components';
import { playerCrew } from '../sim/story/world';
import { createSaver, inThisCampaign, incompatibleSaves, restartNewGame, lostReason, ROTATE_MS, startGame, unloadableNotice, writeAutosave, writePrecombat, writeSave } from './saves';
import { createIdbSaveStore, saveStore, setSaveStore } from './saveStore';

describe('game over', () => {
  it('is not lost at the start, and is lost when the ship is wrecked or the crew is all dead', () => {
    const sim = newGame(7, content);
    expect(lostReason(sim)).toBeNull();
    const ship = sim.world.get(homeShip(sim), ShipC)!;
    ship.state = 'wreck';
    expect(lostReason(sim)).toMatch(/destroyed/);
    ship.state = 'active';
    for (const id of playerCrew(sim)) sim.world.add(id, DeadC, { tick: sim.tick });
    expect(lostReason(sim)).toMatch(/crew/);
  });

  it('is never called lost in hyperspace, where the ship and crew are packed away', () => {
    const sim = newGame(7, content);
    sim.sector.state = 'hyperspace';
    for (const id of playerCrew(sim)) sim.world.add(id, DeadC, { tick: sim.tick });
    expect(lostReason(sim)).toBeNull();
  });
});

/** A minimal in-memory Storage (the old saves' home, and the session flags). */
function fakeStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; },
    clear: () => m.clear(),
    getItem: (k: string) => m.get(k) ?? null,
    key: (i: number) => [...m.keys()][i] ?? null,
    removeItem: (k: string) => { m.delete(k); },
    setItem: (k: string, v: string) => { m.set(k, v); },
  };
}

/** A clean browser: empty localStorage and sessionStorage, a fresh IndexedDB behind the save store. */
function browser() {
  const local = fakeStorage();
  const session = fakeStorage();
  vi.stubGlobal('localStorage', local);
  vi.stubGlobal('sessionStorage', session);
  setSaveStore(createIdbSaveStore(() => new IDBFactory(), () => local));
  return { local, session };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('seeded debug sessions', () => {
  it('never overwrite the saved campaign, on a periodic save or a tab-hide save', async () => {
    browser();
    await saveStore.ready();
    await writeSave(newGame(1, content));
    const campaign = await saveStore.read('auto');
    expect(campaign).not.toBeNull();

    const start = await startGame('12345');
    expect(start.persist).toBe(false);
    const save = createSaver(start.sim, start.persist, () => false, () => undefined);
    save(); // the autosave timer
    save(); // visibilitychange: hidden / pagehide use the same function
    await new Promise((r) => setTimeout(r, 20));
    expect(await saveStore.read('auto')).toBe(campaign);
  });

  it('a normal session still saves', async () => {
    browser();
    const start = await startGame(null);
    expect(start.persist).toBe(true);
    const ok = new Promise<boolean>((res) => createSaver(start.sim, start.persist, () => false, res)());
    expect(await ok).toBe(true);
    expect(await saveStore.read('auto')).not.toBeNull();
  });
});

describe('debug sessions and the store', () => {
  it('a ?seed= game still opens the store, so Load and named slots work, and still never autosaves', async () => {
    browser();
    const start = await startGame('77');
    expect(start.persist).toBe(false);
    expect(await writeSave(start.sim, 'slot1', 'Mine')).toBe(true);
    expect(saveStore.list().map((m) => m.id)).toEqual(['slot1']);
    createSaver(start.sim, start.persist, () => false, () => undefined)();
    await new Promise((r) => setTimeout(r, 20));
    expect(await saveStore.read('auto')).toBeNull();
  });
});

describe('save failures and recovery', () => {
  /** Make IndexedDB refuse writes (a full disk, a blocked store) while `on.v` is true. */
  function refuseWrites(on: { v: boolean }) {
    const real = IDBDatabase.prototype.transaction;
    vi.spyOn(IDBDatabase.prototype, 'transaction').mockImplementation(function (this: IDBDatabase, ...a: Parameters<typeof real>) {
      if (on.v && a[1] === 'readwrite') throw new DOMException('full', 'QuotaExceededError');
      return real.apply(this, a);
    });
  }

  it('reports a refused write, keeps the previous save, and recovers when storage works again', async () => {
    browser();
    const off = { v: false };
    refuseWrites(off);
    await saveStore.ready();
    const sim = newGame(3, content);
    const results: boolean[] = [];
    const run = () => new Promise<void>((res) => createSaver(sim, true, () => false, (ok) => { results.push(ok); res(); })());
    await run();
    const good = await saveStore.read('auto');
    sim.tick = 99;
    off.v = true;
    await run();
    expect(results).toEqual([true, false]);
    expect(await saveStore.read('auto')).toBe(good);
    expect((await startGame(null)).sim.tick).toBe(0); // the last good save still loads
    off.v = false;
    await run();
    expect(results).toEqual([true, false, true]);
    expect((await startGame(null)).sim.tick).toBe(99);
  });

  it('reports a store that is not there at all (no IndexedDB)', async () => {
    const local = fakeStorage();
    vi.stubGlobal('localStorage', local);
    vi.stubGlobal('sessionStorage', fakeStorage());
    setSaveStore(createIdbSaveStore(() => null, () => local));
    await saveStore.ready();
    expect(await writeSave(newGame(3, content))).toBe(false);
    expect((await startGame(null)).sim.tick).toBe(0);
  });

  it('keeps a corrupted save instead of deleting it, and says it is damaged', async () => {
    const { local } = browser();
    local.setItem('cc.save', '{"version": 68, "trunc');
    const start = await startGame(null);
    expect(start.notice).toMatch(/damaged/);
    expect(await saveStore.read('auto')).toBeNull();
    expect(await saveStore.read('broken')).toBe('{"version": 68, "trunc');
  });

  it('keeps a save of another version and says so', async () => {
    const { local } = browser();
    const old = JSON.stringify({ ...JSON.parse(serialize(newGame(1, content))), version: 1 });
    local.setItem('cc.save', old);
    const start = await startGame(null);
    expect(start.notice).toMatch(/another version/);
    expect(await saveStore.read('broken')).toBe(old);
  });

  it('round-trips a save with many archived sectors', () => {
    const sim = newGame(5, content);
    const base = sim.archives[0] ?? { node: 'n', tick: 1, width: 8, height: 8, grid: sim.sector.grid.serialize(), entities: [] };
    for (let i = 0; i < 60; i++) sim.archives.push({ ...base, node: `n${i}`, tick: i });
    const back = deserialize(serialize(sim), content);
    expect(back.archives.map((a) => a.node)).toEqual(sim.archives.map((a) => a.node));
  });

  it('loads a picked slot; an unloadable one is kept and the autosave plays instead', async () => {
    const { local, session } = browser();
    await saveStore.ready();
    const a = newGame(3, content);
    a.tick = 42;
    await writeSave(a, 'slot1', 'Mine');
    await writeSave(newGame(3, content));
    session.setItem('cc.loadSlot', 'slot1');
    expect((await startGame(null)).sim.tick).toBe(42);
    expect(session.getItem('cc.loadSlot')).toBeNull();
    await saveStore.write({ id: 'slot2', name: 'Bad', savedAt: 1, turn: 0, node: '' }, '{"trunc');
    session.setItem('cc.loadSlot', 'slot2');
    const start = await startGame(null);
    expect(start.sim.tick).toBe(0);
    expect(start.notice).toMatch(/could not be loaded/);
    expect(await saveStore.read('slot2')).toBe('{"trunc');
    expect(local.getItem('cc.save')).toBeNull();
  });
});

describe('moving old localStorage saves into IndexedDB', () => {
  it('moves the autosave, the slots, their labels and a kept broken save, then empties localStorage; a second start changes nothing', async () => {
    const { local } = browser();
    const auto = serialize(newGame(2, content));
    local.setItem('cc.save', auto);
    local.setItem('cc.save.slot2', '{"s":2}');
    local.setItem('cc.save.broken', '{"b":1}');
    local.setItem('cc.saves', JSON.stringify({ slot2: { id: 'slot2', name: 'Mine', savedAt: 5, turn: 3, node: 'Ixion' } }));
    const start = await startGame(null);
    expect(start.notice).toBeNull();
    expect(serialize(start.sim)).toBe(auto);
    expect(saveStore.list().map((m) => [m.id, m.name, m.turn])).toEqual([['auto', 'Autosave', 0], ['slot2', 'Mine', 3]]);
    expect(await saveStore.read('slot2')).toBe('{"s":2}');
    expect(await saveStore.read('broken')).toBe('{"b":1}');
    for (const k of ['cc.save', 'cc.save.slot2', 'cc.save.broken', 'cc.saves']) expect(local.getItem(k)).toBeNull();
  });

  it('leaves old saves in localStorage when IndexedDB cannot store them', async () => {
    const local = fakeStorage();
    vi.stubGlobal('localStorage', local);
    vi.stubGlobal('sessionStorage', fakeStorage());
    local.setItem('cc.save', '{"x":1}');
    setSaveStore(createIdbSaveStore(() => null, () => local));
    await saveStore.ready();
    expect(local.getItem('cc.save')).toBe('{"x":1}');
  });
});

describe('migration when a copy fails', () => {
  it('keeps the label of a save that did not move, and moves it with its label on a later start', async () => {
    const local = fakeStorage();
    vi.stubGlobal('localStorage', local);
    vi.stubGlobal('sessionStorage', fakeStorage());
    local.setItem('cc.save', '{"a":1}');
    local.setItem('cc.save.slot1', '{"s":1}');
    local.setItem('cc.saves', JSON.stringify({
      auto: { id: 'auto', name: 'Autosave', savedAt: 9, turn: 4, node: 'A' },
      slot1: { id: 'slot1', name: 'Mine', savedAt: 5, turn: 3, node: 'Ixion' },
    }));
    const idb = new IDBFactory();
    // The slot's copy is refused (a write of its data fails), the autosave's goes through.
    const real = IDBDatabase.prototype.transaction;
    const spy = vi.spyOn(IDBDatabase.prototype, 'transaction').mockImplementation(function (this: IDBDatabase, ...a: Parameters<typeof real>) {
      const tx = real.apply(this, a);
      if (a[1] === 'readwrite' && Array.isArray(a[0])) {
        const st = tx.objectStore('data');
        const put = st.put.bind(st);
        st.put = ((v: unknown, k?: IDBValidKey) => { if (k === 'slot1') throw new DOMException('full', 'QuotaExceededError'); return put(v, k); }) as typeof st.put;
      }
      return tx;
    });
    setSaveStore(createIdbSaveStore(() => idb, () => local));
    await saveStore.ready();
    expect(saveStore.list().map((m) => m.id)).toEqual(['auto', 'slot1']); // the one that stayed is still listed (from its old label)
    expect(await saveStore.read('slot1')).toBe('{"s":1}'); // and read from localStorage
    expect(local.getItem('cc.save')).toBeNull();
    expect(local.getItem('cc.save.slot1')).toBe('{"s":1}');
    expect(Object.keys(JSON.parse(local.getItem('cc.saves')!))).toEqual(['slot1']); // its label stays

    spy.mockRestore();
    setSaveStore(createIdbSaveStore(() => idb, () => local));
    await saveStore.ready();
    expect(saveStore.list().map((m) => [m.id, m.name, m.turn, m.node])).toEqual([['auto', 'Autosave', 4, 'A'], ['slot1', 'Mine', 3, 'Ixion']]);
    expect(local.getItem('cc.saves')).toBeNull();
  });
});

describe('a legacy save that could not be copied stays first-class', () => {
  const refuse = (on: { v: boolean }) => {
    const real = IDBDatabase.prototype.transaction;
    vi.spyOn(IDBDatabase.prototype, 'transaction').mockImplementation(function (this: IDBDatabase, ...a: Parameters<typeof real>) {
      if (on.v && a[1] === 'readwrite') throw new DOMException('full', 'QuotaExceededError');
      return real.apply(this, a);
    });
  };
  const campaign = (tick: number) => { const s = newGame(4, content); s.tick = tick; return serialize(s); };

  it('loads the old campaign (not a fresh game), and a later good autosave leaves one correct save and no leftovers', async () => {
    const { local } = browser();
    const idb = new IDBFactory();
    setSaveStore(createIdbSaveStore(() => idb, () => local));
    const off = { v: true };
    refuse(off);
    local.setItem('cc.save', campaign(321));
    local.setItem('cc.saves', JSON.stringify({ auto: { id: 'auto', name: 'Autosave', savedAt: 9, turn: 6, node: 'Ixion' } }));
    const start = await startGame(null);
    expect(start.sim.tick).toBe(321);
    expect(start.notice).toBeNull();
    expect(saveStore.list().map((m) => [m.id, m.turn])).toEqual([['auto', 6]]);
    expect(local.getItem('cc.save')).not.toBeNull();

    off.v = false; // storage works again: the autosave of this same campaign
    start.sim.tick = 400;
    expect(await writeAutosave(start.sim)).toBe(true);
    expect(local.getItem('cc.save')).toBeNull();
    expect(local.getItem('cc.saves')).toBeNull();
    setSaveStore(createIdbSaveStore(() => idb, () => local));
    const again = await startGame(null);
    expect(again.sim.tick).toBe(400);
    expect(saveStore.list().map((m) => m.id)).toEqual(['auto']);
  });

  it('never deletes a newer, never-copied legacy save; an older one yields to what IndexedDB holds', async () => {
    const { local } = browser();
    const idb = new IDBFactory();
    const first = createIdbSaveStore(() => idb, () => null);
    await first.ready();
    await first.write({ id: 'auto', name: 'Autosave', savedAt: 5, turn: 1, node: 'x' }, 'in-idb');
    await first.write({ id: 'slot1', name: 'S', savedAt: 5, turn: 1, node: 'x' }, 'slot-in-idb');
    local.setItem('cc.save', 'legacy-newer');
    local.setItem('cc.save.slot1', 'legacy-older');
    local.setItem('cc.saves', JSON.stringify({ auto: { id: 'auto', name: 'Autosave', savedAt: 9, turn: 2, node: 'x' }, slot1: { id: 'slot1', name: 'S', savedAt: 1, turn: 1, node: 'x' } }));
    const off = { v: true };
    refuse(off);
    const st = createIdbSaveStore(() => idb, () => local);
    setSaveStore(st);
    await st.ready();
    expect(await st.read('auto')).toBe('legacy-newer'); // copy refused: the newer legacy save is what is read
    expect(local.getItem('cc.save')).toBe('legacy-newer'); // and it is still there
    expect(await st.read('slot1')).toBe('slot-in-idb'); // the older legacy save gave way
    expect(local.getItem('cc.save.slot1')).toBeNull();
    off.v = false;
    const later = createIdbSaveStore(() => idb, () => local);
    await later.ready(); // next start, storage fine: the newer one is copied over the older IndexedDB entry
    expect(await later.read('auto')).toBe('legacy-newer');
    expect(local.getItem('cc.save')).toBeNull();
  });
});

describe('falling back from an unloadable latest autosave', () => {
  it('loads the newest older autosave that works, and says so', async () => {
    const { local } = browser();
    await saveStore.ready();
    const sim = newGame(11, content);
    sim.tick = 77;
    await writeSave(sim, 'auto2', 'Autosave', Date.now() - 5 * 60_000);
    sim.tick = 33;
    await writeSave(sim, 'auto3', 'Autosave', Date.now() - 9 * 60_000);
    await saveStore.write({ id: 'auto', name: 'Autosave', savedAt: Date.now(), turn: 0, node: '', campaign: 11 }, '{"version": 71, "trunc');
    const start = await startGame(null);
    expect(start.sim.tick).toBe(77); // the newer of the two valid ones
    expect(start.sim.seed).toBe(11);
    expect(start.notice).toMatch(/latest autosave is damaged.*Loaded the autosave from 5 min ago/);
    expect(await saveStore.read('broken')).toBe('{"version": 71, "trunc');
    expect(local.getItem('cc.save')).toBeNull();
  });

  it("recovers only from the failed autosave's own campaign", async () => {
    browser();
    await saveStore.ready();
    const a = newGame(11, content);
    const b = newGame(22, content);
    b.tick = 8;
    await writeSave(a, 'auto2', 'Autosave', Date.now() - 2 * 60_000); // campaign A
    await saveStore.write({ id: 'auto', name: 'Autosave', savedAt: Date.now(), turn: 0, node: '', campaign: 22 }, 'garbage'); // B, corrupt
    const none = await startGame(null);
    expect(none.sim.seed).not.toBe(11); // not A's autosave
    expect(none.showAll).toBe(true);
    expect(saveStore.list().map((m) => m.id)).toEqual(['auto2']); // still listed to pick by hand

    await writeSave(b, 'auto3', 'Autosave', Date.now() - 9 * 60_000);
    await saveStore.write({ id: 'auto', name: 'Autosave', savedAt: Date.now(), turn: 0, node: '', campaign: 22 }, 'garbage');
    const yes = await startGame(null);
    expect(yes.sim.seed).toBe(22);
    expect(yes.sim.tick).toBe(8);
  });

  it('falls back to the pre-combat snapshot when it is all there is', async () => {
    browser();
    await saveStore.ready();
    const sim = newGame(11, content);
    sim.tick = 5;
    await writePrecombat(sim);
    await saveStore.write({ id: 'auto', name: 'Autosave', savedAt: Date.now(), turn: 0, node: '', campaign: 11 }, 'garbage');
    const start = await startGame(null);
    expect(start.sim.tick).toBe(5);
    expect(start.notice).toMatch(/from before combat/);
  });

  it('with nothing loadable it starts fresh and the failed campaign stays listed', async () => {
    browser();
    await saveStore.ready();
    await saveStore.write({ id: 'auto', name: 'Autosave', savedAt: 9, turn: 0, node: '', campaign: 11 }, 'garbage');
    await saveStore.write({ id: 'auto2', name: 'Autosave', savedAt: 8, turn: 0, node: '', campaign: 11 }, 'garbage2');
    const start = await startGame(null);
    expect(start.showAll).toBe(true);
    expect(start.notice).toMatch(/damaged/);
    expect(saveStore.list().map((m) => m.id)).toEqual(['auto2']); // auto is set aside as before; the older one is still there to see
    expect(inThisCampaign(start.sim, saveStore.list()[0]!)).toBe(false); // the campaign filter would hide it; showAll turns that off
  });
});

describe('campaigns', () => {
  it("another campaign's pre-combat snapshot and autosave history are not this game's", async () => {
    browser();
    await saveStore.ready();
    const a = newGame(11, content);
    const b = newGame(22, content);
    await writeAutosave(a, 1_000_000);
    await writePrecombat(a);
    const [auto, pre] = saveStore.list();
    expect(inThisCampaign(a, pre!)).toBe(true);
    expect(inThisCampaign(b, pre!)).toBe(false); // a new game (or a load of campaign B) is not offered A's "Before combat"
    expect(inThisCampaign(b, auto!)).toBe(true); // the newest autosave is always loadable
    expect(inThisCampaign(b, { id: 'auto2', campaign: 11 })).toBe(false);
    expect(inThisCampaign(b, { id: 'slot1', campaign: 11 })).toBe(true);
    expect(inThisCampaign(a, { id: 'precombat' })).toBe(false); // an older snapshot has no campaign
  });

  it('a new game clears the old autosaves and the snapshot', async () => {
    browser();
    vi.stubGlobal('location', { reload: vi.fn(), assign: vi.fn(), pathname: '/' });
    await saveStore.ready();
    const a = newGame(11, content);
    await writeAutosave(a, 1_000_000);
    await writeAutosave(a, 1_000_000 + ROTATE_MS);
    await writePrecombat(a);
    await writeSave(a, 'slot1', 'Mine');
    await restartNewGame();
    expect(saveStore.list().map((m) => m.id)).toEqual(['slot1']);
  });

  it("does not push another campaign's autosave into the history", async () => {
    browser();
    await saveStore.ready();
    await writeAutosave(newGame(11, content), 1_000_000);
    await writeAutosave(newGame(22, content), 1_000_000 + 2 * ROTATE_MS);
    expect(saveStore.list().map((m) => m.id)).toEqual(['auto']);
  });
});

describe('rotating autosaves and the pre-combat snapshot', () => {
  const setup = async () => {
    browser();
    await saveStore.ready();
    return newGame(5, content);
  };
  const ids = () => saveStore.list().map((m) => m.id);
  const tickOf = async (id: string) => deserialize((await saveStore.read(id))!, content).tick;

  it('overwrites a young autosave in place, and pushes it down the chain once it is old', async () => {
    const sim = await setup();
    const t0 = 1_000_000;
    await writeAutosave(sim, t0);
    await writeAutosave(sim, t0 + 30_000);
    expect(ids()).toEqual(['auto']);
    sim.tick = 100;
    await writeAutosave(sim, t0 + ROTATE_MS + 30_000);
    expect(ids()).toEqual(['auto', 'auto2']);
    expect(await tickOf('auto2')).toBe(0);
    expect(await tickOf('auto')).toBe(100);
    sim.tick = 200;
    await writeAutosave(sim, t0 + 2 * ROTATE_MS + 60_000);
    sim.tick = 300;
    await writeAutosave(sim, t0 + 3 * ROTATE_MS + 90_000);
    sim.tick = 400;
    await writeAutosave(sim, t0 + 4 * ROTATE_MS + 120_000);
    expect(ids()).toEqual(['auto', 'auto2', 'auto3']); // three at most
    expect([await tickOf('auto'), await tickOf('auto2'), await tickOf('auto3')]).toEqual([400, 300, 200]);
    expect(saveStore.list().map((m) => m.savedAt)).toEqual([t0 + 4 * ROTATE_MS + 120_000, t0 + 3 * ROTATE_MS + 90_000, t0 + 2 * ROTATE_MS + 60_000]);
  });

  it('two autosaves fired back to back rotate once, in order', async () => {
    const sim = await setup();
    await writeAutosave(sim, 1_000_000);
    sim.tick = 10;
    const a = writeAutosave(sim, 1_000_000 + ROTATE_MS);
    sim.tick = 20;
    const b = writeAutosave(sim, 1_000_000 + ROTATE_MS + 1_000); // fired before the first settled
    expect(await Promise.all([a, b])).toEqual([true, true]);
    expect(ids()).toEqual(['auto', 'auto2']); // one rotation, not two
    expect([await tickOf('auto'), await tickOf('auto2')]).toEqual([20, 0]); // auto2 is the one the single rotation pushed down
  });

  it('rotates in normal play: 30 s autosaves over seven minutes leave three autosaves about three minutes apart', async () => {
    const sim = await setup();
    const t0 = 1_000_000;
    for (let i = 0; i <= 14; i++) {
      sim.tick = i;
      await writeAutosave(sim, t0 + i * 30_000);
    }
    expect(ids()).toEqual(['auto', 'auto2', 'auto3']);
    // auto holds the last write (7:00); the heads of the older two were started 3:00 and 6:00 into the run and last written just before the next rotation
    expect([await tickOf('auto'), await tickOf('auto2'), await tickOf('auto3')]).toEqual([14, 11, 5]);
    const m = saveStore.list();
    expect(m.map((x) => x.since)).toEqual([t0 + 12 * 30_000, t0 + 6 * 30_000, t0]);
  });

  it('keeps combat saves out of the history: a fight past the deadline, then calm autosaves', async () => {
    const sim = await setup();
    const t0 = 1_000_000;
    sim.tick = 1;
    await writeAutosave(sim, t0); // calm
    sim.sector.inCombat = true;
    for (let i = 1; i <= 8; i++) { sim.tick = 100 + i; await writeAutosave(sim, t0 + i * 30_000); } // 4 min of fighting
    expect(ids()).toEqual(['auto']);
    sim.sector.inCombat = false;
    sim.tick = 200;
    await writeAutosave(sim, t0 + 9 * 30_000); // the head was a fight save: overwritten, not pushed down
    expect(ids()).toEqual(['auto']);
    expect(saveStore.list()[0]!.fight).toBe(false);
    sim.tick = 201;
    await writeAutosave(sim, t0 + 10 * 30_000); // now a calm head past its age: it moves
    expect(ids()).toEqual(['auto', 'auto2']);
    expect(await tickOf('auto2')).toBe(200);
    expect(saveStore.list().every((m) => !m.fight)).toBe(true);
  });

  it('does not rotate during a fight, so the older autosaves stay calm ones', async () => {
    const sim = await setup();
    await writeAutosave(sim, 1_000_000);
    sim.sector.inCombat = true;
    sim.tick = 50;
    await writeAutosave(sim, 1_000_000 + 2 * ROTATE_MS);
    expect(ids()).toEqual(['auto']);
    expect(saveStore.list()[0]!.fight).toBe(true);
  });

  it('keeps one pre-combat snapshot, listed after the autosaves and labelled', async () => {
    const sim = await setup();
    await writeAutosave(sim);
    expect(await writePrecombat(sim)).toBe(true);
    await writePrecombat(sim);
    expect(saveStore.list().map((m) => [m.id, m.name])).toEqual([['auto', 'Autosave'], ['precombat', 'Before combat']]);
  });

  it('a failed rotating write changes nothing, not even the chain', async () => {
    const sim = await setup();
    await writeAutosave(sim, 1_000_000);
    const before = await saveStore.read('auto');
    const real = IDBDatabase.prototype.transaction;
    vi.spyOn(IDBDatabase.prototype, 'transaction').mockImplementation(function (this: IDBDatabase, ...a: Parameters<typeof real>) {
      if (a[1] === 'readwrite') throw new DOMException('full', 'QuotaExceededError');
      return real.apply(this, a);
    });
    sim.tick = 7;
    expect(await writeAutosave(sim, 1_000_000 + ROTATE_MS)).toBe(false);
    expect(ids()).toEqual(['auto']);
    expect(await saveStore.read('auto')).toBe(before);
  });

  it('starts the write before returning, so a save in a pagehide handler is under way', async () => {
    const sim = await setup();
    const spy = vi.spyOn(IDBDatabase.prototype, 'transaction');
    const p = writeAutosave(sim);
    expect(spy).toHaveBeenCalledWith(['meta', 'data'], 'readwrite'); // before any await
    await p;
  });

  it('survives the Load flow: a rotated autosave loads by id', async () => {
    const sim = await setup();
    await writeAutosave(sim, 1_000_000);
    await writeAutosave(sim, 1_000_000 + ROTATE_MS);
    sessionStorage.setItem('cc.loadSlot', 'auto2');
    const start = await startGame(null);
    expect(start.notice).toBeNull();
    expect(serialize(start.sim)).toBe(await saveStore.read('auto2'));
  });
});

describe('version-bump notice', () => {
  const meta = (id: string, version?: number) => ({ id, name: id, savedAt: 1, turn: 1, node: 'x', version });
  it('counts saves of another version, and not ones with no version label', () => {
    expect(incompatibleSaves([meta('a', SAVE_VERSION), meta('b', SAVE_VERSION - 1), meta('c')]).map((m) => m.id)).toEqual(['b']);
  });
  it('names both versions and the other saves that cannot load either', () => {
    const e = new Error(`Save version ${SAVE_VERSION - 1} is not ${SAVE_VERSION}; old saves are not migrated`);
    const text = unloadableNotice(e, true, [meta('auto2', SAVE_VERSION - 1), meta('slot1', SAVE_VERSION - 1)]);
    expect(text).toContain(`v${SAVE_VERSION - 1}`);
    expect(text).toContain('2 other saves');
    expect(unloadableNotice(new Error('bad json'), false, [])).toContain('damaged');
  });
});
