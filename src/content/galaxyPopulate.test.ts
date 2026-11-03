import { describe, expect, it } from 'vitest';
import {
  AsteroidC, ShipC, TraderC, deserialize, galaxyIndex, moveStock, newGame, portOf, portsAt, serialize, stockAt, econOf, type Port, type Sim,
} from '../sim';
import { placementGapError } from '../sim/regions';
import { liveTrader } from '../sim/galaxy/market';
import { ensureChunk, ensureAround, nodeState } from '../sim/galaxy/state';
import { WEST_MARGIN } from '../sim/galaxy/populate';
import { content } from '.';

const step = (sim: Sim, n = 1): void => {
  for (let i = 0; i < n; i++) sim.step();
};
/** Deploy at the first free spot (a node's structures stand east of WEST_MARGIN). */
function deploy(sim: Sim): void {
  const p = sim.sector.packet!;
  for (let x = 0; x + p.w <= sim.sector.width; x += 4) {
    for (let y = 2; y + p.h <= sim.sector.height; y += 4) {
      if (placementGapError(sim, { x, y, w: p.w, h: p.h })) continue;
      sim.enqueue({ type: 'sector.deploy', x, y });
      return step(sim);
    }
  }
  throw new Error('no room to deploy');
}
/** Teleport to a node and deploy (the first drop populates it). */
function visit(sim: Sim, node: string): void {
  sim.enqueue({ type: 'debug.galaxyTeleport', node });
  step(sim);
  expect(sim.galaxy.current).toBe(node);
  deploy(sim);
  expect(sim.sector.state).toBe('active');
}
const fresh = (seed: number): Sim => {
  const sim = newGame(seed, content);
  step(sim, 2);
  return sim;
};
const nodesOf = (sim: Sim) => [...galaxyIndex(sim.galaxy).nodes.values()].sort((a, b) => (a.id < b.id ? -1 : 1));
const defKind = (s: { def: string }) => (content.galaxy.structures as Record<string, { kind: string }>)[s.def]!.kind;
/** The first node (by id) with a structure of each kind, or one matching a port predicate. */
const nodeWith = (sim: Sim, want: (n: ReturnType<typeof nodesOf>[number], ports: Port[]) => boolean) => nodesOf(sim).find((n) => want(n, portsAt(sim, n.id)));
const shipsOf = (sim: Sim) => sim.world.query(ShipC).map((id) => ({ id, s: sim.world.get(id, ShipC)! }));
const stations = (sim: Sim) => shipsOf(sim).filter(({ s }) => s.immobile);
const wrecks = (sim: Sim) => shipsOf(sim).filter(({ s }) => s.state === 'wreck');
const signature = (sim: Sim): string => JSON.stringify([
  sim.sector.width, sim.sector.height,
  shipsOf(sim).filter(({ s }) => s.immobile || s.state === 'wreck').map(({ s }) => [s.name, s.state, s.faction, s.x, s.y, s.width, s.height]),
  sim.world.query(AsteroidC).map((id) => { const a = sim.world.get(id, AsteroidC)!; return [a.kind, a.seed, a.x, a.y, a.width, a.height]; }),
]);

/** A world where one node holds a station, an asteroid field, a derelict, a den, and a mining outpost: the first seed that has one of each somewhere near the start. */
function worldWith(seeds: number[], kinds: (n: ReturnType<typeof nodesOf>[number], ports: Port[]) => boolean): { sim: Sim; node: string } {
  for (const seed of seeds) {
    const sim = fresh(seed);
    ensureAround(sim, sim.galaxy.current);
    const node = nodeWith(sim, kinds);
    if (node) return { sim, node: node.id };
  }
  throw new Error('no such node');
}
const SEEDS = [3, 21, 5, 8, 12, 14, 30, 33, 40, 47];

