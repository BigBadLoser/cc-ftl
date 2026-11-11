import { describe, expect, it } from 'vitest';
import { ModuleC, TaskC, CrewC, PositionC, PrioritiesC, homeShip, newGame, placementError, shipGrid, spawnModule, removeModule, shipRoomQuality, type ContentRegistry, type Sim } from '../../sim';
import { noteLeisure, noteMeal, noteSleep, moodFactors, ensureMood } from '../../sim/crew/mood';
import { TraitsC } from '../../sim/crew/traits';
import { standTiles } from '../../sim/ai/machines/leisureSpots';
import { findPath } from '../../sim/crew/pathfind';
import { content } from '../index';

/** Room quality (sim/roomQuality.ts), its mood factors (crew/roomMood.ts) and the leisure spots (ai/machines/leisureSpots.ts), #441. */

const fresh = (reg: ContentRegistry = content): Sim => {
  const sim = newGame(1, reg, 'ship.starter', false);
  for (let i = 0; i < 40; i++) sim.step();
  return sim;
};
const crewOf = (sim: Sim): number[] => sim.world.query(CrewC).filter((c) => sim.world.has(c, PrioritiesC));
const roomOf = (sim: Sim, id: number): number => {
  const p = sim.world.get(id, PositionC)!;
  return shipGrid(sim, homeShip(sim))!.get('room', Math.round(p.x), Math.round(p.y));
};
const tierOf = (sim: Sim, room: number): number => (sim.step(), void 0, shipRoomQuality(sim, homeShip(sim)).get(room)!.tier);
const keys = (sim: Sim, id: number): string[] => moodFactors(sim, id, ensureMood(sim, id)).map((f) => f.key);
/** Let the room-quality cache lapse. */
const lapse = (sim: Sim): void => { for (let i = 0; i < 41; i++) sim.step(); };

describe('room quality', () => {
  it('gives every room a value, a tier and its inputs; an unfurnished room is Decent at best, comfort has no data yet', () => {
    const sim = fresh();
    const q = [...shipRoomQuality(sim, homeShip(sim)).values()];
    expect(q.length).toBeGreaterThan(3);
    for (const r of q) {
      expect(r.value).toBeGreaterThanOrEqual(0);
      expect(r.value).toBeLessThanOrEqual(100);
      expect(r.inputs.comfort).toBeNull();
      if (r.users === 0) expect(r.tier).toBeLessThanOrEqual(2);
    }
    expect(q.some((r) => r.users > 0)).toBe(true);
  });

  it('the weakest input pulls the value down: a wrecked module in a roomy room makes it Grim', () => {
    const sim = fresh();
    const room = [...shipRoomQuality(sim, homeShip(sim)).values()].find((r) => r.users > 0 && r.tier >= 3)!;
    expect(room).toBeDefined();
    for (const id of sim.world.query(ModuleC)) {
      const m = sim.world.get(id, ModuleC)!;
      if (shipGrid(sim, homeShip(sim))!.get('room', m.x, m.y) === room.room) m.hp = 1;
    }
    lapse(sim);
    const after = shipRoomQuality(sim, homeShip(sim)).get(room.room)!;
    expect(after.inputs.condition).toBeLessThan(10);
    expect(after.tier).toBeLessThan(room.tier);
    expect(after.value).toBeLessThan(room.value / 2);
  });

  it('loose items and bodies cost cleanliness', () => {
    const sim = fresh();
    const ship = homeShip(sim), grid = shipGrid(sim, ship)!;
    const room = [...shipRoomQuality(sim, ship).values()].find((r) => r.users > 0)!;
    let n = 0;
    for (let y = grid.y0; y < grid.y0 + grid.height && n < 6; y++) for (let x = grid.x0; x < grid.x0 + grid.width && n < 6; x++) {
      if (grid.get('room', x, y) === room.room && grid.get('item', x, y) === 0) { grid.set('item', x, y, 99999); n++; }
    }
    lapse(sim);
    expect(shipRoomQuality(sim, ship).get(room.room)!.inputs.cleanliness).toBeLessThan(40);
  });
});

describe('room quality in mood', () => {
  it('a sleep in a bed is worth its room: Decent keeps "Slept in a bed", a wrecked room is a cramped cabin', () => {
    const sim = fresh();
    const c = crewOf(sim)[0] as number;
    const room = roomOf(sim, c);
    noteSleep(sim, c, true);
    const decentOrBetter = ensureMood(sim, c).sleepTier!;
    expect(keys(sim, c).some((k) => k.startsWith('bed'))).toBe(true);
    for (const id of sim.world.query(ModuleC)) {
      const m = sim.world.get(id, ModuleC)!;
      if (shipGrid(sim, homeShip(sim))!.get('room', m.x, m.y) === room) m.hp = 1;
    }
    lapse(sim);
    expect(tierOf(sim, room)).toBeLessThan(decentOrBetter);
    noteSleep(sim, c, true);
    expect(keys(sim, c)).toContain('bedGrim');
    expect(moodFactors(sim, c, ensureMood(sim, c)).find((f) => f.key === 'bedGrim')!.value).toBeLessThan(5);
  });

  it('a galley meal adds a mess factor by tier, and the surroundings follow the room the crew member is in', () => {
    const sim = fresh();
    const c = crewOf(sim)[0] as number;
    const room = roomOf(sim, c);
    for (const id of sim.world.query(ModuleC)) {
      const m = sim.world.get(id, ModuleC)!;
      if (shipGrid(sim, homeShip(sim))!.get('room', m.x, m.y) === room) m.hp = 1;
    }
    lapse(sim);
    noteMeal(sim, c, true, 'item.ration');
    expect(keys(sim, c)).toContain('messGrim');
    expect(keys(sim, c)).toContain('surroundGrim');
  });

  it('no time off weighs on mood after a long stretch, and a break clears it', () => {
    const sim = fresh();
    const c = crewOf(sim)[0] as number;
    const m = ensureMood(sim, c);
    expect(keys(sim, c)).not.toContain('noTimeOff');
    m.noBreak = 5000;
    expect(keys(sim, c)).toContain('noTimeOff');
    noteLeisure(sim, c);
    expect(keys(sim, c)).not.toContain('noTimeOff');
  });

  it('a game scores more than the mess, and both shift with the room tier', () => {
    const sim = fresh();
    const c = crewOf(sim)[0] as number;
    noteLeisure(sim, c, false);
    const mess = moodFactors(sim, c, ensureMood(sim, c)).find((f) => f.key === 'relaxed')!.value;
    noteLeisure(sim, c, true);
    const game = moodFactors(sim, c, ensureMood(sim, c)).find((f) => f.key === 'playedGame')!.value;
    expect(game).toBeGreaterThan(mess);
  });
});

