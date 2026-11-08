import { describe, expect, it } from 'vitest';
import {
  CrewC, DownedC, HealthC, JobC, ModuleC, MoodC, NeedsC, PlotC, PositionC, PrioritiesC, ShipC, TICK_HZ, homeShip, newGame, placementError, playerShip, spawnModule, stat, totalStock,
  type Sim, type SimEvent,
} from '../../sim';
import { findFreeBed } from '../../sim/crew/beds';
import { storageAdd } from '../../sim/items/storage';
import { moodFactors } from '../../sim/crew/mood';
import { content } from '../index';
import { accessTile } from '../../sim/modules/footprint';
import { findPath } from '../../sim/crew/pathfind';

const run = (sim: Sim, n: number): SimEvent[] => {
  const out: SimEvent[] = [];
  for (let i = 0; i < n; i++) {
    sim.step();
    out.push(...sim.events.drain());
  }
  return out;
};
const secs = (n: number): number => Math.round(n * TICK_HZ);
const humans = (sim: Sim): number[] => sim.world.query(CrewC).filter((id) => sim.world.get(id, CrewC)?.species === 'species.human');
const find = (sim: Sim, def: string): number => sim.world.query(ModuleC).find((id) => sim.world.get(id, ModuleC)?.def === def) as number;
const plotOf = (sim: Sim, id: number) => sim.world.get(id, PlotC)!;
const jobKinds = (sim: Sim): string[] => sim.world.query(JobC).map((j) => sim.world.get(j, JobC)!.kind);

/** A free spot (with the walkway beside it) for a module, scanning the ship from its top-left. */
function bedAt(sim: Sim, def = 'module.hydroponics'): number {
  const ship = playerShip(sim) as number;
  const at = sim.world.get(ship, ShipC)!;
  for (let y = at.y; y < at.y + at.height; y++) {
    for (let x = at.x; x < at.x + at.width; x++) if (placementError(sim, ship, def, x, y, 0) === null) return spawnModule(sim, def, x, y, 0);
  }
  throw new Error('no room for the bed');
}

/** The starter game with the larder emptied of everything but what a test adds, one bed, and the crew fed so only the test's crew member acts. */
function farmGame(): { sim: Sim; bed: number; crew: number[] } {
  const sim = newGame(3, content);
  run(sim, 5);
  const bed = bedAt(sim);
  for (const h of humans(sim)) {
    sim.world.get(h, NeedsC)!.hunger = 100;
    sim.world.get(h, NeedsC)!.rest = 100;
  }
  return { sim, bed, crew: humans(sim) };
}

describe('hydroponics', () => {
  it('a bed starts empty, with nothing to do until it is set to a crop', () => {
    const { sim, bed } = farmGame();
    expect(plotOf(sim, bed)).toMatchObject({ crop: null, planted: null, ready: false });
    run(sim, secs(5));
    expect(jobKinds(sim)).not.toContain('plant');
  });

  it('plant, grow and harvest: water is delivered, the crop grows while powered, the yield is hauled to storage', () => {
    const { sim, bed } = farmGame();
    const greens = content.crops['crop.greens'];
    const water = totalStock(sim, 'item.water');
    sim.enqueue({ type: 'plot.setCrop', moduleId: bed, crop: 'crop.greens' });
    const events = run(sim, secs(40));
    expect(events.some((e) => e.type === 'crop.planted')).toBe(true);
    expect(plotOf(sim, bed).planted).toBe('crop.greens');
    expect(totalStock(sim, 'item.water')).toBe(water - greens.water);
    expect(plotOf(sim, bed).ready).toBe(false);
    // Grown after its growing time, then a harvest job is posted and done.
    const grown = run(sim, secs(greens.growSec));
    expect(grown.some((e) => e.type === 'crop.harvested' && e.count === greens.yield)).toBe(true);
    run(sim, secs(30));
    expect(totalStock(sim, 'item.greens')).toBe(greens.yield);
    // The bed is still set to greens, so it is sown again, growing from nothing.
    expect(plotOf(sim, bed)).toMatchObject({ planted: 'crop.greens', ready: false });
    expect(plotOf(sim, bed).grown).toBeLessThan(secs(30));
  });

  it('a bed with no power does not grow, and says so', () => {
    const { sim, bed } = farmGame();
    sim.enqueue({ type: 'debug.setPlot', moduleId: bed, crop: 'crop.greens', grown: 10 });
    sim.enqueue({ type: 'module.setEnabled', id: bed, enabled: false });
    run(sim, secs(20));
    expect(plotOf(sim, bed).grown).toBe(secs(10));
    sim.enqueue({ type: 'module.setEnabled', id: bed, enabled: true });
    run(sim, secs(10));
    expect(plotOf(sim, bed).grown).toBeGreaterThan(secs(10));
  });

  it('a change of crop leaves the crop in the soil alone and is sown after the harvest', () => {
    const { sim, bed } = farmGame();
    sim.enqueue({ type: 'plot.setCrop', moduleId: bed, crop: 'crop.greens' });
    sim.enqueue({ type: 'debug.setPlot', moduleId: bed, crop: 'crop.greens', ready: true });
    sim.enqueue({ type: 'plot.setCrop', moduleId: bed, crop: 'crop.herbs' });
    run(sim, secs(40));
    expect(totalStock(sim, 'item.greens')).toBe(content.crops['crop.greens'].yield);
    run(sim, secs(40));
    expect(plotOf(sim, bed).planted).toBe('crop.herbs');
  });

  it('stops sowing a crop the ship is full of', () => {
    const { sim, bed } = farmGame();
    storageAdd(sim, find(sim, 'module.storage'), 'item.herbs', content.crops['crop.herbs'].stockCap);
    sim.enqueue({ type: 'plot.setCrop', moduleId: bed, crop: 'crop.herbs' });
    run(sim, secs(30));
    expect(plotOf(sim, bed).planted).toBeNull();
    expect(jobKinds(sim)).not.toContain('plant');
  });

  it("farm jobs post under the 'farming' work category", () => {
    const { sim, bed } = farmGame();
    for (const h of humans(sim)) sim.world.get(h, PrioritiesC)!.farming = 0; // nobody takes it: it stays on the board
    sim.enqueue({ type: 'plot.setCrop', moduleId: bed, crop: 'crop.greens' });
    run(sim, secs(2));
    const job = sim.world.query(JobC).map((j) => sim.world.get(j, JobC)!).find((j) => j.kind === 'plant');
    expect(job).toMatchObject({ category: 'farming', crop: 'crop.greens', target: bed });
  });
});

