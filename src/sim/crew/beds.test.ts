import { describe, expect, it } from 'vitest';
import { stampShip } from '../combat/ships';
import { ModuleC } from '../modules/components';
import { removeModule } from '../modules/spawn';
import type { ContentRegistry, ModuleDef } from '../registry';
import { deserialize, serialize } from '../save';
import { spawnTemplateModules } from '../ship';
import { Sim } from '../sim';
import { CREW_MAX_HP } from '../tuning';
import { findFreeBed } from './beds';
import {
  BedClaimC, BedOwnerC, CrewC, HealthC, NeedsC, PathC, PositionC, PrioritiesC, type Priorities,
} from './components';
import { killCrew } from './death';
import { findPath } from './pathfind';

const mod = (o: Partial<ModuleDef>): ModuleDef => ({
  name: 'm', asset: 'm', footprint: [1, 1], solid: false, power: 0, flammability: 0.1, maxHp: 100, buildWork: 40, ...o,
});
const content: ContentRegistry = {
  ships: {},
  roles: {},
  species: {
    'species.human': { name: 'H', moveSpeed: 2.5, workSpeed: 1, restDecay: 0.6 },
    'species.bot': { name: 'B', moveSpeed: 2.5, workSpeed: 1, restDecay: 0.6, charge: { drainPerSec: 0.1, busyMult: 2, lowBelow: 20 } },
  },
  modules: { bed: mod({ bed: true }) },
  crewNames: [],
  items: {},
  recipes: {},
  structCosts: {},
};
const none: Priorities = {
  firefighting: 0, medical: 0, operating: 0, repair: 0, construction: 0, hauling: 0, refining: 0, crafting: 0, research: 0, cooking: 0, patrol: 0,
};
const ROOM = ['__________', '__________', '__________', '__________', '__________'];

function make(rows: string[], beds: [number, number][]): Sim {
  const sim = new Sim(2, content);
  stampShip(sim, { name: 't', rows }, { faction: 'player', state: 'prize', x: 0, y: 0 });
  spawnTemplateModules(sim, 1, { name: 't', rows, modules: beds.map(([x, y]) => ({ def: 'bed', x, y, rot: 0 })) });
  return sim;
}
function crew(sim: Sim, x: number, y: number, rest = 100, species = 'species.human'): number {
  const id = sim.world.createEntity();
  sim.world.add(id, CrewC, { name: 'T', role: 'r', species, appearanceSeed: 1, activity: 'idle' });
  sim.world.add(id, PositionC, { x, y, toX: x, toY: y, progress: 0, facing: 0 });
  sim.world.add(id, PathC, { steps: [] });
  sim.world.add(id, PrioritiesC, { ...none });
  sim.world.add(id, NeedsC, { rest });
  sim.world.add(id, HealthC, { hp: CREW_MAX_HP, max: CREW_MAX_HP });
  return id;
}
const run = (sim: Sim, n: number): void => { for (let i = 0; i < n; i++) sim.step(); };
const beds = (sim: Sim): number[] => sim.world.query(ModuleC).filter((i) => sim.content.modules[sim.world.get(i, ModuleC)!.def]?.bed);
const ownerOf = (sim: Sim, id: number): number | undefined => sim.world.get(id, BedOwnerC)?.bed;
const bedAt = (sim: Sim, x: number, y: number): number => beds(sim).find((b) => sim.world.get(b, ModuleC)!.x === x && sim.world.get(b, ModuleC)!.y === y) as number;

