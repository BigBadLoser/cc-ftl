import { describe, expect, it } from 'vitest';
import { spawnShip } from '../combat/ships';
import { CrewC, HealthC, NeedsC, PathC, PositionC, PrioritiesC, type Priorities } from '../crew/components';
import type { TraitDef } from '../crew/traitDef';
import { TraitsC } from '../crew/traits';
import type { ContentRegistry } from '../registry';
import { Sim } from '../sim';
import { CREW_MAX_HP } from '../tuning';
import { AllegianceC, EquipC, FighterC, SurrenderedC } from './components';

const trait = (o: Partial<TraitDef>): TraitDef => ({ name: 'T', flavour: '', kind: 'behaviour', effect: '', short: '', weight: 5, rollable: true, ...o });
const content: ContentRegistry = {
  ships: {},
  roles: { 'role.civ': { name: 'Civ', priorities: {} as Priorities } },
  species: { 'species.human': { name: 'H', moveSpeed: 2.5, workSpeed: 1, restDecay: 0.6 } },
  modules: {},
  crewNames: [],
  items: {
    'item.sidearm': { name: 'S', tags: [], stackSize: 5, hand: { kind: 'ranged', damage: 12, range: 8, cooldownSec: 1, accuracy: 0.7 } },
    'item.blade': { name: 'B', tags: [], stackSize: 5, hand: { kind: 'melee', damage: 20, range: 1, cooldownSec: 1.2, accuracy: 0.8 } },
  },
  recipes: {},
  structCosts: {},
  traits: { 'trait.brave': trait({ effects: { brave: true } }), 'trait.coward': trait({ effects: { coward: true } }) },
};

function make(): Sim {
  const sim = new Sim(5, content);
  spawnShip(sim, { name: 'Hall', rows: ['########################', ...Array(3).fill('#______________________#'), '########################'] }, { faction: 'player', x: 0, y: 0 });
  return sim;
}
function person(sim: Sim, x: number, faction: 'player' | 'hostile', weapon?: string, traits: string[] = []): number {
  const id = sim.world.createEntity();
  sim.world.add(id, CrewC, { name: 'T', role: 'role.civ', species: 'species.human', appearanceSeed: 1, activity: 'idle' });
  sim.world.add(id, PositionC, { x, y: 2, toX: x, toY: 2, progress: 0, facing: 0 });
  sim.world.add(id, PathC, { steps: [] });
  sim.world.add(id, PrioritiesC, {} as Priorities);
  sim.world.add(id, NeedsC, { rest: 100 });
  sim.world.add(id, HealthC, { hp: CREW_MAX_HP, max: CREW_MAX_HP });
  sim.world.add(id, AllegianceC, { faction });
  if (weapon) sim.world.add(id, EquipC, { weapon });
  if (traits.length) sim.world.add(id, TraitsC, { ids: traits });
  return id;
}
const run = (sim: Sim, n: number): void => {
  for (let i = 0; i < n; i++) sim.step();
  sim.events.drain();
};

describe('Brave and Coward in a fight', () => {
  it('an unarmed Brave crew member goes for the intruder where others run', () => {
    const sim = make();
    const brave = person(sim, 8, 'player', undefined, ['trait.brave']);
    const civ = person(sim, 9, 'player');
    const raider = person(sim, 5, 'hostile', 'item.blade');
    sim.world.get(raider, HealthC)!.hp = 1e9;
    run(sim, 40);
    expect(sim.world.get(brave, FighterC)?.mode).toBe('engage');
    expect(sim.world.get(civ, FighterC)?.mode).toBe('flee');
  });

  it('an armed Coward runs once hurt; an armed crew member without the trait keeps fighting', () => {
    const sim = make();
    const coward = person(sim, 12, 'player', 'item.sidearm', ['trait.coward']);
    const plain = person(sim, 12, 'player', 'item.sidearm');
    sim.world.get(coward, PositionC)!.y = sim.world.get(coward, PositionC)!.toY = 1;
    for (const id of [coward, plain]) sim.world.get(id, HealthC)!.hp = CREW_MAX_HP * 0.4;
    const raider = person(sim, 6, 'hostile', 'item.sidearm');
    sim.world.get(raider, HealthC)!.hp = 1e9;
    run(sim, 20);
    expect(sim.world.get(coward, FighterC)?.mode).toBe('flee');
    expect(sim.world.get(plain, FighterC)?.mode).toBe('engage');
  });

  it('a Coward who surrendered gets back up once no hostile is left on the ship, and stays down while one is', () => {
    const sim = make();
    const coward = person(sim, 8, 'player', undefined, ['trait.coward']);
    sim.world.get(coward, HealthC)!.hp = CREW_MAX_HP * 0.2;
    const raiders = [person(sim, 7, 'hostile'), person(sim, 9, 'hostile')]; // outnumbered: two foes against one
    for (const r of raiders) sim.world.get(r, HealthC)!.hp = 1e9;
    run(sim, 5);
    expect(sim.world.has(coward, SurrenderedC)).toBe(true);
    run(sim, 200); // the raiders are still beside them: they stay down
    expect(sim.world.has(coward, SurrenderedC)).toBe(true);
    for (const r of raiders) sim.world.destroyEntity(r);
    run(sim, 5);
    expect(sim.world.has(coward, SurrenderedC)).toBe(false);
    expect(sim.world.get(coward, CrewC)?.activity).not.toBe('surrendered');
  });
});