describe('node population: first drop', () => {
  it('a station node gets a real station, crewed, with a trader bound to its port market', () => {
    const { sim, node } = worldWith(SEEDS, (n, ports) => ports.some((p) => p.kind === 'station' || p.kind === 'depot'));
    const port = portsAt(sim, node).find((p) => p.kind === 'station' || p.kind === 'depot')!;
    expect(nodeState(sim, node).populated).toBeUndefined();
    visit(sim, node);
    expect(nodeState(sim, node).populated).toBe(true);
    const st = stations(sim);
    expect(st.length).toBeGreaterThan(0);
    const mine = st.find(({ id }) => sim.world.get(id, TraderC)?.port === port.id)!;
    expect(mine).toBeDefined();
    const t = sim.world.get(mine.id, TraderC)!;
    expect(t.station).toBe(true);
    expect(t.profile).toBe(econOf(sim, port)!.profile);
    expect(liveTrader(sim, port.id)).toBe(mine.id);
    // The station is real: it stands east of the free water the player deployed in, and the sector grew to hold it when it had to.
    expect(mine.s.x).toBeGreaterThanOrEqual(WEST_MARGIN);
    expect(mine.s.x + mine.s.width).toBeLessThanOrEqual(sim.sector.width);
    expect(mine.s.state).toBe('active');
    // A military port is a navy depot, a market is a trading or farming station.
    expect(mine.s.gen?.faction).toBe(port.kind === 'depot' ? 'station.military' : econOf(sim, port)!.profile.replace('trader.', ''));
  });

  it('a station\'s size follows its port: size 1 an outpost, 2 a station', () => {
    const seen = new Set<string>();
    for (const seed of SEEDS.slice(0, 5)) {
      const sim = fresh(seed);
      ensureAround(sim, sim.galaxy.current);
      for (const n of nodesOf(sim)) {
        const p = portsAt(sim, n.id).find((q) => q.kind === 'station' && q.size < 3);
        if (!p || seen.has(String(p.size))) continue;
        seen.add(String(p.size));
        visit(sim, n.id);
        const bound = stations(sim).find(({ id }) => sim.world.get(id, TraderC)?.port === p.id)!;
        expect(bound.s.gen?.role).toBe(p.size === 1 ? 'outpost' : 'station');
      }
      if (seen.size === 2) break;
    }
    expect([...seen].sort()).toEqual(['1', '2']);
  });

  it('asteroid fields become fields, a mining outpost port also gets a surface outpost on a big asteroid', () => {
    const { sim, node } = worldWith(SEEDS, (n, ports) => ports.some((p) => p.kind === 'outpost'));
    visit(sim, node);
    const rocks = sim.world.query(AsteroidC).map((id) => sim.world.get(id, AsteroidC)!);
    expect(rocks.some((a) => a.kind === 'field')).toBe(true);
    expect(rocks.some((a) => a.kind === 'big')).toBe(true);
    const port = portsAt(sim, node).find((p) => p.kind === 'outpost')!;
    const base = shipsOf(sim).find(({ s }) => s.outpost?.kind === 'mining')!;
    expect(base.s.outpost?.style).toBe('surface');
    expect(sim.world.get(base.id, TraderC)?.port).toBe(port.id);
  });

  it('derelicts become wrecks of the node\'s faction; a drone nest is a ruin of the rogue AI', () => {
    const { sim, node } = worldWith(SEEDS, (n) => n.structures.some((s) => defKind(s) === 'derelict'));
    visit(sim, node);
    expect(wrecks(sim).length).toBeGreaterThan(0);
    const w = wrecks(sim)[0]!;
    expect(w.s.gen?.faction).toMatch(/^faction\./);
    // Rogue space (drone nests) is checked over the seeds that have one.
    for (const seed of SEEDS) {
      const s2 = fresh(seed);
      ensureAround(s2, s2.galaxy.current);
      const nest = nodeWith(s2, (_n, ports) => ports.some((p) => p.kind === 'nest'));
      if (!nest) continue;
      visit(s2, nest.id);
      expect(wrecks(s2).some(({ s }) => s.gen?.faction === 'faction.drones')).toBe(true);
      return;
    }
  });

  /** Generate a wide ring of chunks so the far, dangerous territories (pirates, rogue AI) are in the map. */
  const wide = (seed: number): Sim => {
    const sim = fresh(seed);
    for (let cy = -4; cy <= 4; cy++) for (let cx = -4; cx <= 4; cx++) ensureChunk(sim, cx, cy);
    return sim;
  };

  it('a pirate den among rocks is dug into a big asteroid, hidden; otherwise it is an orbital pirate station', () => {
    let dug = 0;
    let orbital = 0;
    for (const seed of SEEDS.slice(0, 4)) {
      const sim = wide(seed);
      for (const n of nodesOf(sim)) {
        const den = portsAt(sim, n.id).find((p) => p.kind === 'den');
        if (!den) continue;
        if (n.structures.some((s) => defKind(s) === 'asteroids') ? dug >= 1 : orbital >= 1) continue;
        visit(sim, n.id);
        const base = stations(sim).find(({ id }) => sim.world.get(id, TraderC)?.port === den.id);
        expect(base, n.id).toBeDefined();
        expect(base!.s.gen?.faction).toBe('station.pirate');
        if (n.structures.some((s) => defKind(s) === 'asteroids')) {
          dug++;
          expect(base!.s.outpost).toMatchObject({ style: 'dug', hidden: true });
        } else {
          orbital++;
          expect(base!.s.outpost).toBeUndefined();
        }
      }
      if (dug && orbital) break;
    }
    expect(dug).toBeGreaterThan(0);
    expect(orbital).toBeGreaterThan(0);
  });

  it('everything stands apart: the gap rule holds and the player had free water west of it', () => {
    const { sim, node } = worldWith(SEEDS, (n) => n.structures.length >= 2);
    visit(sim, node);
    const rects = shipsOf(sim).filter(({ s }) => s.immobile || s.state === 'wreck').map(({ s }) => ({ x: s.x, y: s.y, w: s.width, h: s.height }));
    for (const r of rects) expect(r.x).toBeGreaterThanOrEqual(WEST_MARGIN - 1);
    const me = shipsOf(sim).find(({ s }) => s.faction === 'player')!.s;
    for (const r of rects) expect(me.x + me.width).toBeLessThan(r.x);
  });
});