describe('bed ownership', () => {
  it('assigns the nearest unowned bed, ties to the lowest bed id, the same every time', () => {
    const owners = (): (number | undefined)[] => {
      const sim = make(ROOM, [[0, 0], [9, 4], [5, 2]]);
      const ids = [crew(sim, 8, 4), crew(sim, 1, 0), crew(sim, 5, 4)];
      run(sim, 21);
      return ids.map((i) => ownerOf(sim, i));
    };
    const sim = make(ROOM, [[0, 0], [9, 4], [5, 2]]);
    const [near0, near9, near5] = [bedAt(sim, 0, 0), bedAt(sim, 9, 4), bedAt(sim, 5, 2)];
    const a = crew(sim, 8, 4), b = crew(sim, 1, 0), c = crew(sim, 5, 4);
    run(sim, 21);
    expect([ownerOf(sim, a), ownerOf(sim, b), ownerOf(sim, c)]).toEqual([near9, near0, near5]);
    expect(owners()).toEqual(owners());
    // a tie goes to the lowest bed id
    const t = make(ROOM, [[2, 0], [4, 0]]);
    const x = crew(t, 3, 0);
    run(t, 21);
    expect(ownerOf(t, x)).toBe(bedAt(t, 2, 0));
  });

  it('gives robots no bed', () => {
    const sim = make(ROOM, [[2, 0]]);
    const r = crew(sim, 3, 0, 100, 'species.bot');
    run(sim, 41);
    expect(sim.world.has(r, BedOwnerC)).toBe(false);
  });

  it('clears the owner when the bed is removed, and the next pass reassigns', () => {
    const sim = make(ROOM, [[2, 0], [9, 4]]);
    const a = crew(sim, 3, 0);
    run(sim, 21);
    const first = bedAt(sim, 2, 0);
    expect(ownerOf(sim, a)).toBe(first);
    removeModule(sim, first);
    expect(sim.world.has(a, BedOwnerC)).toBe(false);
    run(sim, 20);
    expect(ownerOf(sim, a)).toBe(bedAt(sim, 9, 4));
  });

  it('clears the owner when the bed is wrecked', () => {
    const sim = make(ROOM, [[2, 0]]);
    const a = crew(sim, 3, 0);
    run(sim, 21);
    sim.world.get(bedAt(sim, 2, 0), ModuleC)!.hp = 0;
    run(sim, 20);
    expect(sim.world.has(a, BedOwnerC)).toBe(false);
  });

  it('frees the bed when the owner dies, and another crew member takes it', () => {
    const sim = make(ROOM, [[2, 0]]);
    const a = crew(sim, 3, 0);
    const b = crew(sim, 6, 4);
    run(sim, 21);
    expect(ownerOf(sim, a)).toBeDefined();
    expect(sim.world.has(b, BedOwnerC)).toBe(false);
    killCrew(sim, a);
    expect(sim.world.has(a, BedOwnerC)).toBe(false);
    run(sim, 20);
    expect(ownerOf(sim, b)).toBe(bedAt(sim, 2, 0));
  });

  it('lets a tired crew member sleep in their own bed, not a nearer one', () => {
    const sim = make(ROOM, [[0, 0], [9, 4]]);
    const a = crew(sim, 8, 4); // owns (9,4)
    const b = crew(sim, 1, 0); // owns (0,0)
    run(sim, 21);
    sim.world.get(a, NeedsC)!.rest = 5;
    sim.world.get(b, NeedsC)!.rest = 5;
    // move a next to the other bed: its own is now farther, but still its own
    const p = sim.world.get(a, PositionC)!;
    Object.assign(p, { x: 2, y: 0, toX: 2, toY: 0 });
    run(sim, 8);
    expect(sim.world.get(a, BedClaimC)?.bed).toBe(bedAt(sim, 9, 4));
    expect(sim.world.get(b, BedClaimC)?.bed).toBe(bedAt(sim, 0, 0));
  });

  it('falls back to a shared bed when the owned bed is unreachable', () => {
    const rows = ['____#____', '____#____', '____#____'];
    const sim = make(rows, [[2, 1], [7, 1]]);
    const a = crew(sim, 3, 1);
    run(sim, 21);
    expect(ownerOf(sim, a)).toBe(bedAt(sim, 2, 1));
    // the owned bed is taken by someone else, so the shared search runs
    sim.world.get(bedAt(sim, 2, 1), ModuleC)!.reservedBy = 999;
    sim.world.get(a, NeedsC)!.rest = 5;
    run(sim, 8);
    // (7,1) is behind the wall: unreachable, so the crew member sleeps on the floor
    expect(sim.world.has(a, BedClaimC)).toBe(false);
    const open = make(['_________', '_________', '_________'], [[2, 1], [7, 1]]);
    const b = crew(open, 3, 1);
    run(open, 21);
    open.world.get(bedAt(open, 2, 1), ModuleC)!.reservedBy = 999;
    open.world.get(b, NeedsC)!.rest = 5;
    run(open, 8);
    expect(open.world.get(b, BedClaimC)?.bed).toBe(bedAt(open, 7, 1));
  });

  it('delays the sleep decision by under 4 ticks, differently per crew member', () => {
    const sim = make(ROOM, [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0], [7, 0]]);
    const ids = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => crew(sim, i, 2));
    run(sim, 21);
    for (const id of ids) sim.world.get(id, NeedsC)!.rest = 10;
    const at = new Map<number, number>();
    for (let t = 1; t <= 6; t++) {
      sim.step();
      for (const id of ids) if (!at.has(id) && sim.world.has(id, BedClaimC)) at.set(id, t);
    }
    expect(at.size).toBe(ids.length);
    const delays = [...at.values()];
    expect(Math.max(...delays)).toBeLessThanOrEqual(4); // the first step is tick 1, so at most 3 ticks of waiting
    expect(new Set(delays).size).toBeGreaterThan(1);
  });

  it('save and load mid-assignment and mid-sleep keeps the run identical', () => {
    const sim = make(ROOM, [[0, 0], [9, 4], [5, 2]]);
    crew(sim, 8, 4, 12);
    crew(sim, 1, 0, 30);
    crew(sim, 5, 4, 100);
    for (const stop of [10, 25, 60]) {
      run(sim, stop === 10 ? 10 : stop === 25 ? 15 : 35);
      const copy = deserialize(serialize(sim), content);
      expect(serialize(copy)).toBe(serialize(sim));
      run(sim, 80);
      run(copy, 80);
      expect(serialize(copy)).toBe(serialize(sim));
    }
  });
});

