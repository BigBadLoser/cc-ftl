import { describe, expect, it } from 'vitest';
import {
  CombatC, CrewC, PositionC, ShipC, Struct, deserialize, homeShip, isDormant, newGame, serialize, shipGrid, type Sim,
} from '../sim';
import { targetableShip } from '../sim/combat/targets';
import { content } from '../content';
import { buildCombat } from './combatSnapshot';
import { buildShuttles } from './shuttleSnapshot';
import { buildTrade } from './tradeSnapshot';

function run(sim: Sim, n: number): string[] {
  const log: string[] = [];
  for (let i = 0; i < n; i++) {
    sim.step();
    for (const e of sim.events.drain()) log.push(e.type === 'command.rejected' ? `rejected:${e.command}:${e.reason}` : e.type);
  }
  return log;
}

/** The starter ship plus a hostile dug (pirate) outpost; returns the base region. */
function setup(): { sim: Sim; base: number } {
  const sim = newGame(2, content);
  sim.enqueue({ type: 'debug.spawnOutpost', style: 'dug', seed: 1, kind: 'pirate' });
  sim.step();
  const base = [...sim.world.query(ShipC)].find((id) => sim.world.get(id, ShipC)?.outpost)!;
  return { sim, base };
}

const listed = (sim: Sim, base: number) =>
  buildShuttles(sim).targets.some((t) => t.ship === base) || buildTrade(sim).partners.some((p) => p.id === base) || buildCombat(sim).enemies.some((e) => e.ship === base);

/** A floor tile of the base (its first, row-major). */
function baseFloor(sim: Sim, base: number): { x: number; y: number } {
  const g = shipGrid(sim, base)!;
  for (let y = g.y0; y < g.y0 + g.height; y++) for (let x = g.x0; x < g.x0 + g.width; x++) if (g.get('ship', x, y) === base && g.get('struct', x, y) === Struct.Floor) return { x, y };
  throw new Error('no floor');
}

const playerCrew = (sim: Sim) => [...sim.world.query(CrewC)].sort((a, b) => a - b)[0]!;
const moveTo = (sim: Sim, crew: number, x: number, y: number) => Object.assign(sim.world.get(crew, PositionC)!, { x, y, toX: x, toY: y, progress: 0 });

