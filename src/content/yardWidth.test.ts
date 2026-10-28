import { describe, expect, it } from 'vitest';
import { HullPlanC, ShipC, planFootprint, brushPlan, cutPlan, plannedTiles, planViolations, quoteYard, touchesShip } from '../sim';
import { newViolations, hullFootprint } from '../sim/yard/width';
import { outline, planHull, rect, run, yardGame } from './yardFixture';

/** The hull starts one row below the ship's rectangle, so a block ending at row 0 touches it. */
const top = (h: number): number => 1 - h;


describe('hull plan: the 3-wide rule', () => {
  it('hull.plan takes a 3-wide block and refuses a 2-wide stub', () => {
    const { sim, me } = yardGame();
    sim.enqueue({ type: 'hull.plan', ship: me, tiles: outline(sim, me, 4, top(6), 2, 6) });
    expect(run(sim, 1)).toEqual(['rejected:hull.plan:narrowHull']);
    expect(plannedTiles(sim, me)).toHaveLength(0);
    sim.enqueue({ type: 'hull.plan', ship: me, tiles: outline(sim, me, 4, top(6), 3, 6) });
    expect(run(sim, 1)).toEqual([]);
    expect(plannedTiles(sim, me).length).toBeGreaterThan(0);
    sim.enqueue({ type: 'hull.plan', ship: me, tiles: [] }); // clearing is always allowed
    expect(run(sim, 1)).toEqual([]);
    expect(plannedTiles(sim, me)).toHaveLength(0);
  });

  it('a replan that leaves a 2-wide neck between two blocks is refused', () => {
    const { sim, me } = yardGame();
    planHull(sim, me, outline(sim, me, 2, top(8), 8, 8));
    const before = plannedTiles(sim, me).length;
    // cut the block down to two 3-wide columns joined by a 2-wide neck: erase through brushPlan, then send it
    const cut = brushPlan(sim, me, 'erase', [...rect(sim, me, 5, top(8), 2, 5)]);
    expect(cut.error).toBe(null); // a 3 | 2 | 3 split is fine as long as nothing is left narrower than 3
    const bad = brushPlan(sim, me, 'erase', [...rect(sim, me, 4, top(8), 4, 5)]);
    expect(bad.error).toBe('narrowHull');
    expect(bad.bad.length).toBeGreaterThan(0);
    sim.enqueue({ type: 'hull.plan', ship: me, tiles: bad.outline });
    expect(run(sim, 1)).toEqual(['rejected:hull.plan:narrowHull']);
    expect(plannedTiles(sim, me)).toHaveLength(before);
  });

  it('beams do not count: a truss strip beside the ship breaks nothing, and its tiles are not hull', () => {
    const { sim, me } = yardGame();
    const s = sim.world.get(me, ShipC)!;
    for (let i = 0; i < 6; i++) sim.enqueue({ type: 'debug.setStruct', ship: me, x: s.x + 3 + i, y: s.y, kind: 4 });
    sim.step();
    expect(newViolations(hullFootprint(sim, me), [])).toEqual([]);
    planHull(sim, me, outline(sim, me, 2, top(6), 8, 6));
    expect(planViolations(sim, me, plannedTiles(sim, me))).toEqual([]);
  });

  it('the yard refuses to quote a plan with a narrow part, and says why', () => {
    const { sim, station, me } = yardGame();
    planHull(sim, me, outline(sim, me, 2, top(6), 8, 6));
    expect(quoteYard(sim, station, me).error).toBe(null);
    // slip a narrow spur past the command (an old save) and the quote refuses
    const plan = sim.world.get(me, HullPlanC)!;
    plan.tiles = [...plan.tiles, ...rect(sim, me, 12, top(6), 2, 6)];
    expect(planViolations(sim, me, plannedTiles(sim, me)).length).toBeGreaterThan(0);
    expect(quoteYard(sim, station, me).error).toBe('narrowHull');
  });
});

