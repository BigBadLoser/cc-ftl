import { afterEach, describe, expect, it, vi } from 'vitest';
import { content } from '../content';
import { deserialize, homeShip, newGame, SAVE_VERSION, serialize, ShipC } from '../sim';
import { DeadC } from '../sim/crew/components';
import { playerCrew } from '../sim/story/world';
import { createSaver, incompatibleSaves, lostReason, ROTATE_MS, startGame, unloadableNotice, writeAutosave, writePrecombat, writeSave } from './saves';
import { saveStore } from './saveStore';

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

/** A minimal in-memory Storage; `failWrites` makes setItem throw like a full or blocked store. */
function fakeStorage(failWrites = { on: false }): Storage {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; },
    clear: () => m.clear(),
    getItem: (k: string) => m.get(k) ?? null,
    key: (i: number) => [...m.keys()][i] ?? null,
    removeItem: (k: string) => { m.delete(k); },
    setItem: (k: string, v: string) => {
      if (failWrites.on) throw new DOMException('full', 'QuotaExceededError');
      m.set(k, v);
    },
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('seeded debug sessions', () => {
  it('never overwrite the saved campaign, on a periodic save or a tab-hide save', () => {
    const local = fakeStorage();
    vi.stubGlobal('localStorage', local);
    vi.stubGlobal('sessionStorage', fakeStorage());
    writeSave(newGame(1, content));
    const campaign = local.getItem('cc.save');
    expect(campaign).not.toBeNull();

    const start = startGame('12345');
    expect(start.persist).toBe(false);
    const save = createSaver(start.sim, start.persist, () => false, () => undefined);
    save(); // the autosave timer
    save(); // visibilitychange: hidden / pagehide use the same function
    expect(local.getItem('cc.save')).toBe(campaign);
  });

  it('a normal session still saves', () => {
    const local = fakeStorage();
    vi.stubGlobal('localStorage', local);
    vi.stubGlobal('sessionStorage', fakeStorage());
    const start = startGame(null);
    expect(start.persist).toBe(true);
    createSaver(start.sim, start.persist, () => false, () => undefined)();
    expect(local.getItem('cc.save')).not.toBeNull();
  });
});

describe('save failures and recovery', () => {
  it('reports a refused write, keeps the previous save, and recovers when storage works again', () => {
    const switchF = { on: false };
    const local = fakeStorage(switchF);
    vi.stubGlobal('localStorage', local);
    vi.stubGlobal('sessionStorage', fakeStorage());
    const sim = newGame(3, content);
    const results: boolean[] = [];
    const save = createSaver(sim, true, () => false, (ok) => results.push(ok));
    save();
    const good = local.getItem('cc.save');
    sim.tick = 99;
    switchF.on = true;
    save();
    expect(results).toEqual([true, false]);
    expect(local.getItem('cc.save')).toBe(good);
    expect(startGame(null).sim.tick).toBe(0); // the last good save still loads
    switchF.on = false;
    save();
    expect(results).toEqual([true, false, true]);
    expect(startGame(null).sim.tick).toBe(99);
  });

  it('keeps a corrupted save instead of deleting it, and says it is damaged', () => {
    const local = fakeStorage();
    vi.stubGlobal('localStorage', local);
    vi.stubGlobal('sessionStorage', fakeStorage());
    local.setItem('cc.save', '{"version": 68, "trunc');
    const start = startGame(null);
    expect(start.notice).toMatch(/damaged/);
    expect(local.getItem('cc.save')).toBeNull();
    expect(local.getItem('cc.save.broken')).toBe('{"version": 68, "trunc');
  });

  it('keeps a save of another version and says so', () => {
    const local = fakeStorage();
    vi.stubGlobal('localStorage', local);
    vi.stubGlobal('sessionStorage', fakeStorage());
    const old = JSON.stringify({ ...JSON.parse(serialize(newGame(1, content))), version: 1 });
    local.setItem('cc.save', old);
    const start = startGame(null);
    expect(start.notice).toMatch(/another version/);
    expect(local.getItem('cc.save.broken')).toBe(old);
  });

  it('round-trips a save with many archived sectors', () => {
    const sim = newGame(5, content);
    const base = sim.archives[0] ?? { node: 'n', tick: 1, width: 8, height: 8, grid: sim.sector.grid.serialize(), entities: [] };
    for (let i = 0; i < 60; i++) sim.archives.push({ ...base, node: `n${i}`, tick: i });
    const back = deserialize(serialize(sim), content);
    expect(back.archives.map((a) => a.node)).toEqual(sim.archives.map((a) => a.node));
  });

  it('loads a picked slot; an unloadable one is kept and the autosave plays instead', () => {
    const local = fakeStorage();
    const session = fakeStorage();
    vi.stubGlobal('localStorage', local);
    vi.stubGlobal('sessionStorage', session);
    const a = newGame(3, content);
    a.tick = 42;
    writeSave(a, 'slot1', 'Mine');
    writeSave(newGame(3, content));
    session.setItem('cc.loadSlot', 'slot1');
    expect(startGame(null).sim.tick).toBe(42);
    expect(session.getItem('cc.loadSlot')).toBeNull();
    local.setItem('cc.save.slot2', '{"trunc');
    session.setItem('cc.loadSlot', 'slot2');
    const start = startGame(null);
    expect(start.sim.tick).toBe(0);
    expect(start.notice).toMatch(/could not be loaded/);
    expect(saveStore.read('slot2')).toBe('{"trunc');
  });
});

