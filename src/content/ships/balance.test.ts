import { describe, expect, it } from 'vitest';
import {
  CrewC, DeadC, DownedC, ModuleC, PositionC, newGame, shipOf, type Sim, type SimEvent,
} from '../../sim';
import { content } from '../index';

const TPS = 20;

interface Result {
  /** Seconds until the first player crew member went down (Infinity if none did). */
  firstDownSec: number;
  /** Player crew down or dead after 2 and 4 minutes. */
  downAt2: number;
  downAt4: number;
  deadAt4: number;
  /** Lowest player ship integrity seen, and its value at the 6 minute mark (or the end). */
  minIntegrity: number;
  /** Player modules destroyed during the fight. */
  destroyed: number;
  winner: 'player' | 'raider' | 'none';
  /** Seconds the fight lasted (up to the cap). */
  seconds: number;
}

const playerCrew = (sim: Sim): number[] => sim.world.query(CrewC).filter((i) => sim.world.get(i, PositionC)?.gridId === 1);
const downCount = (sim: Sim, dead = false): number =>
  playerCrew(sim).filter((i) => sim.world.has(i, DeadC) || (!dead && sim.world.has(i, DownedC))).length;

/**
 * Starter vs raider with a fixed seed. 'manned': the crew keep their default jobs and the player keeps the
 * weapons on a living raider reactor (retargeting every 5 s). 'unmanned': no one is allowed to operate a console, so
 * nothing of the player's fires, and the shield and helm do not help.
 */
function fight(seed: number, mode: 'manned' | 'unmanned', minutes: number): Result {
  const sim = newGame(seed, content);
  if (mode === 'unmanned') {
    for (const id of sim.world.query(CrewC)) sim.enqueue({ type: 'crew.setPriority', id, category: 'operating', value: 0 });
  }
  sim.enqueue({ type: 'debug.spawnEnemy', template: 'ship.raider', x: 100, y: 50 });
  const r: Result = {
    firstDownSec: Infinity, downAt2: 0, downAt4: 0, deadAt4: 0, minIntegrity: 1, destroyed: 0, winner: 'none', seconds: minutes * 60,
  };
  const raiderReactor = (): number =>
    sim.world.query(ModuleC).find((i) => {
      const m = sim.world.get(i, ModuleC)!;
      return m.gridId === 2 && m.def === 'module.reactor' && m.hp > 0;
    }) ?? 0;
  for (let t = 0; t < minutes * 60 * TPS; t++) {
    if (mode === 'manned' && t % 100 === 1) {
      sim.enqueue({ type: 'combat.setTarget', shipGridId: 1, weaponId: null, targetGridId: 2, targetModuleId: raiderReactor() });
    }
    sim.step();
    const events: SimEvent[] = sim.events.drain();
    for (const e of events) {
      if (e.type === 'module.destroyed' && e.gridId === 1) r.destroyed++;
      if (e.type === 'crew.downed' && sim.world.get(e.crew, PositionC)?.gridId === 1) r.firstDownSec = Math.min(r.firstDownSec, t / TPS);
    }
    r.minIntegrity = Math.min(r.minIntegrity, shipOf(sim, 1)?.integrity ?? 1);
    if (t === 2 * 60 * TPS) r.downAt2 = downCount(sim);
    if (t === 4 * 60 * TPS) { r.downAt4 = downCount(sim); r.deadAt4 = downCount(sim, true); }
    if (!sim.sector.inCombat) {
      r.seconds = t / TPS;
      r.winner = shipOf(sim, 2)?.state === 'active' ? 'raider' : 'player';
      break;
    }
  }
  return r;
}

describe('starter vs raider balance (fixed seeds)', { timeout: 120000 }, () => {
  const seeds = [1, 2, 3];

  it('a manned ship beats the raider, taking some damage but losing no one', () => {
    const results = seeds.map((s) => fight(s, 'manned', 8));
    for (const r of results) {
      expect(r.winner).toBe('player');
      expect(r.seconds).toBeGreaterThan(60); // not a walkover
      expect(r.seconds).toBeLessThan(6 * 60);
      expect(r.minIntegrity).toBeLessThan(0.96); // some damage
      expect(r.minIntegrity).toBeGreaterThan(0.6);
      expect(r.deadAt4).toBe(0);
      expect(r.downAt4).toBeLessThanOrEqual(2);
    }
  });

  it('an unmanned ship takes serious hull and system damage over several minutes but loses no crew in 4 minutes', () => {
    const results = seeds.map((s) => fight(s, 'unmanned', 6));
    for (const r of results) {
      expect(r.winner).not.toBe('player'); // it cannot shoot back
      expect(r.firstDownSec).toBeGreaterThanOrEqual(30);
      expect(r.deadAt4).toBe(0);
      expect(r.downAt4).toBeLessThanOrEqual(3);
      expect(r.minIntegrity).toBeLessThan(0.9);
      expect(r.destroyed).toBeGreaterThanOrEqual(20);
    }
  });

  it('is deterministic', () => {
    expect(fight(2, 'manned', 3)).toEqual(fight(2, 'manned', 3));
  });
});