describe('cooking', () => {
  /** The galley with produce and water in stock and a count-1 order; the cook is the only one who cooks (the first crew member with no cooking skill of their own), with `xp` in cooking. */
  function cookGame(recipe: string, xp: number): { sim: Sim; galley: number; cook: number } {
    const { sim } = farmGame();
    const galley = find(sim, 'module.galley');
    const store = find(sim, 'module.storage');
    storageAdd(sim, store, 'item.greens', 12);
    storageAdd(sim, store, 'item.beans', 12);
    const cook = humans(sim).find((h) => stat(sim, h, 'cooking') === 0) as number;
    for (const h of humans(sim)) if (h !== cook) sim.world.get(h, PrioritiesC)!.cooking = 0;
    if (xp) sim.enqueue({ type: 'debug.setCrew', id: cook, xp: { cooking: xp } });
    sim.enqueue({ type: 'production.add', moduleId: galley, recipe, mode: 'count', target: 1 });
    return { sim, galley, cook };
  }
  const meals = (sim: Sim): Record<string, number> => Object.fromEntries(['bland', 'good', 'fine'].map((q) => [q, totalStock(sim, `item.meal_${q}`)]));

  it("a cooking job posts under the 'cooking' category (and so does the ration)", () => {
    const { sim } = cookGame('recipe.meal_greens', 0);
    for (const h of humans(sim)) sim.world.get(h, PrioritiesC)!.cooking = 0;
    run(sim, secs(2));
    const cats = sim.world.query(JobC).map((j) => sim.world.get(j, JobC)!).filter((j) => j.kind === 'craft').map((j) => j.category);
    expect(cats).toEqual(['cooking']);
    expect(content.recipes['recipe.ration'].category).toBe('cooking');
  });

  it('turns produce and water into meals, bland from an unskilled cook', () => {
    const { sim } = cookGame('recipe.meal_greens', 0);
    const water = totalStock(sim, 'item.water');
    run(sim, secs(60));
    expect(meals(sim)).toEqual({ bland: 2, good: 0, fine: 0 });
    expect(totalStock(sim, 'item.greens')).toBe(6);
    expect(totalStock(sim, 'item.water')).toBe(water - 2);
  });

  it('the cook sets the quality: a trained cook turns out fine meals, a middling one good', () => {
    const fine = cookGame('recipe.meal_beans', 2000);
    run(fine.sim, secs(60));
    expect(meals(fine.sim)).toEqual({ bland: 0, good: 0, fine: 2 });
    const good = cookGame('recipe.meal_greens', 150);
    run(good.sim, 2);
    expect(stat(good.sim, good.cook, 'cooking')).toBeGreaterThanOrEqual(1);
    expect(stat(good.sim, good.cook, 'cooking')).toBeLessThan(3);
    run(good.sim, secs(60));
    expect(meals(good.sim)).toEqual({ bland: 0, good: 2, fine: 0 });
  });

  it('a keep order counts every quality of its meal', () => {
    const { sim, galley } = cookGame('recipe.meal_greens', 0);
    sim.enqueue({ type: 'production.remove', moduleId: galley, index: 1 }); // the starter galley's own keep-rations order is index 0
    const store = find(sim, 'module.storage');
    storageAdd(sim, store, 'item.meal_fine', 4);
    sim.enqueue({ type: 'production.add', moduleId: galley, recipe: 'recipe.meal_greens', mode: 'keep', target: 4 });
    run(sim, secs(30));
    expect(totalStock(sim, 'item.meal_bland')).toBe(0); // four fine meals already meet the keep-4 order
  });
});

