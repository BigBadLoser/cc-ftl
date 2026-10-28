import { describe, expect, it } from 'vitest';
import {
  CombatC, FTL_CHARGE_SEC, ShipC, truceHolds, START_NODE, TraderC, contrabandAboard, galaxyIndex, newGame, passingMeets, playerShip, portsAt, storageAdd, type Sim,
} from '../sim';
import type { Fleet } from '../sim/galaxy/types';
import { ensureChunk, nodeState } from '../sim/galaxy/state';
import { placementGapError } from '../sim/regions';
import { isMarket } from '../sim/galaxy/populateSpawn';
import { giveItems } from '../sim/story/effects';
import { playerStorages } from '../sim/story/world';
import { reputationOf } from '../sim/story/state';
import { content } from '.';

const step = (sim: Sim, n = 1): void => {
  for (let i = 0; i < n; i++) sim.step();
};
const adjacent = (sim: Sim, id: string): string[] => (galaxyIndex(sim.galaxy).adjacent.get(id) ?? []).map((e) => (e.a === id ? e.b : e.a)).sort();

/** The player flies two hops with `items` in the hold; a fleet at the first node flies the other way and crosses them there. */
function crossing(faction: string, role: Fleet['role'], hold: Record<string, number>, truce = false) {
  const sim = newGame(3, content);
  sim.story.goals.skipped = true;
  sim.galaxy.fleets = [];
  giveItems(sim, 'item.fuel', 50);
  for (const [item, n] of Object.entries(hold)) storageAdd(sim, playerStorages(sim)[0] as number, item, n);
  const c = sim.world.get(playerShip(sim), CombatC);
  if (c) c.ftl = FTL_CHARGE_SEC;
  const to = adjacent(sim, START_NODE)[0] as string;
  const next = adjacent(sim, to).find((n) => n !== START_NODE) ?? START_NODE;
  if (truce) nodeState(sim, to).truce = {};
  sim.enqueue({ type: 'galaxy.jump', ship: playerShip(sim), route: [to, next] });
  const g = sim.galaxy;
  while (!passingMeets(sim, g.nextFleet, g.turn + 1)) g.nextFleet++;
  const f: Fleet = {
    id: g.nextFleet++, faction, role, ships: [{ id: g.nextFleet++, faction, shipgen: faction === 'pirates' ? 'faction.scrapper' : 'faction.navy', seed: 77, depth: 1, since: 0 }],
    node: to, from: to, moved: -1, route: [START_NODE], dest: START_NODE, dwell: 0, legs: 0, home: `${START_NODE}#0`, synced: g.turn, ...{},
  };
  g.fleets.push(f);
  step(sim);
  while (sim.galaxy.travel?.phase === 'hop' || sim.galaxy.travel?.phase === 'story') {
    step(sim);
    sim.story.active = null;
  }
  return { sim, enc: g.encounters[0] };
}

describe('patrol scans and the truce on the way', () => {
  it('a navy patrol that scans a ship carrying contraband makes it choose; the goods are in the packet in hyperspace and are taken from it', () => {
    const { sim, enc } = crossing('navy', 'patrol', { 'item.stolen_goods': 6 });
    expect(enc?.kind).toBe('scan');
    expect(enc?.scan?.value).toBe(6 * content.items['item.stolen_goods'].price);
    expect(contrabandAboard(sim)).toEqual([{ item: 'item.stolen_goods', count: 6 }]);
    const navy = reputationOf(sim.story, 'navy');
    sim.enqueue({ type: 'galaxy.respond', encounter: enc!.id, choice: 'surrender' });
    step(sim);
    expect(contrabandAboard(sim)).toEqual([]);
    expect(reputationOf(sim.story, 'navy')).toBeLessThan(navy);
  });

  it('a scan that finds nothing is an ordinary acknowledge, and a pirate patrol never enforces', () => {
    const clean = crossing('navy', 'patrol', {});
    expect(clean.enc?.kind).toBe('scan');
    expect(clean.enc?.scan).toBeUndefined();
    const dirty = crossing('pirates', 'patrol', { 'item.stolen_goods': 6 });
    expect(dirty.enc?.scan).toBeUndefined();
  });

  it('no interdiction is made at a node whose truce holds', () => {
    const open = crossing('pirates', 'pirate', {});
    expect(open.enc?.kind).toBe('interdict');
    const calm = crossing('pirates', 'pirate', {}, true);
    expect(calm.enc).toBeUndefined();
  });
});

describe('lesser services on the galaxy', () => {
  function deployAt(sim: Sim): void {
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
  function visit(sim: Sim, node: string): void {
    sim.enqueue({ type: 'debug.galaxyTeleport', node });
    step(sim);
    deployAt(sim);
  }

  it('about a quarter of pirate dens are markets, by a seeded roll; a market has the truce and a plain den stays hostile', () => {
    let markets = 0;
    let plain = 0;
    for (const seed of [11, 12, 13, 14]) {
      const sim = newGame(seed, content);
      step(sim, 2);
      for (let cy = -4; cy <= 4; cy++) for (let cx = -4; cx <= 4; cx++) ensureChunk(sim, cx, cy);
      const nodes = [...galaxyIndex(sim.galaxy).nodes.values()].sort((a, b) => (a.id < b.id ? -1 : 1));
      for (const n of nodes) {
        const den = portsAt(sim, n.id).find((p) => p.kind === 'den');
        if (!den || markets + plain >= 14) continue;
        visit(sim, n.id);
        const t = sim.world.query(TraderC).map((id) => ({ id, t: sim.world.get(id, TraderC)! })).find((x) => x.t.port === den.id);
        if (!t) continue;
        if (t.t.services) {
          markets++;
          expect(t.t.services).toEqual(['bm.lesser']);
          expect(t.t.fence).toBeUndefined();
          expect(sim.galaxy.nodes[n.id]?.truce).toBeDefined();
          expect(truceHolds(sim)).toBe(true);
        } else {
          plain++;
          expect(sim.galaxy.nodes[n.id]?.truce).toBeUndefined();
          expect(sim.world.get(t.id, ShipC)!.faction).toBe('hostile');
        }
      }
    }
    expect(markets).toBeGreaterThan(0);
    expect(plain).toBeGreaterThan(markets);
    expect(markets / (markets + plain)).toBeLessThan(0.5);
  });

  it('the roll is deterministic', () => {
    const run = () => {
      const sim = newGame(11, content);
      step(sim, 2);
      return [3, 9, 27, 81].map((n) => isMarket(sim, n));
    };
    expect(run()).toEqual(run());
  });
});
