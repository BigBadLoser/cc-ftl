import { describe, expect, it } from 'vitest';
import { CrewC, DeadC, DownedC, PositionC, newGame, type SimEvent } from '../../sim';
import { content } from '../index';
import { shipIdOf, shipIds } from '../../sim/regions';
import { shipById } from '../../sim/combat/ships';

const TPS = 20;
const CRITICAL = ['module.reactor', 'module.lifeSupport', 'module.shieldGen', 'module.engine'];

interface Pace { seconds: number; winner: 'player' | 'raider' | 'none'; down: number; dead: number; critical: number }

/** Starter ship vs one raider, default crew behaviour, default targeting (the player gives no orders). */
function paceFight(seed: number, maxMinutes = 12): Pace {
  const sim = newGame(seed, content);
  sim.enqueue({ type: 'debug.spawnEnemy', template: 'ship.raider', x: 100, y: 50 });
  const mine = shipIds(sim)[0] as number;
  sim.step();
  // What the combat panel does on its own when a hostile appears: the whole ship is the target.
  sim.enqueue({ type: 'combat.setTarget', ship: mine, weaponId: null, targetShip: shipIds(sim)[1] as number, targetModuleId: 0 });
  const critical = new Set<number>();
  let seconds = maxMinutes * 60;
  let winner: Pace['winner'] = 'none';
  for (let t = 0; t < maxMinutes * 60 * TPS; t++) {
    sim.step();
    for (const e of sim.events.drain() as SimEvent[]) {
      if (e.type === 'module.destroyed' && e.ship === mine && CRITICAL.includes(e.def)) critical.add(e.moduleId);
    }
    if (t > 5 && !sim.sector.inCombat) {
      seconds = t / TPS;
      winner = shipById(sim, shipIds(sim)[1] as number)?.state === 'active' ? 'raider' : 'player';
      break;
    }
  }
  const crew = sim.world.query(CrewC).filter((i) => shipIdOf(sim, sim.world.get(i, PositionC)) === mine);
  return {
    seconds, winner, critical: critical.size,
    down: crew.filter((i) => sim.world.has(i, DownedC) || sim.world.has(i, DeadC)).length,
    dead: crew.filter((i) => sim.world.has(i, DeadC)).length,
  };
}

describe('starter vs raider pace (the player gives no orders, the panel aims at the whole ship)', { timeout: 300000 }, () => {
  // Seeds 1 to 8 as first measured; seeds 9 to 16 were run once as a holdout when the charge times were set (see #168).
  const seeds = Array.from({ length: 16 }, (_, i) => i + 1);

  // The user's decision: this test plays with no orders at all, so an occasional loss is acceptable ("bad play should result in a loss").
  // So the bar is aggregate over 16 seeds instead of every seed winning.
  it('mostly wins, a typical fight inside the 3 minutes the design asks for, and costs little crew', () => {
    const results = seeds.map((s) => paceFight(s));
    const wins = results.filter((r) => r.winner === 'player');
    expect(wins.length).toBeGreaterThanOrEqual(14);
    expect(wins.reduce((n, r) => n + r.dead, 0)).toBeLessThanOrEqual(2); // was 1 to 3 crew dead on most seeds
    const sorted = results.map((r) => r.seconds).sort((x, y) => x - y);
    expect(((sorted[7] as number) + (sorted[8] as number)) / 2).toBeLessThan(3 * 60);
  });

  it('is deterministic', () => {
    expect(paceFight(2, 4)).toEqual(paceFight(2, 4));
  });
});
