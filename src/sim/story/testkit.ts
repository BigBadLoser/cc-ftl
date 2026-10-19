import { spawnShip } from '../combat/ships';
import { createCrew } from '../crew/spawn';
import type { ContentRegistry, ModuleDef } from '../registry';
import { Sim } from '../sim';
import type { EventDef } from './defs';
import { storageAdd } from '../items/storage';
import { ModuleC } from '../modules/components';
import { StorageC } from '../items/components';

/** Shared fixtures for the story tests. Not imported by game code. */
const mod = (o: Partial<ModuleDef>): ModuleDef => ({
  name: 'Crate', asset: 'm', footprint: [1, 1], solid: true, power: 0, flammability: 0.1, maxHp: 100, buildWork: 20, ...o,
});
const item = (name: string, stackSize = 100) => ({ name, tags: [], stackSize });
const all = { firefighting: 2, medical: 2, operating: 2, repair: 2, construction: 2, hauling: 2, crafting: 2, cooking: 2 };

export const baseContent = (events: Record<string, EventDef>): ContentRegistry => ({
  ships: {},
  roles: {
    'role.engineer': { name: 'Engineer', priorities: all, skills: { repair: 6 } },
    'role.rookie': { name: 'Rookie', priorities: all, skills: { repair: 1 } },
    'role.bot': { name: 'Bot', priorities: all, species: 'species.robot' },
  },
  species: {
    'species.human': { name: 'Human', moveSpeed: 2.5, workSpeed: 1, restDecay: 0.6 },
    'species.robot': { name: 'Robot', moveSpeed: 2, workSpeed: 1, restDecay: 0, airless: true },
  },
  modules: { 'module.crate': mod({ storage: { capacity: 4 }, access: [0, 1] }) },
  crewNames: ['Mara', 'Joss', 'Tek'],
  items: { 'item.scrap': item('Scrap'), 'item.parts': item('Spare parts'), 'item.metal': item('Metal') },
  recipes: {},
  structCosts: {},
  events,
});

const rows = ['##########', '#________#', '#________#', '#________#', '##########'];

/** A sim with the player's ship (grid 1, one crate) and crew of the given roles. */
export function storySim(events: Record<string, EventDef>, roles: string[] = ['role.engineer', 'role.rookie'], seed = 7): Sim {
  const sim = new Sim(seed, baseContent(events));
  spawnShip(sim, { name: 'P', rows, modules: [{ def: 'module.crate', x: 7, y: 1, rot: 0 }] }, { gridId: 1, faction: 'player', x: 0, y: 0 });
  roles.forEach((r, i) => createCrew(sim, 1, r, { x: 1 + i, y: 2 }, { faction: 'player', name: i === 0 ? 'Mara' : `C${i}` }));
  return sim;
}

export const crate = (sim: Sim): number => sim.world.query(StorageC, ModuleC)[0] as number;
export const give = (sim: Sim, itemId: string, n: number): void => void storageAdd(sim, crate(sim), itemId, n);
export const run = (sim: Sim, ticks = 1): void => {
  for (let i = 0; i < ticks; i++) sim.step();
};