describe('node population: ownership and determinism', () => {
  it('the archive owns the node after the first visit: returning restores it, never duplicates', () => {
    const { sim, node } = worldWith(SEEDS, (n, ports) => ports.some((p) => p.kind === 'station' || p.kind === 'depot'));
    const other = [...galaxyIndex(sim.galaxy).adjacent.get(node)!].map((e) => (e.a === node ? e.b : e.a)).sort()[0]!;
    visit(sim, node);
    const first = signature(sim);
    const count = shipsOf(sim).length;
    visit(sim, other);
    visit(sim, node);
    expect(shipsOf(sim).length).toBe(count);
    expect(sim.world.query(ShipC).length).toBe(count);
    // The same structures in the same places (the player's own ship may stand elsewhere).
    expect(signature(sim)).toBe(first);
    expect(nodeState(sim, node).populated).toBe(true);
    // The station is bound again on the way back.
    const port = portsAt(sim, node).find((p) => p.kind === 'station' || p.kind === 'depot')!;
    expect(liveTrader(sim, port.id)).toBeDefined();
  });

  it('is deterministic: the same seed gives the same node, whatever was visited before', () => {
    const { sim, node } = worldWith(SEEDS, (n, ports) => ports.length > 0 && n.structures.length >= 2);
    const twin = fresh(sim.seed);
    ensureAround(twin, twin.galaxy.current);
    const detour = nodesOf(twin).find((n) => n.structures.length > 0 && n.id !== node)!;
    visit(twin, detour.id);
    visit(sim, node);
    visit(twin, node);
    expect(signature(twin)).toBe(signature(sim));
  });

  it('survives a save: a populated node is restored once, not populated again', () => {
    const { sim, node } = worldWith(SEEDS, (n, ports) => ports.some((p) => p.kind === 'station' || p.kind === 'depot'));
    const other = [...galaxyIndex(sim.galaxy).adjacent.get(node)!].map((e) => (e.a === node ? e.b : e.a)).sort()[0]!;
    visit(sim, node);
    visit(sim, other);
    const saved = deserialize(JSON.parse(JSON.stringify(serialize(sim))), content);
    visit(saved, node);
    visit(sim, node);
    expect(shipsOf(saved).length).toBe(shipsOf(sim).length);
    expect(stations(saved).length).toBe(stations(sim).length);
  });
});

