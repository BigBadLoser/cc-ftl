import { describe, expect, it } from 'vitest';
import {
  CombatC, FTL_CHARGE_SEC, HullPlanC, ModuleC, START_NODE, ShipC, Struct, TraderC, deserialize, galaxyIndex, hullLoad, hullTiles, isLiveOrder, nodeOf, plannedTiles, quoteYard, serialize, shipGrid,
  viewPlan, yardPrice, yardService,
} from '../sim';
import { giveItems } from '../sim/story/effects';
import { storageCount } from '../sim/items/storage';
import { StorageC } from '../sim/items/components';
import { content } from './index';
import { outline, planHull, rect, run, yardGame } from './yardFixture';

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
  it('is per hull tile and rises a little with danger', () => {
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

describe('ship size: the area inside the outer hull', () => {
  it('interior walls, doors and floor count as area, the outer ring does not, and a wall added outside moves the ring out', () => {
    const { sim, me } = yardGame();
    const before = hullLoad(sim, me).tiles;
    expect(before).toBe(416);
    expect(hullTiles(shipGrid(sim, me)!)).toBe(88); // the ring itself: what the yard prices
    const s = sim.world.get(me, ShipC)!;
    // A wall and a door in the middle of a room, and a floor tile of the margin: no change.
    sim.enqueue({ type: 'debug.setStruct', ship: me, x: s.x + 12, y: s.y + 6, kind: Struct.Wall });
    sim.enqueue({ type: 'debug.setStruct', ship: me, x: s.x + 13, y: s.y + 6, kind: Struct.Door });
    sim.step();
    expect(hullLoad(sim, me).tiles).toBe(before);
    // A wall in the open margin against the hull is outer, and the old wall behind it is interior now: one tile more of area, the ring the same.
    sim.enqueue({ type: 'debug.setStruct', ship: me, x: s.x + 8, y: s.y, kind: Struct.Wall });
    sim.step();
    expect(hullLoad(sim, me).tiles).toBe(before + 1);
    expect(hullTiles(shipGrid(sim, me)!)).toBe(88);
  });
});

describe('the hull plan', () => {
  it('is set by command, kept with the ship through a save, and cleared by an empty one', () => {
    const { sim, me } = yardGame();
    const tiles = outline(sim, me, 8, -2, 4, 3);
    planHull(sim, me, tiles);
    expect(sim.world.get(me, HullPlanC)!.tiles).toHaveLength(10);
    const back = deserialize(serialize(sim), content);
    expect(plannedTiles(back, me)).toEqual(plannedTiles(sim, me));
    planHull(sim, me, []);
    expect(sim.world.has(me, HullPlanC)).toBe(false);
  });

  it('drops tiles that are not open space, and refuses tiles far from the ship', () => {
    const { sim, me } = yardGame();
    planHull(sim, me, [...outline(sim, me, 8, -2, 4, 3), ...rect(sim, me, 5, 5, 2, 2)]); // the last four lie on the ship's own floor
    expect(sim.world.get(me, HullPlanC)!.tiles).toHaveLength(10);
    sim.enqueue({ type: 'hull.plan', ship: me, tiles: rect(sim, me, 200, 0, 1, 1) });
    expect(run(sim, 1)).toContain('rejected:hull.plan:badValue');
    expect(sim.world.get(me, HullPlanC)!.tiles).toHaveLength(10);
  });

  it('shows what can be built from the ship, what floats, and the floor it shuts in', () => {
    const { sim, me } = yardGame();
    planHull(sim, me, [...outline(sim, me, 8, -2, 4, 3), ...outline(sim, me, 20, -12, 3, 3)]);
    const v = viewPlan(sim, me);
    expect(v.tiles).toHaveLength(10 + 8);
    expect(v.connected).toHaveLength(10);
    expect(v.loose).toHaveLength(8);
    expect(v.floor).toHaveLength(2);
    expect(v.hull.afterAll).toBeGreaterThan(v.hull.now);
  });
});

describe('shipyard: the quote', () => {
  it('builds the planned hull and the floor it shuts in, priced by tile built', () => {
    const { sim, station, me } = yardGame();
    planHull(sim, me, outline(sim, me, 8, -2, 4, 3));
    const q = quoteYard(sim, station, me);
    expect(q.error).toBeNull();
    expect(q.walls).toHaveLength(10);
    expect(q.floor).toHaveLength(2);
    expect(q.price).toEqual(yardPrice(sim, q.service!, 12)); // outline and floor alike
    expect(q.gaps).toHaveLength(1);
    expect(q.hull.before).toBe(416);
    expect(q.hull.after).toBe(viewPlan(sim, me).hull.afterAll);
    expect(q.hull.capacity).toBe(660);
    expect(q.rect!.y).toBeLessThan(sim.world.get(me, ShipC)!.y);
    expect(q.rest).toBe(0);
  });

  it('builds up to the visit cap, nearest the ship first, and leaves the rest planned', () => {
    const { sim, station, me } = yardGame();
    const cap = yardService(sim, station)!.tier.cap;
    planHull(sim, me, outline(sim, me, 4, -9, 14, 10)); // 44 tiles of border; the south side is the ship's north margin row
    const q = quoteYard(sim, station, me);
    expect(q.error).toBeNull();
    expect(q.walls.length + q.floor.length).toBeLessThanOrEqual(cap);
    expect(q.walls.length + q.floor.length).toBeGreaterThan(cap - 8);
    const planned = new Set(viewPlan(sim, me).tiles.map((t) => `${t.x},${t.y}`));
    expect(q.rest).toBe(planned.size - q.walls.filter((t) => planned.has(`${t.x},${t.y}`)).length);
    // The bought tiles are the ones nearest the ship: every one touches the ship or another bought tile.
    const s = sim.world.get(me, ShipC)!;
    expect(q.walls.some((t) => t.y >= s.y)).toBe(true);
    const hub = yardGame('hub');
    planHull(hub.sim, hub.me, outline(hub.sim, hub.me, 4, -9, 14, 10));
    const hq = quoteYard(hub.sim, hub.station, hub.me);
    expect(hq.walls.length + hq.floor.length).toBeGreaterThan(cap);
  });

  it('a 24-wall, 49-tile buy moves the size meaningfully', () => {
    const { sim, station, me } = yardGame('hub');
    planHull(sim, me, outline(sim, me, 6, -6, 7, 7)); // a 7 x 7 ring: 24 outline tiles round 25 floor
    const q = quoteYard(sim, station, me);
    expect(q.walls).toHaveLength(24);
    expect(q.hull.before).toBe(416);
    expect(q.hull.after).toBe(453);
    expect(q.hull.after / q.hull.capacity).toBeGreaterThan(0.68);
  });

  it('when the cap cuts a room short it builds the rows nearest the ship, shut off by a cross wall, in row order', () => {
    const { sim, station, me } = yardGame();
    const s = sim.world.get(me, ShipC)!;
    planHull(sim, me, outline(sim, me, 8, -9, 8, 10)); // 8 wide, 10 deep: 32 ring tiles round 48 floor, the cap is 40 tiles
    const q = quoteYard(sim, station, me);
    expect(q.error).toBeNull();
    // The room is cut four rows out: a full cross wall shuts it, the far end (and the planned top wall) stays for the next yard.
    const dy = q.walls.map((t) => t.y - s.y);
    expect(Math.min(...dy)).toBe(-4);
    expect(dy.filter((y) => y === -4)).toHaveLength(8);
    expect(q.floor).toHaveLength(18);
    expect(q.walls.length + q.floor.length).toBe(40);
    expect(q.rest).toBe(16);
    // Row order: the nearest row to the ship first, working outward.
    for (let i = 1; i < dy.length; i++) expect(dy[i]!).toBeLessThanOrEqual(dy[i - 1]!);
  });

  it('a 14-wide room against the cap builds the largest closed rectangle, never floorless wall stubs', () => {
    const { sim, station, me } = yardGame();
    planHull(sim, me, outline(sim, me, 4, -9, 14, 10)); // 44 ring tiles, the cap is 40 tiles: no full-width cut fits
    const q = quoteYard(sim, station, me);
    expect(q.error).toBeNull();
    expect(q.walls.length + q.floor.length).toBeLessThanOrEqual(40);
    expect(q.floor.length).toBeGreaterThanOrEqual(18);
    // Closed: every wall touches a floor tile or the ship, and every floor tile's four neighbours are floor, a bought wall or the ship's structure.
    const grid = shipGrid(sim, me)!;
    const walls = new Set(q.walls.map((t) => `${t.x},${t.y}`));
    const floor = new Set(q.floor.map((t) => `${t.x},${t.y}`));
    for (const t of q.floor) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const k = `${t.x + dx},${t.y + dy}`;
        expect(floor.has(k) || walls.has(k) || grid.get('struct', t.x + dx, t.y + dy) !== Struct.Space, `open side at ${k}`).toBe(true);
      }
    }
    const touches = (t: { x: number; y: number }) => ([-1, 0, 1] as const).some((dx) => ([-1, 0, 1] as const).some((dy) => floor.has(`${t.x + dx},${t.y + dy}`)));
    for (const t of q.walls) expect(touches(t), `stub ${t.x},${t.y}`).toBe(true);
  });

  it('refuses a plan that does not touch the ship, and keeps the airlock approach clear', () => {
    const { sim, station, me } = yardGame();
    planHull(sim, me, outline(sim, me, 8, -12, 4, 3));
    expect(quoteYard(sim, station, me).error).toBe('notAdjacent');
    planHull(sim, me, []);
    expect(quoteYard(sim, station, me).error).toBe('noTiles');
    // The starter's docking airlock is on the west hull at y = 9..11: nothing is built in front of it.
    planHull(sim, me, rect(sim, me, 0, 9, 1, 3));
    const v = viewPlan(sim, me);
    expect(v.blocked).toHaveLength(3);
    expect(quoteYard(sim, station, me).error).toBe('notAdjacent');
    planHull(sim, me, rect(sim, me, 0, 2, 1, 3));
    expect(quoteYard(sim, station, me).error).toBeNull();
  });

  it('has no ship maximum (engine capacity is the only size limit), and keeps clear of a neighbouring ship', () => {
    const { sim, station, me } = yardGame();
    expect('maxSize' in content.yard).toBe(false);
    planHull(sim, me, outline(sim, me, 8, -2, 4, 3));
    expect(quoteYard(sim, station, me).error).toBeNull(); // even though it leaves the ship over its engines' capacity
    planHull(sim, me, outline(sim, me, 4, -9, 8, 10));
    const s = sim.world.get(me, ShipC)!;
    const st = sim.world.get(station, ShipC)!;
    st.x = s.x;
    st.y = s.y - 10 - st.height; // a yard's width off the north side (the station's own grid is not stepped again)
    expect(quoteYard(sim, station, me).error).toBe('crowded');
  });
});