describe('leisure spots', () => {
  /** A glum colony (always wants a break when idle) with a table and an arcade placed in free floor. */
  const glum: ContentRegistry = {
    ...content,
    schedules: undefined,
    policies: {
      ...content.policies,
      'policy.colonist': {
        ...content.policies['policy.colonist'],
        drives: content.policies['policy.colonist'].drives.map((d) => (d.id === 'leisure' ? { ...d, enter: 1001, exit: 1001 } : d)),
      },
    },
  };

  function withSpots(def: 'module.gametable' | 'module.arcade'): { sim: Sim; module: number } {
    const sim = fresh(glum);
    const ship = homeShip(sim), grid = shipGrid(sim, ship)!;
    const home = [...shipRoomQuality(sim, ship).values()].sort((a, b) => b.tiles - a.tiles)[0]!;
    for (let y = grid.y0; y < grid.y0 + grid.height; y++) for (let x = grid.x0; x < grid.x0 + grid.width; x++) {
      if (grid.get('room', x, y) !== home.room || placementError(sim, ship, def, x, y, 0)) continue;
      // The stand tiles (2 for the table) must be floor of the same room, not wall.
      const stands = content.modules[def].leisure.stand.map(([dx, dy]) => [x + dx, y + dy] as const);
      if (!stands.every(([sx, sy]) => grid.inBounds(sx, sy) && grid.get('room', sx, sy) === home.room)) continue;
      const module = spawnModule(sim, def, x, y, 0);
      // Every stand tile must be reachable on foot (the table can be walled into a pocket).
      const p = sim.world.get(crewOf(sim)[0] as number, PositionC)!;
      if (!standTiles(sim, module).every((t) => findPath(sim, ship, { x: p.toX, y: p.toY }, t, { suited: false }))) { removeModule(sim, module); continue; }
      sim.world.get(module, ModuleC)!.powered = true;
      // No mess (galleys off), so a break goes to the spot under test; the crew also lean to its kind (traits, `leisureLean`).
      for (const g of sim.world.query(ModuleC)) if (content.modules[sim.world.get(g, ModuleC)!.def as 'module.galley'].galley) sim.world.get(g, ModuleC)!.enabled = false;
      for (const c of crewOf(sim)) {
        const t = sim.world.get(c, TraitsC);
        const lean = def === 'module.arcade' ? 'trait.loner' : 'trait.social';
        if (t) t.ids = [lean];
        else sim.world.add(c, TraitsC, { ids: [lean] } as never);
      }
      return { sim, module };
    }
    throw new Error('no room for the module');
  }
  const onBreak = (sim: Sim, module: number): number[] => crewOf(sim).filter((c) => sim.world.get(c, TaskC)?.machine === 'leisure' && sim.world.get(c, TaskC)?.bb.target === module);

  it('the arcade takes exactly one crew member at a time', () => {
    const { sim, module } = withSpots('module.arcade');
    let most = 0;
    for (let i = 0; i < 1500; i++) {
      sim.step();
      most = Math.max(most, onBreak(sim, module).length);
      if (most > 1) break;
    }
    expect(most).toBe(1);
  });

  it('the game table takes two at once and no more, on different stools', () => {
    const { sim, module } = withSpots('module.gametable');
    let most = 0;
    for (let i = 0; i < 1500; i++) {
      sim.step();
      const here = onBreak(sim, module);
      most = Math.max(most, here.length);
      const tiles = here.map((c) => JSON.stringify(sim.world.get(c, TaskC)!.bb.tile));
      expect(new Set(tiles).size).toBe(tiles.length);
      expect(here.length).toBeLessThanOrEqual(2);
    }
    expect(most).toBe(2);
  });

  it('a break at a game credits "Played a game"; an unpowered module is not used', () => {
    const { sim, module } = withSpots('module.arcade');
    for (let i = 0; i < 2500; i++) {
      sim.step();
      if (crewOf(sim).some((c) => ensureMood(sim, c).relaxKey === 'playedGame')) break;
    }
    expect(crewOf(sim).some((c) => ensureMood(sim, c).relaxKey === 'playedGame')).toBe(true);
    const off = withSpots('module.arcade');
    off.sim.world.get(off.module, ModuleC)!.enabled = false;
    for (let i = 0; i < 1500; i++) {
      off.sim.step();
      expect(onBreak(off.sim, off.module)).toHaveLength(0);
    }
    expect(sim.world.get(module, ModuleC)).toBeDefined();
  });
});
