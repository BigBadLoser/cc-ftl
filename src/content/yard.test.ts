import { describe, expect, it } from 'vitest';
import { CombatC, FTL_CHARGE_SEC, ModuleC, START_NODE, ShipC, TraderC, galaxyIndex, hullLoad, isLiveOrder, nodeOf, planYard, shipGrid, yardPrice, yardService } from '../sim';
import { giveItems } from '../sim/story/effects';
import { storageCount } from '../sim/items/storage';
import { StorageC } from '../sim/items/components';
import { content } from './index';
import { rect, run, yardGame } from './yardFixture';

/** Metal in all the player's storage. */
const metalOf = (sim: ReturnType<typeof yardGame>['sim']): number =>
  sim.world.query(StorageC, ModuleC).reduce((n, id) => n + storageCount(sim, id, 'item.metal'), 0);

describe('shipyard: who offers it', () => {
  it('trading and military stations of the station and hub tiers do, outposts and the other kinds do not', () => {
    for (const [kind, size, yes] of [
      ['station.trading', 'station', true], ['station.trading', 'hub', true], ['station.military', 'station', true], ['station.military', 'hub', true],
      ['station.trading', 'outpost', false], ['station.military', 'outpost', false], ['station.research', 'station', false],
      ['station.farming', 'hub', false], ['station.mining', 'station', false],
    ] as const) {
      const { sim, station } = yardGame(size, kind);
      expect(!!yardService(sim, station), `${kind} ${size}`).toBe(yes);
    }
  });

  it('a hub does more per visit than a station, and costs more per tile', () => {
    const a = yardGame('station');
    const b = yardGame('hub');
    const sa = yardService(a.sim, a.station)!;
    const sb = yardService(b.sim, b.station)!;
    expect(sb.tier.cap).toBeGreaterThan(sa.tier.cap);
    expect(yardPrice(b.sim, sb, 10).credits).toBeGreaterThan(yardPrice(a.sim, sa, 10).credits);
    expect(yardPrice(b.sim, sb, 10).metal).toBeGreaterThanOrEqual(yardPrice(a.sim, sa, 10).metal);
  });
});

describe('shipyard: pricing', () => {
  it('is per painted tile and rises a little with danger', () => {
    const { sim, station } = yardGame('station');
    const svc = yardService(sim, station)!;
    const one = yardPrice(sim, svc, 1);
    expect(yardPrice(sim, svc, 10).credits).toBe(10 * one.credits);
    const node = nodeOf(sim, sim.galaxy.current)!;
    const was = node.danger; // generated nodes are cached per seed: put it back
    node.danger = 0;
    const calm = yardPrice(sim, yardService(sim, station)!, 20);
    node.danger = 6;
    const deep = yardPrice(sim, yardService(sim, station)!, 20);
    node.danger = was;
    expect(deep.credits).toBeGreaterThan(calm.credits);
    expect(deep.credits).toBeLessThan(calm.credits * 1.5); // slightly
    expect(deep.metal).toBeGreaterThanOrEqual(calm.metal);
  });
});

describe('shipyard: placement validation', () => {
  const north = (sim: Parameters<typeof rect>[0], me: number, w: number, h: number) => rect(sim, me, 8, -h + 1, w, h);

  it('accepts hull painted against the ship, priced and walled, and counts the hull it adds', () => {
    const { sim, station, me } = yardGame();
    const plan = planYard(sim, station, north(sim, me, 6, 4));
    expect(plan.error).toBeNull();
    expect(plan.floor).toHaveLength(24);
    expect(plan.walls.length).toBeGreaterThan(0);
    expect(plan.price).toEqual(yardPrice(sim, plan.service!, 24));
    expect(plan.price.credits).toBeGreaterThanOrEqual(24 * 18);
    expect(plan.hull.after).toBe(plan.hull.before + plan.walls.length);
    expect(plan.hull.capacity).toBe(hullLoad(sim, me).capacity);
    expect(plan.gaps).toHaveLength(1);
    expect(plan.rect!.y).toBeLessThan(sim.world.get(me, ShipC)!.y);
  });

  it('rejects hull that does not touch the ship, and open tiles that are not open', () => {
    const { sim, station, me } = yardGame();
    expect(planYard(sim, station, rect(sim, me, 8, -10, 3, 3)).error).toBe('notAdjacent'); // floating off the hull
    const away = planYard(sim, station, [...north(sim, me, 3, 2), ...rect(sim, me, 20, -8, 2, 2)]);
    expect(away.error).toBe('notAdjacent');
    expect(away.bad).toHaveLength(4); // only the loose patch is marked
    expect(planYard(sim, station, rect(sim, me, 5, 5, 2, 2)).error).toBe('blocked'); // over the ship's own floor
    expect(planYard(sim, station, []).error).toBe('noTiles');
  });

  it('leaves the airlock approach clear', () => {
    const { sim, station, me } = yardGame();
    // The starter's docking airlock is on the west hull at y = 9..11.
    expect(planYard(sim, station, rect(sim, me, 0, 9, 1, 3)).error).toBe('blocked');
    expect(planYard(sim, station, rect(sim, me, 0, 2, 1, 3)).error).toBeNull();
  });

  it('caps the tiles per visit by the yard tier and the ship by the overall maximum', () => {
    const { sim, station, me } = yardGame('station');
    const cap = yardService(sim, station)!.tier.cap;
    expect(planYard(sim, station, north(sim, me, cap, 1)).error).toBeNull();
    expect(planYard(sim, station, north(sim, me, cap + 1, 1)).error).toBe('yardCap');
    const hub = yardGame('hub');
    expect(planYard(hub.sim, hub.station, north(hub.sim, hub.me, cap + 1, 1)).error).toBeNull();
    // The overall ship maximum: shrink it to what the ship covers and every addition is too much.
    const area = planYard(sim, station, north(sim, me, 2, 1)).area;
    const small = yardGame('station', 'station.trading', { ...content, yard: { ...content.yard, maxTiles: area + 1 } });
    expect(planYard(small.sim, small.station, north(small.sim, small.me, 2, 1)).error).toBe('shipMax');
  });

  it('keeps clear of a neighbouring ship', () => {
    const { sim, station, me } = yardGame();
    const s = sim.world.get(me, ShipC)!;
    const st = sim.world.get(station, ShipC)!;
    // Move the station up against the player's north side, a yard's width away.
    st.x = s.x;
    st.y = s.y - 10 - st.height;
    expect(planYard(sim, station, north(sim, me, 3, 8)).error).toBe('crowded');
    expect(planYard(sim, station, north(sim, me, 3, 1)).error).toBeNull(); // a strip that stays clear of it
  });
});

