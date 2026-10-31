import { describe, expect, it } from 'vitest';
import { CrewC, ModuleC, PositionC, ShipC, newGame, type ModuleDef, type Sim, type SimEvent } from '../../sim';
import { SurrenderedC } from '../../sim/fight/components';
import { shipIdOf, shipIds } from '../../sim/regions';
import { HOPELESS_HULL, WRECK_BELOW } from '../../sim/tuning';
import { content } from '../index';

/**
 * Stuck fights (issue #225), part 2: a hostile ship whose fight is hopeless (hull failing, weapons dead, crew cut off or outnumbered)
 * surrenders through the ordinary surrender path, and is then given up.
 */
function crippled(opts: { weaponsAlive?: boolean } = {}): { sim: Sim; them: number } {
  const sim = newGame(1, content);
  sim.galaxy.fleets = [];
  sim.enqueue({ type: 'debug.spawnEnemy', template: 'ship.raider', x: 100, y: 50 });
  sim.step();
  const them = shipIds(sim)[1]!;
  for (const id of sim.world.query(ModuleC)) {
    const m = sim.world.get(id, ModuleC)!;
    const def = (content.modules as Record<string, ModuleDef>)[m.def]!;
    if (shipIdOf(sim, m) !== them || def.power > 0) continue; // keep its reactor: a dead reactor wrecks the ship outright
    if (def.weapon) m.hp = opts.weaponsAlive ? def.maxHp : 0;
    else m.hp = Math.round(def.maxHp * 0.3);
  }
  return { sim, them };
}

const enemyCrew = (sim: Sim, ship: number): number[] =>
  sim.world.query(CrewC, PositionC).filter((id) => shipIdOf(sim, sim.world.get(id, PositionC)) === ship);

function run(sim: Sim, ticks: number): SimEvent[] {
  const out: SimEvent[] = [];
  for (let i = 0; i < ticks; i++) {
    sim.step();
    out.push(...sim.events.drain());
  }
  return out;
}

describe('hopeless enemies surrender (issue #225)', () => {
  it('the crippled set-up stays above the wreck line (with its guns alive, nothing gives it up)', () => {
    const { sim, them } = crippled({ weaponsAlive: true });
    run(sim, 40);
    const s = sim.world.get(them, ShipC)!;
    expect(s.state).not.toBe('wreck');
    expect(s.integrity).toBeGreaterThan(WRECK_BELOW); // well above the wreck line: when it gives up below, it was not shot apart
  });

  it('a disarmed, crippled ship whose crew cannot reach the player gives up: every crew member surrenders and the ship is given up', () => {
    const { sim, them } = crippled();
    const crew = enemyCrew(sim, them);
    expect(crew.length).toBeGreaterThan(0);
    let at = -1;
    const events: SimEvent[] = [];
    for (let i = 0; i < 40 && at < 0; i++) {
      sim.step();
      const now = sim.events.drain();
      events.push(...now);
      if (now.some((e) => e.type === 'ship.surrendered' && e.ship === them)) at = sim.world.get(them, ShipC)!.integrity;
    }
    expect(at).toBeGreaterThanOrEqual(0); // it surrendered (the same pass then gives the hulk up, which sets the wreck's integrity)
    events.push(...run(sim, 20));
    const s = sim.world.get(them, ShipC)!;
    for (const id of crew) expect(sim.world.has(id, SurrenderedC)).toBe(true);
    expect(s.state).toBe('wreck'); // every crew member subdued and no player crew to take it: given up as a derelict
  });

  it('fights on while its guns still work', () => {
    const { sim, them } = crippled({ weaponsAlive: true });
    const events = run(sim, 40);
    expect(events.some((e) => e.type === 'ship.surrendered')).toBe(false);
    expect(enemyCrew(sim, them).some((id) => sim.world.has(id, SurrenderedC))).toBe(false);
  });

  it('a healthy ship with dead guns fights on (the hull is not failing)', () => {
    const { sim, them } = crippled();
    for (const id of sim.world.query(ModuleC)) {
      const m = sim.world.get(id, ModuleC)!;
      const def = (content.modules as Record<string, ModuleDef>)[m.def]!;
      if (shipIdOf(sim, m) === them && !def.weapon) m.hp = def.maxHp;
    }
    const events = run(sim, 40);
    expect(sim.world.get(them, ShipC)!.integrity).toBeGreaterThanOrEqual(HOPELESS_HULL);
    expect(events.some((e) => e.type === 'ship.surrendered')).toBe(false);
  });
});
