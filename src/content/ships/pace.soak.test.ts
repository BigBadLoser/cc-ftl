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

describe('starter vs raider pace (a basic player: auto-fire at the whole ship, vents at 70% heat when safe, never overcharges)', { timeout: 300000 }, () => {
  // Seeds 1 to 8 as first measured; seeds 9 to 16 were run once as a holdout when the charge times were set (see #168).
  const seeds = Array.from({ length: 16 }, (_, i) => i + 1);

  // The user's decision: this test plays a basic player (it used to give no orders at all), so an occasional loss is acceptable ("bad play should result in a loss").
  // So the bar is aggregate over 16 seeds instead of every seed winning.
  it('mostly wins, a typical fight inside 3.5 minutes (the design asks for about 3; venting adds downtime), and costs little crew', () => {
    const results = seeds.map((s) => paceFight(s));
    const wins = results.filter((r) => r.winner === 'player');
    expect(wins.length).toBeGreaterThanOrEqual(14);
    expect(wins.reduce((n, r) => n + r.dead, 0)).toBeLessThanOrEqual(2); // was 1 to 3 crew dead on most seeds
    const sorted = results.map((r) => r.seconds).sort((x, y) => x - y);
    expect(((sorted[7] as number) + (sorted[8] as number)) / 2).toBeLessThan(3.5 * 60); // the user accepted 3.5 min (was 3) on 2026-10-29 because venting adds downtime
  });

  it('is deterministic', () => {
    expect(paceFight(2, 4)).toEqual(paceFight(2, 4));
  });
});