describe('rotating autosaves and the pre-combat snapshot', () => {
  const setup = () => {
    vi.stubGlobal('localStorage', fakeStorage());
    vi.stubGlobal('sessionStorage', fakeStorage());
    return newGame(5, content);
  };
  const ids = () => saveStore.list().map((m) => m.id);

  it('overwrites a young autosave in place, and pushes it down the chain once it is old', () => {
    const sim = setup();
    const t0 = 1_000_000;
    writeAutosave(sim, t0);
    writeAutosave(sim, t0 + 30_000);
    expect(ids()).toEqual(['auto']);
    sim.tick = 100;
    writeAutosave(sim, t0 + ROTATE_MS + 30_000);
    expect(ids()).toEqual(['auto', 'auto2']);
    expect(deserialize(saveStore.read('auto2')!, content).tick).toBe(0);
    expect(deserialize(saveStore.read('auto')!, content).tick).toBe(100);
    sim.tick = 200;
    writeAutosave(sim, t0 + 2 * ROTATE_MS + 60_000);
    sim.tick = 300;
    writeAutosave(sim, t0 + 3 * ROTATE_MS + 90_000);
    sim.tick = 400;
    writeAutosave(sim, t0 + 4 * ROTATE_MS + 120_000);
    expect(ids()).toEqual(['auto', 'auto2', 'auto3']); // three at most
    expect([...['auto', 'auto2', 'auto3']].map((id) => deserialize(saveStore.read(id)!, content).tick)).toEqual([400, 300, 200]);
  });

  it('does not rotate during a fight, so the older autosaves stay calm ones', () => {
    const sim = setup();
    writeAutosave(sim, 1_000_000);
    sim.sector.inCombat = true;
    sim.tick = 50;
    writeAutosave(sim, 1_000_000 + 2 * ROTATE_MS);
    expect(ids()).toEqual(['auto']);
    expect(saveStore.list()[0]!.fight).toBe(true);
  });

  it('keeps one pre-combat snapshot, listed after the autosaves and labelled', () => {
    const sim = setup();
    writeAutosave(sim);
    expect(writePrecombat(sim)).toBe(true);
    writePrecombat(sim);
    expect(saveStore.list().map((m) => [m.id, m.name])).toEqual([['auto', 'Autosave'], ['precombat', 'Before combat']]);
  });

  it('survives the Load flow: a rotated autosave loads by id', () => {
    const sim = setup();
    writeAutosave(sim, 1_000_000);
    writeAutosave(sim, 1_000_000 + ROTATE_MS);
    sessionStorage.setItem('cc.loadSlot', 'auto2');
    const start = startGame(null);
    expect(start.notice).toBeNull();
    expect(serialize(start.sim)).toBe(saveStore.read('auto2'));
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