describe('yard partial builds keep the ship valid', () => {
  for (const size of ['station', 'hub'] as const) {
    it(`${size}: whatever the cap cuts off, the ship stays at least 3 wide (or the yard says it cannot)`, () => {
      const { sim, station, me } = yardGame(size);
      const hull = hullFootprint(sim, me);
      let built = 0;
      let refused = 0;
      for (const [x, w, h] of [[2, 3, 3], [2, 12, 3], [2, 12, 4], [0, 20, 5], [4, 9, 9], [1, 25, 12], [6, 5, 14], [0, 30, 6], [3, 10, 20], [-4, 11, 10], [-6, 10, 6], [-2, 6, 12], [-5, 9, 5]] as const) {
        const tiles = outline(sim, me, x, top(h), w, h);
        sim.enqueue({ type: 'hull.plan', ship: me, tiles });
        sim.step();
        sim.events.drain();
        if (plannedTiles(sim, me).length === 0) continue;
        const q = quoteYard(sim, station, me);
        if (q.error) {
          expect(['narrowCut', 'notAdjacent', 'crowded'], `${w}x${h}: ${q.error}`).toContain(q.error);
          refused++;
          continue;
        }
        built++;
        expect(newViolations(hull, [...q.walls, ...q.floor]), `${size} ${w}x${h} cap ${q.cap}`).toEqual([]);
      }
      expect(built).toBeGreaterThan(0);
      expect(refused).toBeLessThan(13);
    });
  }
});

describe('yard partial builds on brush-made plans', () => {
  it('random rectangle and staircase plans: every visit leaves the ship valid (a deterministic search, 60 plans)', () => {
    const { sim, station, me } = yardGame('station');
    const s = sim.world.get(me, ShipC)!;
    const hull = hullFootprint(sim, me);
    let seed = 12345;
    const rnd = (n: number): number => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed % n;
    };
    const send = (tiles: { x: number; y: number }[]): void => {
      sim.enqueue({ type: 'hull.plan', ship: me, tiles });
      sim.step();
      sim.events.drain();
    };
    let quoted = 0;
    for (let trial = 0; trial < 60; trial++) {
      send([]);
      for (let k = 0; k < 2 + rnd(3); k++) {
        const w = 3 + rnd(8), h = 3 + rnd(8), x = -4 + rnd(30), y = 1 - h - rnd(4);
        const r = brushPlan(sim, me, 'add', rect(sim, me, x, y, w, h));
        if (!r.error && !r.unchanged) send(r.outline);
        if (rnd(2)) { // a staircase cut off a corner of that block
          const n = 2 + rnd(3), sx = rnd(2) ? 1 : -1, sy = rnd(2) ? 1 : -1, ax = x + (sx > 0 ? 0 : w - 1), ay = y + (sy > 0 ? 0 : h - 1);
          const tri = [];
          for (let i = 0; i < n; i++) for (let j = 0; i + j < n; j++) tri.push({ x: s.x + ax + i * sx, y: s.y + ay + j * sy });
          const e = brushPlan(sim, me, 'erase', tri);
          if (!e.error && !e.unchanged) send(e.outline);
        }
      }
      if (plannedTiles(sim, me).length === 0) continue;
      const q = quoteYard(sim, station, me);
      if (q.error) {
        expect(['narrowCut', 'notAdjacent', 'crowded']).toContain(q.error);
        continue;
      }
      quoted++;
      expect(newViolations(hull, [...q.walls, ...q.floor]), `trial ${trial}`).toEqual([]);
    }
    expect(quoted).toBeGreaterThan(10);
  });
});

