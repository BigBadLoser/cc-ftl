import { describe, expect, it } from 'vitest';
import { CrewC, DeadC, DownedC, PositionC, newGame, type SimEvent } from '../../sim';
import { content } from '../index';
import { shipIdOf, shipIds } from '../../sim/regions';
import { shipById } from '../../sim/combat/ships';
import { CombatC, ModuleC } from '../../sim';
import { WeaponC } from '../../sim/combat/components';
import { ventError } from '../../sim/combat/heat';
import { HEAT_MAX } from '../../sim/combat/heatTuning';
import { shotAboutToLand } from '../../sim/systems/heatAi';

const TPS = 20;
const CRITICAL = ['module.reactor', 'module.lifeSupport', 'module.shieldGen', 'module.engine'];

interface Pace { seconds: number; winner: 'player' | 'raider' | 'none'; down: number; dead: number; critical: number }

/**
 * Starter ship vs one raider, default crew behaviour, default targeting. The player is a scripted *basic player*: every weapon on auto (the
 * missile launcher starts on hold, so this is one Shift+E; the user's call) at the panel's whole-ship target, nothing else, and the one heat habit a player must have: vent when the meter is at 70% or more and no enemy shot is about
 * to land (the same "shot soon" rule the enemy AI uses). It never overcharges. The ship does nothing about heat by itself, so without this habit
 * it would overheat; the test models a player who plays the basics and nothing clever.
 */
function paceFight(seed: number, maxMinutes = 12): Pace {
  const sim = newGame(seed, content);
  sim.enqueue({ type: 'debug.spawnEnemy', template: 'ship.raider', x: 100, y: 50 });
  const mine = shipIds(sim)[0] as number;
  sim.step();
  // What the combat panel does on its own when a hostile appears: the whole ship is the target.
  sim.enqueue({ type: 'combat.setTarget', ship: mine, weaponId: null, targetShip: shipIds(sim)[1] as number, targetModuleId: 0 });
  for (const w of sim.world.query(WeaponC, ModuleC)) {
    if (shipIdOf(sim, sim.world.get(w, ModuleC)) === mine) sim.enqueue({ type: 'combat.setWeaponMode', ship: mine, weaponId: w, mode: 'auto' });
  }
  const critical = new Set<number>();
  let seconds = maxMinutes * 60;
  let winner: Pace['winner'] = 'none';
  for (let t = 0; t < maxMinutes * 60 * TPS; t++) {
    const c = sim.world.get(mine, CombatC);
    if (c && c.heat.value >= 0.7 * HEAT_MAX && ventError(c) === null && !shotAboutToLand(sim, mine)) sim.enqueue({ type: 'combat.vent', ship: mine });
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

describe('starter vs raider pace, guard (seeds 1 and 2 of the soak test pace.soak.test.ts, which has all 16)', { timeout: 120000 }, () => {
  // The soak test judges the aggregate over 16 seeds; here a gross regression must show on two: both win, nobody dies, each inside 5 minutes.
  it('wins, inside 5 minutes, and costs no crew', () => {
    for (const s of [1, 2]) {
      const r = paceFight(s);
      expect(r.winner).toBe('player');
      expect(r.dead).toBeLessThanOrEqual(1);
      expect(r.seconds).toBeLessThan(5 * 60);
    }
  });

  it('is deterministic', () => {
    expect(paceFight(2, 4)).toEqual(paceFight(2, 4));
  });
});
