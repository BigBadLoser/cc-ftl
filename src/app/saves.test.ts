import { afterEach, describe, expect, it, vi } from 'vitest';
import { content } from '../content';
import { homeShip, newGame, ShipC } from '../sim';
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
    const save = createSaver(start.sim, start.persist, () => false);
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
    createSaver(start.sim, start.persist, () => false)();
    expect(local.getItem('cc.save')).not.toBeNull();
  });
});