describe('node population: the market', () => {
  it('a station is the market of its port: it holds the port\'s stock, and what the player trades moves the world economy', () => {
    const { sim, node } = worldWith(SEEDS, (n, ports) => ports.some((p) => p.kind === 'station'));
    const port = portsAt(sim, node).find((p) => p.kind === 'station')!;
    const e = econOf(sim, port)!;
    visit(sim, node);
    const id = liveTrader(sim, port.id)!;
    const t = sim.world.get(id, TraderC)!;
    expect(t.base?.length).toBeGreaterThan(0);
    const metal = t.stock.find((l) => l.item === 'item.metal');
    const was = metal?.count ?? 0;
    // The player's deal takes metal off the shelf and adds scrap.
    if (metal) metal.count -= Math.min(metal.count, 5);
    t.stock.push({ item: 'item.scrap_hull', count: 9 });
    const now = t.stock.find((l) => l.item === 'item.metal')?.count ?? 0;
    // Leave: the port's market in the galaxy shows the change.
    const other = [...galaxyIndex(sim.galaxy).adjacent.get(node)!].map((x) => (x.a === node ? x.b : x.a)).sort()[0]!;
    visit(sim, other);
    expect(liveTrader(sim, port.id)).toBeUndefined();
    expect(stockAt(sim, e, sim.galaxy.turn)['item.metal']).toBeCloseTo(now, 0);
    expect(was).toBeGreaterThanOrEqual(now);
    expect(stockAt(sim, e, sim.galaxy.turn)['item.scrap_hull']).toBeGreaterThanOrEqual(9);
    // An NPC trader docking there afterwards sees the player's change too (one copy of the economy).
    expect(moveStock(sim, e, sim.galaxy.turn, 'item.metal', -1)).toBeLessThanOrEqual(0);
    expect(portOf(sim, port.id)).toBeDefined();
  });
});

describe('the start node', () => {
  it('is not populated by default (tests start in an empty node), and is when asked, clear of the starter ship', () => {
    const plain = newGame(3, content);
    expect(stations(plain).length).toBe(0);
    const sim = newGame(3, content, undefined, true);
    const st = stations(sim);
    expect(st.length).toBeGreaterThan(0);
    const me = shipsOf(sim).find(({ s }) => s.faction === 'player')!.s;
    const start = galaxyIndex(sim.galaxy).nodes.get(sim.galaxy.current)!;
    const wantStation = start.structures.some((s) => defKind(s) === 'station');
    expect(wantStation).toBe(true);
    for (const { s } of shipsOf(sim)) {
      if (s.faction === 'player') continue;
      expect(s.x).toBeGreaterThan(me.x + me.width);
    }
    // The player's own ship was not moved, and the node is marked so it is not populated again by a later visit.
    expect(nodeState(sim, sim.galaxy.current).populated).toBe(true);
    const before = shipsOf(sim).length;
    step(sim, 30);
    expect(shipsOf(sim).length).toBe(before);

  });
});
