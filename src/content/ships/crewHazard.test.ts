import { describe, expect, it } from 'vitest';
import {
  AssignmentC, CrewC, DraftedC, IntentC, InterruptC, HealthC, JobC, ModuleC, NeedsC, PathC, PositionC, PrioritiesC, TaskC, homeShip, newGame,
  shipGrid, Struct, type ContentRegistry, type Sim,
} from '../../sim';
import { auditReservations } from '../../sim/ai/audit';
import { explainCrew } from '../../sim/ai/explain';
import { hazardHolds } from '../../sim/ai/hazard';
import { claimedBed, reserveJob } from '../../sim/ai/task';
import { hazardsHere } from '../../sim/crew/hazard';
import { isSettled } from '../../sim/crew/helpers';
import { SuitC } from '../../sim/eva/components';
import { MoodC } from '../../sim/crew/components';
import { isTileWalkable } from '../../sim/modules/walk';
import { foodOn } from '../../sim/crew/eating';
import { findPath } from '../../sim/crew/pathfind';
import { StorageC } from '../../sim/items/components';
import { storageCount } from '../../sim/items/storage';
import { content } from '../index';

/**
 * Crew AI Phase 3 (docs/CREW_AI.md section 5, TRAITS.md section 5): the `hazard` interrupt walks a crew member off a tile that
 * harms them, unless their task tolerates it, and the leisure drive takes a low-mood crew member with nothing to do on a break.
 */

const colonists = (sim: Sim): number[] => sim.world.query(CrewC).filter((c) => sim.world.has(c, PrioritiesC));
const at = (sim: Sim, id: number): { x: number; y: number } => {
  const p = sim.world.get(id, PositionC)!;
  return { x: p.x, y: p.y };
};

/** Content whose colonists always want a break when idle (the mood thresholds themselves are unit-tested in crewPolicy.test.ts). */
const glum: ContentRegistry = {
  ...content,
  policies: {
    ...content.policies,
    'policy.colonist': {
      ...content.policies['policy.colonist'],
      drives: content.policies['policy.colonist'].drives.map((d) => (d.id === 'leisure' ? { ...d, enter: 1001, exit: 1001 } : d)),
    },
  },
};

/** A settled crew member with nothing on, on the starter ship (no jobs posted). */
function quiet(reg: ContentRegistry = content): { sim: Sim; c: number } {
  const sim = newGame(1, reg, 'ship.starter', false);
  for (let i = 0; i < 40; i++) sim.step();
  const free = colonists(sim).filter((id) => !sim.world.has(id, AssignmentC));
  const c = (free.find((id) => isSettled(sim.world.get(id, PositionC)!)) ?? free[0]) as number;
  expect(c).toBeGreaterThan(0);
  return { sim, c };
}

/** Keep a tile burning (the fire system would otherwise grow or starve it on its own schedule). */
const burn = (sim: Sim, t: { x: number; y: number }): void => shipGrid(sim, homeShip(sim))!.set('fire', t.x, t.y, 200);

