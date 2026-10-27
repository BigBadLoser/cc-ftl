import { describe, expect, it } from 'vitest';
import {
  CombatC, FTL_CHARGE_SEC, ModuleC, START_NODE, applyOvercharge, galaxyIndex, homeShip, hullLoad, newGame, riskOf, shipGrid, type ModuleDef, type Sim, type SimEvent,
} from '../../sim';
import { giveItems } from '../../sim/story/effects';
import { content } from '../index';

const run = (sim: Sim, n: number): string[] => {
  const log: string[] = [];
  for (let i = 0; i < n; i++) {
    sim.step();
    for (const e of sim.events.drain() as SimEvent[]) log.push(e.type === 'command.rejected' ? `rejected:${e.command}:${e.reason}` : e.type);
  }
  return log;
};
const neighbour = (sim: Sim): string => {
  const e = (galaxyIndex(sim.galaxy).adjacent.get(START_NODE) ?? [])[0]!;
  return e.a === START_NODE ? e.b : e.a;
};
const enginesOf = (sim: Sim): number[] => sim.world.query(ModuleC).filter((m) => sim.content.modules[sim.world.get(m, ModuleC)!.def]?.engine);
/** The starter's size: 416 tiles inside its outer hull (a 28 x 18 ring). */
const STARTER_HULL = 416;
/** An overload scaled from the 88-tile profile these cases were first tuned on (even, so two engines split it). */
const over = (n: number): number => Math.round((n * STARTER_HULL) / 88 / 2) * 2;
/** A new game whose two engines carry `over` tiles (an even number) less than the starter's size, so the ship is over capacity by exactly that. */
function heavy(extra: number): Sim {
  const each = (STARTER_HULL - extra) / 2;
  const engine = content.modules['module.engine']!;
  const weak = { ...content, modules: { ...content.modules, 'module.engine': { ...engine, engine: { ...engine.engine!, hullCapacity: each } } } } as typeof content;
  const sim = newGame(3, weak);
  run(sim, 5);
  return sim;
}

describe('engine hull capacity', () => {
  it('the starter ship fits, and the readout is size against the engines', () => {
    const sim = newGame(3, content);
    const load = hullLoad(sim, homeShip(sim));
    expect(load.engines).toBe(2);
    expect(load.capacity).toBe(2 * 330);
    expect(load.tiles / load.capacity).toBeGreaterThan(0.6);
    expect(load.tiles / load.capacity).toBeLessThan(0.7);
    expect(load.tiles).toBe(STARTER_HULL);
    expect(load.over).toBe(0);
  });

  it('Mk II and Mk III carry more than Mk I', () => {
    const cap = (id: 'module.engine' | 'module.engine.mk2' | 'module.engine.mk3') => (content.modules as Record<string, ModuleDef>)[id]!.engine!.hullCapacity!;
    expect(cap('module.engine.mk2')).toBeGreaterThan(cap('module.engine'));
    expect(cap('module.engine.mk3')).toBeGreaterThan(cap('module.engine.mk2'));
  });

  it('a destroyed engine takes its capacity with it', () => {
    const sim = newGame(3, content);
    const ship = homeShip(sim);
    sim.world.get(enginesOf(sim)[0]!, ModuleC)!.hp = 0;
    expect(hullLoad(sim, ship).capacity).toBe(330);
  });
});