describe('hull plan brushes: connection, erase and cut', () => {
  const key = (t: { x: number; y: number }): string => `${t.x},${t.y}`;
  const send = (sim: Parameters<typeof planHull>[0], me: number, tiles: { x: number; y: number }[]): void => planHull(sim, me, tiles);

  it('a rectangle has to touch the ship or the connected plan', () => {
    const { sim, me } = yardGame();
    expect(touchesShip(sim, me, rect(sim, me, 4, top(3), 3, 3))).toBe(true); // against the hull's top edge
    expect(touchesShip(sim, me, rect(sim, me, 4, top(3) - 6, 3, 3))).toBe(false); // floating in space
    send(sim, me, outline(sim, me, 4, top(4), 4, 4));
    expect(touchesShip(sim, me, rect(sim, me, 4, top(4) - 3, 3, 3))).toBe(true); // against the planned block, which is connected
    expect(touchesShip(sim, me, rect(sim, me, 20, top(4) - 3, 3, 3))).toBe(false);
  });

  it('erase only ever takes planned tiles: a stroke over the hull leaves the hull alone', () => {
    const { sim, me } = yardGame();
    send(sim, me, outline(sim, me, 4, top(6), 6, 6));
    const before = plannedTiles(sim, me).length;
    const s = sim.world.get(me, ShipC)!;
    const r = brushPlan(sim, me, 'erase', rect(sim, me, 3, top(6) + 3, 8, 12)); // half over the plan, half over the ship
    const grid = sim.sector.grid;
    for (const t of [...r.outline, ...r.footprint, ...r.removed]) expect(grid.get('struct', t.x, t.y), `${t.x},${t.y}`).toBe(0); // open space only
    expect(r.removed.length).toBeGreaterThan(0);
    expect(r.outline.length).toBeLessThan(before + 1);
    expect(grid.get('struct', s.x + 5, s.y + 5)).not.toBe(0);
  });

  it('a line cuts off what is not connected to the ship, and keeps the line as the new edge', () => {
    const { sim, me } = yardGame();
    send(sim, me, outline(sim, me, 4, top(9), 8, 9)); // 8 wide, 9 deep, touching the hull
    const s = sim.world.get(me, ShipC)!;
    const row = (dy: number): { x: number; y: number }[] => Array.from({ length: 12 }, (_, i) => ({ x: s.x + 2 + i, y: s.y + dy }));
    const r = cutPlan(sim, me, row(top(9) + 3)); // across the block, 3 rows from its far end
    expect(r.error).toBe(null);
    expect(r.unchanged).toBe(false);
    expect(r.removed).toHaveLength(8 * 3); // the three rows beyond the line
    const kept = new Set(r.footprint.map(key));
    expect(kept.has(key({ x: s.x + 5, y: s.y + top(9) + 3 }))).toBe(true); // the line's own tiles stay
    expect(kept.has(key({ x: s.x + 5, y: s.y + top(9) + 2 }))).toBe(false);
    send(sim, me, r.outline);
    expect(planViolations(sim, me, plannedTiles(sim, me))).toEqual([]);
  });

  it('a line that cuts nothing off, or lies off the plan, changes nothing', () => {
    const { sim, me } = yardGame();
    send(sim, me, outline(sim, me, 4, top(6), 8, 6));
    const s = sim.world.get(me, ShipC)!;
    const along = Array.from({ length: 6 }, (_, i) => ({ x: s.x + 8, y: s.y + top(6) + i })); // a vertical line: both halves still touch the hull
    expect(cutPlan(sim, me, along).unchanged).toBe(true);
    const away = Array.from({ length: 6 }, (_, i) => ({ x: s.x + 30 + i, y: s.y - 20 }));
    expect(cutPlan(sim, me, away).unchanged).toBe(true);
  });

  it('the preview footprint of an add is exactly the plan that applying it leaves', () => {
    const { sim, me } = yardGame();
    send(sim, me, outline(sim, me, 4, top(5), 5, 5));
    const r = brushPlan(sim, me, 'add', rect(sim, me, 7, top(6), 5, 6)); // merges with the planned block and the hull
    expect(r.error).toBe(null);
    send(sim, me, r.outline);
    const applied = planFootprint(sim, plannedTiles(sim, me)).map(key).sort();
    expect(r.footprint.map(key).sort()).toEqual(applied);
    expect(r.footprint.length).toBeGreaterThan(plannedTiles(sim, me).length); // the interior (floor) is part of it
  });

  it('a line cut keeps the side joined to the ship and drops the cut-off side', () => {
    const { sim, me } = yardGame();
    send(sim, me, outline(sim, me, 4, top(8), 6, 8));
    const s = sim.world.get(me, ShipC)!;
    const y = s.y + top(8) + 4;
    const r = cutPlan(sim, me, Array.from({ length: 10 }, (_, i) => ({ x: s.x + 2 + i, y })));
    const kept = new Set(r.footprint.map(key));
    expect(kept.has(key({ x: s.x + 6, y: y + 2 }))).toBe(true); // the ship's side
    expect(kept.has(key({ x: s.x + 6, y: y - 2 }))).toBe(false); // cut off
    expect(r.removed.every((t) => t.y < y)).toBe(true);
  });
});