describe('hazard interrupt', () => {
  it('walks a crew member off a burning tile to a safe one, and the interrupt lapses there', () => {
    const { sim, c } = quiet();
    const t = at(sim, c);
    burn(sim, t);
    expect(hazardHolds(sim, c)).toBe(true);
    let held = 0;
    for (let i = 0; i < 80; i++) {
      burn(sim, t);
      sim.step();
      if (sim.world.get(c, InterruptC)?.reason === 'hazard') held++;
      expect(auditReservations(sim).problems).toEqual([]);
    }
    expect(held).toBeGreaterThan(0);
    expect(at(sim, c)).not.toEqual(t);
    expect(hazardsHere(sim, c)).toBe(0);
    expect(sim.world.get(c, InterruptC)?.reason).not.toBe('hazard');
    expect(sim.world.get(c, TaskC)?.machine).not.toBe('escape');
    expect(sim.aiLog.interruptMismatches).toBe(0);
  });

  it('wakes a sleeper on a burning tile and walks them off', () => {
    const { sim, c } = quiet();
    sim.world.get(c, NeedsC)!.rest = 5;
    for (let i = 0; i < 400 && sim.world.get(c, CrewC)!.activity !== 'sleeping'; i++) sim.step();
    expect(sim.world.get(c, CrewC)!.activity).toBe('sleeping');
    const t = at(sim, c);
    for (let i = 0; i < 60; i++) {
      burn(sim, t);
      sim.step();
    }
    expect(at(sim, c)).not.toEqual(t);
  });

  it('an escaped sleeper does not go back to the burning bed: they sleep somewhere safe', () => {
    const { sim, c } = quiet();
    sim.world.get(c, NeedsC)!.rest = 5;
    for (let i = 0; i < 400 && sim.world.get(c, CrewC)!.activity !== 'sleeping'; i++) sim.step();
    const t = at(sim, c);
    let back = 0;
    for (let i = 0; i < 600; i++) {
      burn(sim, t);
      sim.step();
      const p = at(sim, c);
      if (i > 60 && p.x === t.x && p.y === t.y) back++;
      const bed = sim.world.get(claimedBed(sim, c), ModuleC);
      if (bed) expect({ x: bed.x, y: bed.y }).not.toEqual(t);
    }
    expect(back).toBe(0);
    expect(sim.world.get(c, CrewC)!.activity).toBe('sleeping');
    expect(hazardsHere(sim, c)).toBe(0);
  });

  it('with no galley, a crate whose nearest side burns is reached from another side', () => {
    const { sim, c } = quiet();
    const ship = homeShip(sim);
    let crate = 0;
    for (const m of sim.world.query(ModuleC)) {
      const mod = sim.world.get(m, ModuleC)!;
      const def = sim.content.modules[mod.def];
      if (def?.galley) mod.enabled = false;
      else if (!crate && def?.storage && sim.world.has(m, StorageC) && foodOn(sim, ship) && storageCount(sim, m, foodOn(sim, ship)!) > 0) crate = m;
    }
    expect(crate).toBeGreaterThan(0);
    const box = sim.world.get(crate, ModuleC)!;
    const near = findPath(sim, ship, at(sim, c), { x: box.x, y: box.y, adjacent: true })!;
    const fire = near[near.length - 1] ?? at(sim, c);
    sim.world.get(c, NeedsC)!.hunger = 5;
    for (let i = 0; i < 600 && sim.world.get(c, CrewC)!.activity !== 'eating'; i++) {
      burn(sim, fire);
      sim.step();
    }
    expect(sim.world.get(c, CrewC)!.activity).toBe('eating');
    expect(at(sim, c)).not.toEqual({ x: fire.x, y: fire.y });
    expect(Math.max(Math.abs(at(sim, c).x - box.x), Math.abs(at(sim, c).y - box.y))).toBe(1);
  });

  it('a walk through a burning tile is obeyed; standing on it is not', () => {
    const { sim, c } = quiet();
    burn(sim, at(sim, c));
    sim.world.get(c, PathC)!.steps = [{ x: at(sim, c).x + 1, y: at(sim, c).y }];
    expect(hazardHolds(sim, c)).toBe(false);
    sim.world.get(c, PathC)!.steps = [];
    expect(hazardHolds(sim, c)).toBe(true);
  });

  it('putting out a fire tolerates fire; any other job does not', () => {
    const { sim, c } = quiet();
    const t = at(sim, c);
    burn(sim, t);
    const ext = sim.world.createEntity();
    sim.world.add(ext, JobC, { kind: 'extinguish', category: 'firefighting', x: t.x, y: t.y, work: 10, progress: 0, reservedBy: 0 } as never);
    reserveJob(sim, c, ext);
    expect(hazardHolds(sim, c)).toBe(false);
    const job = sim.world.get(ext, JobC)!;
    job.kind = 'repair';
    job.category = 'repair';
    expect(hazardHolds(sim, c)).toBe(true);
  });

  it('leaves the job and keeps off it for a while after escaping', () => {
    const { sim, c } = quiet();
    const t = at(sim, c);
    const j = sim.world.createEntity();
    sim.world.add(j, JobC, { kind: 'build', category: 'construction', struct: Struct.Wall, x: t.x + 1, y: t.y, work: 1e6, progress: 0, reservedBy: 0 } as never);
    reserveJob(sim, c, j);
    burn(sim, t);
    for (let i = 0; i < 3; i++) {
      burn(sim, t);
      sim.step();
    }
    expect(sim.world.get(c, AssignmentC)?.jobId).not.toBe(j);
    expect(sim.world.get(j, JobC)?.reservedBy).not.toBe(c);
    expect(sim.world.get(c, IntentC)!.avoid?.job).toBe(j);
    expect(explainCrew(sim, c).avoid?.job).toBe(j); // the inspector shows it
  });

  it('thin air harms only the unsuited: a suited crew member stays', () => {
    const { sim, c } = quiet();
    const t = at(sim, c);
    const grid = shipGrid(sim, homeShip(sim))!;
    grid.set('o2', t.x, t.y, 0);
    expect(hazardHolds(sim, c)).toBe(true);
    sim.world.add(c, SuitC, { worn: true, air: 300 });
    expect(hazardHolds(sim, c)).toBe(false);
  });

  it('a suit with an empty tank still walks the hull back to air', () => {
    const { sim, c } = quiet();
    const grid = shipGrid(sim, homeShip(sim))!;
    // An exterior hull tile with no floor beside it an unsuited crew member could walk to.
    let spot: { x: number; y: number } | null = null;
    for (let y = grid.y0; y < grid.y0 + grid.height && !spot; y++) {
      for (let x = grid.x0; x < grid.x0 + grid.width && !spot; x++) {
        if (isTileWalkable(sim, grid, x, y) || !isTileWalkable(sim, grid, x, y, true)) continue;
        let near = false;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (isTileWalkable(sim, grid, x + dx, y + dy)) near = true;
        if (!near) spot = { x, y };
      }
    }
    expect(spot).not.toBeNull();
    sim.world.add(c, SuitC, { worn: true, air: 0 });
    Object.assign(sim.world.get(c, PositionC)!, { x: spot!.x, y: spot!.y, toX: spot!.x, toY: spot!.y, progress: 0 });
    sim.world.get(c, PathC)!.steps = [];
    expect(hazardHolds(sim, c)).toBe(true);
    for (let i = 0; i < 1000 && hazardsHere(sim, c) !== 0; i++) {
      sim.world.get(c, HealthC)!.hp = 100; // the test is about the route, not the vacuum's harm on a long hull walk
      sim.step();
    }
    expect(hazardsHere(sim, c)).toBe(0);
    expect(isTileWalkable(sim, grid, at(sim, c).x, at(sim, c).y)).toBe(true);
  });

  it('a drafted crew member standing on fire is stepped off and keeps the draft', () => {
    const { sim, c } = quiet();
    sim.world.add(c, DraftedC, { target: null });
    const t = at(sim, c);
    for (let i = 0; i < 40; i++) {
      burn(sim, t);
      sim.step();
    }
    expect(sim.world.has(c, DraftedC)).toBe(true);
    expect(at(sim, c)).not.toEqual(t);
  });
});

