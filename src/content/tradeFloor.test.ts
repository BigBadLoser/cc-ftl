import { describe, expect, it } from 'vitest';
import { ItemStackC, ShipC, Struct, homeShip, newGame, playerItems, shipGrid } from '../sim';
import { content } from './index';

describe('selling loose stacks (issue #222)', () => {
  it('ore left on the deck can be sold: crew haul it from the floor into the shuttle and the station pays', { timeout: 30000 }, () => {
    const sim = newGame(1, content);
    sim.galaxy.fleets = [];
    sim.enqueue({ type: 'debug.spawnStation', kind: 'station.trading', size: 'outpost', seed: 4 });
    sim.step();
    const station = sim.world.query(ShipC).find((i) => sim.world.get(i, ShipC)!.immobile)!;
    // A loose stack of ore on a free floor tile of the home ship (as a pod leaves it at its bay).
    const g = shipGrid(sim, homeShip(sim))!;
    let at: { x: number; y: number } | null = null;
    for (let y = g.y0; y < g.y0 + g.height && !at; y++) for (let x = g.x0; x < g.x0 + g.width && !at; x++) {
      if (g.get('struct', x, y) === Struct.Floor && !g.get('module', x, y)) at = { x, y };
    }
    sim.enqueue({ type: 'debug.spawnItems', ship: homeShip(sim), x: at!.x, y: at!.y, item: 'item.iron_ore', count: 30 });
    sim.step();
    expect(playerItems(sim, 'item.iron_ore')).toBeGreaterThanOrEqual(30);
    const before = sim.trade.credits;
    const ore0 = playerItems(sim, 'item.iron_ore');
    sim.enqueue({ type: 'trade.hail', ship: station });
    sim.step();
    sim.enqueue({ type: 'trade.offer', ship: station, give: [{ item: 'item.iron_ore', count: 30 }], get: [] });
    sim.step();
    sim.enqueue({ type: 'trade.accept', offer: sim.trade.offers[0]!.id });
    for (let i = 0; i < 8000 && sim.trade.credits <= before; i++) sim.step();
    expect(sim.trade.credits).toBeGreaterThan(before);
    expect(playerItems(sim, 'item.iron_ore')).toBe(ore0 - 30);
    expect(sim.world.query(ItemStackC).some((id) => sim.world.get(id, ItemStackC)!.item === 'item.iron_ore' && sim.world.get(id, ItemStackC)!.x === at!.x && sim.world.get(id, ItemStackC)!.y === at!.y && sim.world.get(id, ItemStackC)!.count >= 30)).toBe(false);
  });
});