describe('findFreeBed early stop', () => {
  function lcg(seed: number): () => number {
    let s = seed >>> 0;
    return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  }
  it('returns the same bed and path as trying every bed, over random layouts', () => {
    const rand = lcg(77);
    let compared = 0;
    for (let n = 0; n < 60; n++) {
      const w = 8 + Math.floor(rand() * 10), h = 5 + Math.floor(rand() * 8);
      const rows: string[] = [];
      for (let y = 0; y < h; y++) {
        let r = '';
        for (let x = 0; x < w; x++) r += rand() < 0.25 ? '#' : '_';
        rows.push(r);
      }
      const open: [number, number][] = [];
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (rows[y]![x] === '_') open.push([x, y]);
      if (open.length < 8) continue;
      const bedTiles = open.filter(() => rand() < 0.3);
      const sim = make(rows, bedTiles);
      for (const b of beds(sim)) if (rand() < 0.2) sim.world.get(b, ModuleC)!.reservedBy = 5;
      for (let k = 0; k < 8; k++) {
        const from = (open[Math.floor(rand() * open.length)]) as [number, number];
        for (const adjacent of [false, true]) {
          let best: { bed: number; steps: number } | null = null;
          for (const b of beds(sim)) {
            const m = sim.world.get(b, ModuleC)!;
            if (m.reservedBy !== 0) continue;
            const p = findPath(sim, 1, { x: from[0], y: from[1] }, { x: m.x, y: m.y, adjacent });
            if (p && (!best || p.length < best.steps)) best = { bed: b, steps: p.length };
          }
          const got = findFreeBed(sim, 1, { x: from[0], y: from[1] }, adjacent);
          expect(got ? { bed: got.bed, steps: got.steps.length } : null).toEqual(best);
          compared++;
        }
      }
    }
    expect(compared).toBeGreaterThan(200);
  });
});
