import { afterEach, describe, expect, it, vi } from 'vitest';
import { content } from '../content';
import { deserialize, homeShip, newGame, serialize, ShipC } from '../sim';
import { DeadC } from '../sim/crew/components';
import { playerCrew } from '../sim/story/world';
import { createSaver, lostReason, startGame, writeSave } from './saves';

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
});
