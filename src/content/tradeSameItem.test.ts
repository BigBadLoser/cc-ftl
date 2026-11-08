import { describe, expect, it } from 'vitest';
import { ShipC, checkOffer, newGame } from '../sim';
import { content } from './index';

/**
 * #150: selling and buying the same item in one deal is refused. Station delivery and pickup track cargo by item id only, so a deal
 * with an item on both sides could settle on the outbound units as if they were the purchase. The trade window nets them instead.
 */
describe('a deal with an item on both sides', () => {
  it('is rejected by the offer check and by trade.offer, so no deal starts', () => {
    const sim = newGame(1, content);
    sim.enqueue({ type: 'debug.spawnStation', kind: 'station.trading', size: 'outpost', seed: 4 });
    sim.step();
    const st = sim.world.query(ShipC).find((i) => sim.world.get(i, ShipC)!.immobile)!;
    sim.enqueue({ type: 'trade.hail', ship: st });
    sim.step();
    sim.events.drain();
    const give = [{ item: 'item.metal', count: 5 }], get = [{ item: 'item.metal', count: 3 }];
    expect(checkOffer(sim, st, give, get, false).error).toBe('sameItem');
    expect(checkOffer(sim, st, give, get, true).error).toBe('sameItem');
    sim.enqueue({ type: 'trade.offer', ship: st, give, get });
    sim.step();
    expect(sim.events.drain()).toContainEqual(expect.objectContaining({ type: 'command.rejected', reason: 'sameItem' }));
    expect(sim.trade.offers.filter((o) => o.ship === st)).toEqual([]);
    expect(sim.trade.deals).toEqual([]);
  });
});