describe('shipyard: the order', () => {
  it('pays credits and metal into escrow and posts the jobs; the unbuilt part comes back on a recall before the crew land', () => {
    const { sim, station, me } = yardGame();
    const credits = sim.trade.credits;
    const metal = metalOf(sim);
    const price = yardPrice(sim, yardService(sim, station)!, 24);
    const trader = sim.world.get(station, TraderC)!;
    const wallet = trader.credits;
    const tiles = rect(sim, me, 8, -3, 6, 4);
    sim.enqueue({ type: 'yard.order', station, tiles });
    expect(run(sim, 1)).toContain('yard.ordered');
    const order = sim.yard.orders[0]!;
    expect(sim.trade.credits).toBe(credits - price.credits);
    expect(metalOf(sim)).toBe(metal - price.metal);
    expect(order.held).toEqual(price);
    expect(trader.credits).toBe(wallet); // held, not paid
    // The ship's rectangle grew to hold it, and every tile has a job.
    expect(shipGrid(sim, me)!.inBounds(tiles[0]!.x, tiles[0]!.y - 1)).toBe(true);
    // A second order is refused while this one runs.
    sim.enqueue({ type: 'yard.order', station, tiles: rect(sim, me, 20, -3, 2, 2) });
    expect(run(sim, 1)).toContain('rejected:yard.order:busy');
    // Called off before anyone landed: everything comes back, nothing is paid.
    sim.enqueue({ type: 'yard.cancel', order: order.id });
    run(sim, 1);
    expect(sim.trade.credits).toBe(credits);
    expect(metalOf(sim)).toBe(metal);
    expect(trader.credits).toBe(wallet);
    expect(sim.yard.orders[0]!.held).toEqual({ credits: 0, metal: 0 });
  });

  it('refuses what you cannot pay for, and fights', () => {
    const { sim, station, me } = yardGame();
    sim.trade.credits = 100;
    sim.enqueue({ type: 'yard.order', station, tiles: rect(sim, me, 8, -3, 6, 4) });
    expect(run(sim, 1)).toContain('rejected:yard.order:cantAfford');
    sim.trade.credits = 5000;
    for (const id of sim.world.query(StorageC)) sim.world.get(id, StorageC)!.stacks = sim.world.get(id, StorageC)!.stacks.filter((s) => s.item !== 'item.metal');
    sim.enqueue({ type: 'yard.order', station, tiles: rect(sim, me, 8, -3, 6, 4) });
    expect(run(sim, 1)).toContain('rejected:yard.order:noMetal');
    expect(sim.yard.orders).toHaveLength(0);
    expect(sim.trade.credits).toBe(5000);
  });

  it('leaving the node ends the order on the spot and refunds what was not built', () => {
    const { sim, station, me } = yardGame();
    const credits = sim.trade.credits;
    sim.enqueue({ type: 'yard.order', station, tiles: rect(sim, me, 8, -3, 6, 4) });
    run(sim, 30);
    expect(isLiveOrder(sim.yard.orders[0]!)).toBe(true);
    sim.world.get(me, CombatC)!.ftl = FTL_CHARGE_SEC;
    giveItems(sim, 'item.fuel', 50);
    const e = galaxyIndex(sim.galaxy).adjacent.get(START_NODE)![0]!;
    sim.enqueue({ type: 'galaxy.jump', ship: me, route: [e.a === START_NODE ? e.b : e.a] });
    expect(run(sim, 1)).toContain('yard.ended');
    expect(sim.sector.state).toBe('hyperspace');
    const o = sim.yard.orders[0]!;
    expect(o).toMatchObject({ phase: 'failed', reason: 'left', crew: [], vehicle: 0 });
    expect(sim.trade.credits).toBe(credits);
    expect(o.held).toEqual({ credits: 0, metal: 0 }); // the metal went back into storage before the ship was lifted
  });
});