describe('overcharge risk', () => {
  it('is zero at capacity, and draws nothing from the rng', () => {
    const sim = heavy(0);
    const ship = homeShip(sim);
    expect(hullLoad(sim, ship).over).toBe(0);
    expect(riskOf(hullLoad(sim, ship))).toMatchObject({ risk: 0, hit: 0, destroy: 0, fire: 0 });
    const before = sim.rng.getState();
    expect(applyOvercharge(sim, ship)).toEqual({ damaged: 0, destroyed: 0, fires: 0 });
    expect(sim.rng.getState()).toBe(before);
  });

  it('rises with the overload', () => {
    const risks = [2, 10, 20, 30].map(over).map((extra) => (() => { const sim = heavy(extra); return riskOf(hullLoad(sim, homeShip(sim))); })());
    for (let i = 1; i < risks.length; i++) {
      expect(risks[i]!.risk).toBeGreaterThan(risks[i - 1]!.risk);
      expect(risks[i]!.hit).toBeGreaterThanOrEqual(risks[i - 1]!.hit);
      expect(risks[i]!.fire).toBeGreaterThanOrEqual(risks[i - 1]!.fire);
    }
    expect(risks[0]!.risk).toBeGreaterThan(0);
    expect(risks[3]!.risk).toBe(1);
  });

  it('really damages engines, destroys some and lights fires in the engine rooms; deterministic', () => {
    const totals = { damaged: 0, destroyed: 0, fires: 0 };
    const results: string[] = [];
    for (let seed = 1; seed <= 30; seed++) {
      const sim = heavy(over(30));
      sim.rng.setState(seed * 977);
      const ship = homeShip(sim);
      const hp = enginesOf(sim).map((id) => sim.world.get(id, ModuleC)!.hp);
      const r = applyOvercharge(sim, ship);
      totals.damaged += r.damaged;
      totals.destroyed += r.destroyed;
      totals.fires += r.fires;
      const after = enginesOf(sim).map((id) => sim.world.get(id, ModuleC)!.hp);
      expect(after.filter((h, i) => h < hp[i]!).length).toBe(r.damaged + r.destroyed);
      expect(after.filter((h) => h === 0).length).toBe(r.destroyed);
      const grid = shipGrid(sim, ship)!;
      let fire = 0;
      for (let y = grid.y0; y < grid.y0 + grid.height; y++) for (let x = grid.x0; x < grid.x0 + grid.width; x++) if (grid.get('fire', x, y) > 0) fire++;
      expect(fire).toBe(r.fires);
      results.push(JSON.stringify([r, after]));
      const again = heavy(over(30));
      again.rng.setState(seed * 977);
      expect(JSON.stringify([applyOvercharge(again, ship), enginesOf(again).map((id) => again.world.get(id, ModuleC)!.hp)])).toBe(results[results.length - 1]);
    }
    expect(totals.damaged).toBeGreaterThan(0);
    expect(totals.destroyed).toBeGreaterThan(0);
    expect(totals.fires).toBeGreaterThan(0);
  });

  it('a small overload hurts far less than a big one', () => {
    const sum = (extra: number) => {
      let n = 0;
      for (let seed = 1; seed <= 40; seed++) {
        const sim = heavy(extra);
        sim.rng.setState(seed * 31);
        const r = applyOvercharge(sim, homeShip(sim));
        n += r.damaged + 3 * r.destroyed + r.fires;
      }
      return n;
    };
    expect(sum(over(6))).toBeLessThan(sum(over(20)));
    expect(sum(over(20))).toBeLessThan(sum(over(30)));
  });
});

describe('the jump rule', () => {
  const ready = (extra: number): Sim => {
    const sim = heavy(extra);
    sim.world.get(homeShip(sim), CombatC)!.ftl = FTL_CHARGE_SEC;
    giveItems(sim, 'item.fuel', 50);
    return sim;
  };

  it('a ship at capacity jumps normally', () => {
    const sim = ready(0);
    sim.enqueue({ type: 'galaxy.jump', ship: homeShip(sim), route: [neighbour(sim)] });
    expect(run(sim, 2)).not.toContain('rejected:galaxy.jump:overweight');
    expect(sim.sector.state).toBe('hyperspace');
  });

  it('is blocked as overweight over capacity, and nothing is spent', () => {
    const sim = ready(over(2));
    const fuel = JSON.stringify(sim.galaxy.travel);
    sim.enqueue({ type: 'galaxy.jump', ship: homeShip(sim), route: [neighbour(sim)] });
    expect(run(sim, 2)).toContain('rejected:galaxy.jump:overweight');
    expect(sim.sector.state).toBe('active');
    expect(sim.world.get(homeShip(sim), CombatC)!.ftl).toBe(FTL_CHARGE_SEC);
    expect(JSON.stringify(sim.galaxy.travel)).toBe(fuel);
  });

  it('overcharge jumps anyway and the toll is paid', () => {
    const sim = ready(over(30));
    sim.enqueue({ type: 'galaxy.jump', ship: homeShip(sim), route: [neighbour(sim)], overcharge: true });
    const log = run(sim, 2);
    expect(log).not.toContain('rejected:galaxy.jump:overweight');
    expect(log).toContain('ftl.overcharged');
    expect(sim.sector.state).toBe('hyperspace');
  });

  it('a queued jump over capacity is refused up front unless it overcharges', () => {
    const sim = heavy(over(30));
    giveItems(sim, 'item.fuel', 50);
    sim.enqueue({ type: 'ftl.charge', ship: homeShip(sim), jump: [neighbour(sim)] });
    expect(run(sim, 1)).toContain('rejected:ftl.charge:overweight');
    sim.enqueue({ type: 'ftl.charge', ship: homeShip(sim), jump: [neighbour(sim)], overcharge: true });
    expect(run(sim, 1)).not.toContain('rejected:ftl.charge:overweight');
    expect(sim.world.get(homeShip(sim), CombatC)!.ftlOrder?.overcharge).toBe(true);
  });
});
