import { IDBDatabase, IDBFactory } from 'fake-indexeddb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { content } from '../content';
import { deserialize, homeShip, newGame, SAVE_VERSION, serialize, ShipC } from '../sim';
import { DeadC } from '../sim/crew/components';
import { playerCrew } from '../sim/story/world';
import { createSaver, incompatibleSaves, lostReason, ROTATE_MS, startGame, unloadableNotice, writeAutosave, writePrecombat, writeSave } from './saves';
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