describe('eating', () => {
  function hungryCrew(): { sim: Sim; id: number } {
    const { sim, crew } = farmGame();
    const id = crew[0] as number;
    sim.world.get(id, NeedsC)!.hunger = 20;
    return { sim, id };
  }

  it('a hungry crew member eats a meal before a ration, and the meal sets the mood boost', () => {
    const { sim, id } = hungryCrew();
    storageAdd(sim, find(sim, 'module.storage'), 'item.meal_fine', 1);
    const rations = totalStock(sim, 'item.ration');
    expect(rations).toBeGreaterThan(0);
    const events = run(sim, secs(40));
    expect(events.find((e) => e.type === 'crew.ate')).toMatchObject({ crew: id, item: 'item.meal_fine', galley: true });
    expect(totalStock(sim, 'item.ration')).toBe(rations);
    const mood = sim.world.get(id, MoodC)!;
    expect(moodFactors(sim, id, mood).find((f) => f.key === 'mealFine')?.value).toBe(13);
  });

  it('better meals lift mood more: fine over good over bland over a ration', () => {
    const food = (item: 'item.meal_fine' | 'item.meal_good' | 'item.meal_bland' | 'item.ration') => content.items[item].food;
    expect([food('item.meal_fine').mood.points, food('item.meal_good').mood.points, food('item.meal_bland').mood.points, food('item.ration').mood.points]).toEqual([13, 9, 5, 3]);
    expect(food('item.meal_bland').nutrition).toBeGreaterThan(food('item.ration').nutrition);
  });

  it('falls back to rations when there are no meals', () => {
    const { sim, id } = hungryCrew();
    const events = run(sim, secs(40));
    expect(events.find((e) => e.type === 'crew.ate')).toMatchObject({ crew: id, item: 'item.ration' });
  });
});

describe('medicinal herbs', () => {
  /** A downed, stabilized patient lying in a medical bed with `herbs` in stock, healed for ten seconds: the hp gained and the herbs left. */
  function heal(herbs: number): { gained: number; herbsLeft: number } {
    const { sim } = farmGame();
    const med = bedAt(sim, 'module.med_bed');
    storageAdd(sim, find(sim, 'module.storage'), 'item.herbs', herbs);
    const patient = humans(sim)[0] as number;
    sim.world.get(med, ModuleC)!.reservedBy = patient;
    sim.world.add(patient, DownedC, { bleed: 100, stabilized: true, bed: med });
    sim.world.get(patient, HealthC)!.hp = 1;
    run(sim, secs(5));
    return { gained: sim.world.get(patient, HealthC)!.hp - 1, herbsLeft: totalStock(sim, 'item.herbs') };
  }

  it('a medical bed with herbs in stock heals faster, using one herb per treatment', () => {
    const plain = heal(0);
    const herbal = heal(3);
    expect(plain.gained).toBeGreaterThan(0);
    expect(herbal.gained).toBeGreaterThan(plain.gained * 1.8);
    expect(herbal.herbsLeft).toBe(2);
  });

  it('a medical bed is for patients: a sleeper never gets it, a patient gets it before an ordinary bed', () => {
    const { sim, crew } = farmGame();
    const med = bedAt(sim, 'module.med_bed');
    const ship = homeShip(sim);
    const from = { x: sim.world.get(crew[0] as number, PositionC)!.x, y: sim.world.get(crew[0] as number, PositionC)!.y };
    expect(findFreeBed(sim, ship, from)?.bed).not.toBe(med);
    for (const id of sim.world.query(ModuleC)) if (id !== med && content.modules[sim.world.get(id, ModuleC)!.def as 'module.bed'].bed) sim.world.get(id, ModuleC)!.reservedBy = 99;
    expect(findFreeBed(sim, ship, from)).toBeNull();
    expect(findFreeBed(sim, ship, from, false, undefined, true)?.bed).toBe(med);
  });
});

describe('the starter ships', () => {
  for (const id of ['ship.wayfarer', 'ship.prospector', 'ship.lancer']) {
    it(`${id}: starts with a planted bed the crew can reach`, () => {
      const sim = newGame(3, content, id);
      run(sim, 3);
      const beds = sim.world.query(ModuleC).filter((m) => sim.world.get(m, ModuleC)?.def === 'module.hydroponics');
      expect(beds.length).toBeGreaterThan(0);
      const crew = humans(sim)[0] as number;
      const from = sim.world.get(crew, PositionC)!;
      for (const bed of beds) {
        const m = sim.world.get(bed, ModuleC)!;
        const at = accessTile(content.modules['module.hydroponics'], m.x, m.y, m.rot)!;
        expect(findPath(sim, homeShip(sim), { x: from.x, y: from.y }, at), `bed at ${m.x},${m.y} reachable`).not.toBeNull();
        expect(plotOf(sim, bed).crop).not.toBeNull();
      }
      const galley = sim.world.get(find(sim, 'module.galley'), ModuleC)!;
      const gAt = accessTile(content.modules['module.galley'], galley.x, galley.y, galley.rot)!;
      expect(findPath(sim, homeShip(sim), { x: from.x, y: from.y }, gAt), 'galley reachable').not.toBeNull();
    });
  }
});