describe('outpost hostility', () => {
  it('a hostile dug outpost in the node is dormant and hidden: no combat, not listed, not targetable, not disabled', () => {
    const { sim, base } = setup();
    const log = run(sim, 200);
    expect(log).not.toContain('combat.started');
    expect(sim.sector.inCombat).toBe(false);
    const s = sim.world.get(base, ShipC)!;
    expect(s.faction).toBe('hostile');
    expect(s.state).toBe('active');
    expect(s).toMatchObject({ immobile: true, outpost: { hidden: true } });
    expect(s.dormant).toBeDefined();
    expect(listed(sim, base)).toBe(false);
    expect(targetableShip(sim, base)).toBe(false);
  });

  it('player crew near it discover it (still dormant); boarding it provokes it into combat', () => {
    const { sim, base } = setup();
    const crew = playerCrew(sim);
    const f = baseFloor(sim, base);
    const s = sim.world.get(base, ShipC)!;
    moveTo(sim, crew, s.x - 3, f.y); // within DISCOVER_RANGE of the base's tiles
    let log = run(sim, 20);
    expect(log).toContain('outpost.discovered');
    expect(log).not.toContain('combat.started');
    expect(s.outpost).toMatchObject({ hidden: false });
    expect(buildShuttles(sim).targets.some((t) => t.ship === base)).toBe(true);
    moveTo(sim, crew, f.x, f.y);
    log = run(sim, 20);
    expect(log).toContain('ship.provoked');
    expect(log).toContain('combat.started');
    expect(buildCombat(sim).enemies.some((e) => e.ship === base)).toBe(true);
  });

  it('a dig breaching into it discovers and provokes it', () => {
    const { sim, base } = setup();
    const f = baseFloor(sim, base);
    const g = sim.sector.grid;
    // a floor the base does not own beside one of its floors: what a player tunnel reaching it leaves
    const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ x: f.x + dx!, y: f.y + dy! })).find((t) => g.get('struct', t.x, t.y) === Struct.Rock)!;
    g.set('struct', n.x, n.y, Struct.Floor);
    g.set('ship', n.x, n.y, 0);
    const log = run(sim, 20);
    expect(log.indexOf('outpost.discovered')).toBeGreaterThanOrEqual(0);
    expect(log).toContain('ship.provoked');
    expect(sim.world.get(base, ShipC)!.outpost).toMatchObject({ hidden: false });
    expect(sim.world.get(base, ShipC)!.dormant).toBeUndefined();
  });

  it('aiming weapons at a discovered outpost provokes it (a hidden one cannot be targeted)', () => {
    const { sim, base } = setup();
    sim.enqueue({ type: 'combat.setTarget', ship: homeShip(sim), weaponId: null, targetShip: base, targetModuleId: 0 });
    expect(run(sim, 1)).toContain('rejected:combat.setTarget:badTarget');
    const s = sim.world.get(base, ShipC)!;
    s.outpost!.hidden = false; // discovered
    sim.enqueue({ type: 'combat.setTarget', ship: homeShip(sim), weaponId: null, targetShip: base, targetModuleId: 0 });
    const log = run(sim, 60 * 20);
    expect(log).toContain('ship.provoked');
    expect(log).toContain('combat.started');
  });

  it('save and load keeps hidden, discovered and provoked; play goes on identically', () => {
    const { sim, base } = setup();
    run(sim, 30);
    const a = deserialize(serialize(sim), content);
    expect(a.world.get(base, ShipC)!.outpost).toMatchObject({ hidden: true });
    sim.world.get(base, ShipC)!.outpost!.hidden = false;
    const b = deserialize(serialize(sim), content);
    expect(b.world.get(base, ShipC)!.outpost).toMatchObject({ hidden: false });
    moveTo(sim, playerCrew(sim), baseFloor(sim, base).x, baseFloor(sim, base).y);
    run(sim, 20);
    const c = deserialize(serialize(sim), content);
    expect(c.world.get(base, ShipC)!.dormant).toBeUndefined();
    expect(run(c, 300)).toEqual(run(sim, 300));
    expect(serialize(c)).toBe(serialize(sim));
  });

  it('a dormant outpost and a dormant den wake through the same path: both emit ship.provoked and get a CombatC', () => {
    const { sim, base } = setup();
    sim.enqueue({ type: 'debug.spawnStation', kind: 'station.pirate', size: 'outpost', seed: 3, x: sim.sector.width + 40, y: 20 });
    expect(run(sim, 1).filter((e) => e.startsWith('rejected'))).toEqual([]);
    const den = [...sim.world.query(ShipC)].find((id) => sim.world.get(id, ShipC)?.gen?.faction === 'station.pirate' && !sim.world.get(id, ShipC)?.outpost)!;
    sim.world.get(base, ShipC)!.outpost!.hidden = false;
    for (const id of [base, den]) expect(isDormant(sim.world.get(id, ShipC))).toBe(true);
    const woke: number[] = [];
    for (const id of [base, den]) {
      sim.enqueue({ type: 'combat.setTarget', ship: homeShip(sim), weaponId: null, targetShip: id, targetModuleId: 0 });
      for (let i = 0; i < 3; i++) {
        sim.step();
        for (const e of sim.events.drain()) if (e.type === 'ship.provoked') woke.push(e.ship);
      }
    }
    expect(woke.sort((a, b) => a - b)).toEqual([base, den].sort((a, b) => a - b));
    for (const id of [base, den]) {
      expect(isDormant(sim.world.get(id, ShipC))).toBe(false);
      expect(sim.world.has(id, CombatC)).toBe(true);
    }
  });
});
