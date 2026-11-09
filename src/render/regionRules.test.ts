import { describe, expect, it } from 'vitest';
import { Grid } from '../sim/grid';
import { Struct } from '../sim/structure';
import { AllegianceC, CrewC, PositionC, ShipC, newGame } from '../sim';
import { content } from '../content';
import { crewHidden, wantsRoof } from './regionRules';

describe('crew visibility (sector grid §5)', () => {
  const g = new Grid(1, 4, 1, { struct: 'u8', module: 'u32' });
  g.set('struct', 0, 0, Struct.Floor);
  g.set('struct', 1, 0, Struct.Door);
  g.set('struct', 2, 0, Struct.Wall);
  g.set('module', 2, 0, 7);
  // (3, 0) stays Space: the EVA ring outside the hull.

  it('hides crew on floor, door and module tiles of a roofed region only', () => {
    expect([0, 1, 2, 3].map((x) => crewHidden(g, true, x, 0))).toEqual([true, true, true, false]);
    expect([0, 1, 2, 3].map((x) => crewHidden(g, false, x, 0))).toEqual([false, false, false, false]);
  });

  it('always draws crew outside the region', () => {
    expect(crewHidden(g, true, 9, 0)).toBe(false);
  });
});

describe('wantsRoof', () => {
  it("never roofs the player's ship unless asked, and the roof-enemies setting does not affect it", () => {
    const sim = newGame(1, content);
    const id = sim.world.query(ShipC).find((e) => sim.world.get(e, ShipC)?.faction === 'player') as number;
    const ship = sim.world.get(id, ShipC)!;
    expect(wantsRoof(sim.world, id, ship, true)).toBe(false);
    expect(wantsRoof(sim.world, id, ship, true, true)).toBe(true);
    expect(wantsRoof(sim.world, id, ship, false, true)).toBe(true);
  });

  it('still roofs hostile ships only when enemy roofs are on', () => {
    const sim = newGame(1, content);
    sim.enqueue({ type: 'debug.spawnEnemy', template: 'ship.raider', x: 100, y: 50 });
    sim.step();
    const id = sim.world.query(ShipC).find((e) => sim.world.get(e, ShipC)?.faction === 'hostile') as number;
    const ship = sim.world.get(id, ShipC)!;
    expect(wantsRoof(sim.world, id, ship, true, true)).toBe(true);
    expect(wantsRoof(sim.world, id, ship, false, true)).toBe(false);
  });

  it('roofs every ship at war with the player, not only hostile ones, for the whole fight', () => {
    const sim = newGame(1, content);
    sim.enqueue({ type: 'debug.spawnEnemy', template: 'ship.rogueShipyard', x: 100, y: 50 });
    sim.step();
    const id = sim.world.query(ShipC).find((e) => sim.world.get(e, ShipC)?.faction === 'rogue') as number;
    const ship = sim.world.get(id, ShipC)!;
    expect(wantsRoof(sim.world, id, ship, true)).toBe(true);
    for (const state of ['active', 'disabled'] as const) {
      ship.state = state;
      expect(wantsRoof(sim.world, id, ship, true)).toBe(true);
    }
    ship.state = 'wreck';
    expect(wantsRoof(sim.world, id, ship, true)).toBe(false);
  });

  it('stays roofed while player crew float in its EVA ring, and lifts only for crew aboard', () => {
    const sim = newGame(1, content);
    sim.enqueue({ type: 'debug.spawnEnemy', template: 'ship.raider', x: 100, y: 50 });
    sim.step();
    const id = sim.world.query(ShipC).find((e) => sim.world.get(e, ShipC)?.faction === 'hostile') as number;
    const ship = sim.world.get(id, ShipC)!;
    const crew = sim.world.query(CrewC, PositionC).find((c) => sim.world.get(c, AllegianceC)?.faction === 'player') as number;
    const pos = sim.world.get(crew, PositionC)!;
    pos.x = ship.x - 1;
    pos.y = ship.y + 2;
    expect(wantsRoof(sim.world, id, ship, true)).toBe(true);
    pos.x = ship.x + 2;
    expect(wantsRoof(sim.world, id, ship, true)).toBe(false);
  });

  it('roofs every ship but the player\'s, traders and neutrals too, until player crew step aboard; stations stay open (#390)', () => {
    const sim = newGame(1, content);
    sim.enqueue({ type: 'debug.spawnEnemy', template: 'ship.raider', x: 100, y: 50 });
    sim.step();
    sim.enqueue({ type: 'debug.spawnStation', kind: 'station.trading', size: 'outpost', seed: 4 });
    sim.step();
    const station = sim.world.query(ShipC).find((e) => sim.world.get(e, ShipC)?.immobile) as number;
    expect(wantsRoof(sim.world, station, sim.world.get(station, ShipC)!, true)).toBe(false);
    const id = sim.world.query(ShipC).find((e) => sim.world.get(e, ShipC)?.faction === 'hostile') as number;
    const ship = sim.world.get(id, ShipC)!;
    ship.faction = 'neutral'; // a ship nobody is at war with: a trader passing by
    expect(wantsRoof(sim.world, id, ship, true)).toBe(true);
    const crew = sim.world.query(CrewC, PositionC).find((c) => sim.world.get(c, AllegianceC)?.faction === 'player') as number;
    const grid = sim.sector.grid;
    let at: { x: number; y: number } | null = null;
    for (let y = ship.y; y < ship.y + ship.height && !at; y++) for (let x = ship.x; x < ship.x + ship.width && !at; x++) if (grid.get('ship', x, y) === id && grid.get('struct', x, y) === Struct.Floor) at = { x, y };
    Object.assign(sim.world.get(crew, PositionC)!, at);
    expect(wantsRoof(sim.world, id, ship, true)).toBe(false);
  });
});