describe('shipyard: the order', () => {
  it('pays credits and metal into escrow, posts the jobs and takes the bought tiles out of the plan; called off before anyone lands, all comes back', () => {
    const { sim, station, me } = yardGame();
    const credits = sim.trade.credits;
    const metal = metalOf(sim);
    const trader = sim.world.get(station, TraderC)!;
    const wallet = trader.credits;
    planHull(sim, me, outline(sim, me, 8, -2, 4, 3));
    const price = yardPrice(sim, yardService(sim, station)!, 12);
    sim.enqueue({ type: 'yard.order', station });
    expect(run(sim, 1)).toContain('yard.ordered');
    const order = sim.yard.orders[0]!;
    expect(sim.trade.credits).toBe(credits - price.credits);
    expect(metalOf(sim)).toBe(metal - price.metal);
    expect(order.held).toEqual(price);
    expect(trader.credits).toBe(wallet); // held, not paid
    expect(sim.world.has(me, HullPlanC)).toBe(false); // everything planned was bought
    expect(order.walls).toHaveLength(10);
    expect(order.floor).toHaveLength(2);
    expect(shipGrid(sim, me)!.inBounds(order.walls[0]!.x, order.walls[0]!.y - 1)).toBe(true);
    // A second order is refused while this one runs.
    planHull(sim, me, outline(sim, me, 20, -2, 3, 3));
    sim.enqueue({ type: 'yard.order', station });
    expect(run(sim, 1)).toContain('rejected:yard.order:busy');
    // Called off before anyone landed: everything comes back, nothing is paid.
    sim.enqueue({ type: 'yard.cancel', order: order.id });
    run(sim, 1);
    expect(sim.trade.credits).toBe(credits);
    expect(metalOf(sim)).toBe(metal);
    expect(trader.credits).toBe(wallet);
    expect(sim.yard.orders[0]!.held).toEqual({ credits: 0, metal: 0 });
  });

  it('a partial buy leaves the rest planned for the next yard', () => {
    const { sim, station, me } = yardGame();
    giveItems(sim, 'item.metal', 100);
    const cap = yardService(sim, station)!.tier.cap;
    planHull(sim, me, outline(sim, me, 4, -9, 14, 10));
    const all = viewPlan(sim, me).tiles.length;
    sim.enqueue({ type: 'yard.order', station });
    expect(run(sim, 1)).toContain('yard.ordered');
    const bought = sim.yard.orders[0]!.walls;
    expect(bought.length + sim.yard.orders[0]!.floor.length).toBeLessThanOrEqual(cap);
    const was = new Set(bought.map((t) => `${t.x},${t.y}`));
    expect(plannedTiles(sim, me).length).toBeGreaterThan(0);
    expect(plannedTiles(sim, me).every((t) => !was.has(`${t.x},${t.y}`))).toBe(true);
    expect(plannedTiles(sim, me).length).toBeLessThan(all);
  });

  it('refuses what you cannot pay for', () => {
    const { sim, station, me } = yardGame();
    planHull(sim, me, outline(sim, me, 8, -2, 4, 3));
    sim.trade.credits = 50;
    sim.enqueue({ type: 'yard.order', station });
    expect(run(sim, 1)).toContain('rejected:yard.order:cantAfford');
    sim.trade.credits = 5000;
    for (const id of sim.world.query(StorageC)) sim.world.get(id, StorageC)!.stacks = sim.world.get(id, StorageC)!.stacks.filter((s) => s.item !== 'item.metal');
    sim.enqueue({ type: 'yard.order', station });
    expect(run(sim, 1)).toContain('rejected:yard.order:noMetal');
    expect(sim.yard.orders).toHaveLength(0);
    expect(sim.trade.credits).toBe(5000);
    expect(sim.world.get(me, HullPlanC)!.tiles).toHaveLength(10);
  });

  it('leaving the node ends the order on the spot and refunds what was not built', () => {
    const { sim, station, me } = yardGame();
    const credits = sim.trade.credits;
    planHull(sim, me, outline(sim, me, 8, -2, 4, 3));
    sim.enqueue({ type: 'yard.order', station });
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
    expect(o.held).toEqual({ credits: 0, metal: 0 });
  });
});
