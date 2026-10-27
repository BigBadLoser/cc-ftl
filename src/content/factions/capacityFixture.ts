import { Sim, generateShip, hullLoad, stampShip, type FactionDef, type HullLoad, type ModuleDef, type ShipTemplate } from '../../sim';
import { content } from '../index';
import { factions } from './index';

const defs = content.modules as Record<string, ModuleDef>;

/** Stamp one template into a fresh sim and read its hull against its engines. */
export function loadOf(template: ShipTemplate): HullLoad {
  const sim = new Sim(1, content);
  return hullLoad(sim, stampShip(sim, template, { faction: 'player', x: 0, y: 0 }));
}

/** The load of a generated ship, or the problems that stopped it generating. */
export function generatedLoad(id: string, seed: number, depth: number): HullLoad {
  const g = generateShip(factions[id as keyof typeof factions] as FactionDef, id, seed, depth, defs);
  return loadOf(g.template);
}