describe('leisure drive', () => {
  it('a low-mood crew member with nothing to do takes a break and comes back happier', () => {
    const { sim, c } = quiet(glum);
    const mood = (): { value: number; relax?: number; factors: { key: string }[] } => sim.world.get(c, MoodC)!;
    let breaks = 0;
    for (let i = 0; i < 1200; i++) {
      sim.step();
      if (sim.world.get(c, TaskC)?.machine === 'leisure') breaks++;
      if (mood().relax) break;
    }
    expect(breaks).toBeGreaterThan(0);
    expect(explainCrew(sim, c)).toMatchObject({ latched: ['leisure'], scores: { leisure: 90, work: 100 } });
    expect(mood().relax).toBeGreaterThan(0);
    for (let i = 0; i < 20; i++) sim.step(); // the next mood pass counts it
    expect(mood().factors.map((f) => f.key)).toContain('relaxed');
  });

  it('never keeps anyone from work: an open job ends the break', () => {
    const { sim, c } = quiet(glum);
    for (let i = 0; i < 400 && sim.world.get(c, TaskC)?.machine !== 'leisure'; i++) sim.step();
    expect(sim.world.get(c, TaskC)?.machine).toBe('leisure');
    const t = at(sim, c);
    const j = sim.world.createEntity();
    sim.world.add(j, JobC, { kind: 'build', category: 'construction', struct: Struct.Wall, x: t.x + 1, y: t.y, work: 1e6, progress: 0, reservedBy: 0 } as never);
    for (let i = 0; i < 25; i++) sim.step();
    expect(sim.world.get(j, JobC)!.reservedBy).not.toBe(0);
    expect(sim.world.get(c, TaskC)?.machine).not.toBe('leisure');
  });
});
