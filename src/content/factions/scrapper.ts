import type { FactionDef } from '../../sim';
import { navy } from './navy';

/**
 * Scrapper raiders: improvised assemblies of salvaged sections (a freighter segment, a habitat, a gun deck…), each
 * keeping its own corridor width and room proportions, joined by narrow offset connectors. A cockpit up front, a
 * patched reactor and engine tug at the back, extra engines strapped on wherever they face open space, crates bolted
 * on. Heavy storage, cheap guns; they board by shuttle.
 */
export const scrapper = {
  name: 'Scrapper',
  motif: 'motif.scrapper',
  art: { hull: 'hull.patched', wall: 'wall.rusted', roof: 'roof.patchwork', livery: 'livery.scrapper', signature: ['module.vehicle_bay', 'module.storage'] },
  architecture: {
    roles: [
      { id: 'raider', weight: { base: 4, perDepth: 0, max: 4 }, archetypes: [{ value: 'salvage', weight: 1 }] },
      { id: 'hauler', weight: { base: 2, perDepth: 0, max: 2 }, archetypes: [{ value: 'salvage', weight: 1 }], bonus: { crates: 6, weapons: -1, size: 1 } },
      { id: 'gunrunner', weight: { base: 0, perDepth: 0.4, max: 3 }, archetypes: [{ value: 'salvage', weight: 1 }], bonus: { weapons: 1, heavyPct: 15 } },
    ],
    symmetry: 0,
    corridorWidth: [1, 2],
    strutLength: [1, 4],
    battery: 1,
    // Salvaged navy bows: the navy's own nose chunks.
    noses: navy.architecture.noses,
  },
  // Salvage families (assembly-driven): donor sections welded together.
  hullFamilies: [
    {
      id: 'raider', weight: { base: 4, perDepth: 0, max: 4 }, grammars: [{ value: 'heap', weight: 2 }, { value: 'raft', weight: 1 }],
      aspect: [1, 2.2], depth: {}, batteryCols: [1, 1], sponsonChance: 0, sectionRooms: 3, propulsion: ['bank'],
    },
    {
      id: 'hauler', weight: { base: 2, perDepth: 0, max: 2 }, bonus: { crates: 6, weapons: -1 }, grammars: [{ value: 'raft', weight: 2 }, { value: 'heap', weight: 1 }],
      aspect: [1, 2.2], depth: {}, batteryCols: [1, 1], sponsonChance: 0, sectionRooms: 3, propulsion: ['bank'],
    },
    {
      id: 'gunrunner', weight: { base: 0, perDepth: 0.4, max: 3 }, bonus: { weapons: 1, heavyPct: 15 }, grammars: [{ value: 'heap', weight: 1 }],
      aspect: [1, 2.2], depth: {}, batteryCols: [1, 1], sponsonChance: 0, sectionRooms: 3, propulsion: ['bank'],
    },
  ],
  weapons: {
    light: [{ value: 'module.burstLaser', weight: 3 }, { value: 'module.incendiaryLauncher', weight: 2 }],
    heavy: [{ value: 'module.massDriver', weight: 1 }],
  },
  shields: [{ value: 'module.shieldGenSmall', weight: 1 }],
  stock: [{ item: 'item.scrap', min: 2, max: 8 }, { item: 'item.metal', min: 0, max: 4 }],
  living: true,
  aiCore: false,
  crew: {
    required: ['role.pilot', 'role.gunner', 'role.security', 'role.security'],
    pool: [{ value: 'role.security', weight: 3 }, { value: 'role.engineer', weight: 2 }, { value: 'role.gunner', weight: 1 }],
    species: ['species.human'],
  },
  doctrine: { targeting: 'random', boarding: { party: 2, afterSec: 60, losingBelow: 0.6, weapon: 'item.sidearm' } },
  budget: {
    weapons: { base: 1.6, perDepth: 0.35, max: 5 },
    heavyPct: { base: 5, perDepth: 5, max: 40 },
    shields: { base: 0, perDepth: 0.25, max: 2 },
    engines: { base: 1, perDepth: 0.3, max: 3 },
    reactors: { base: 2, perDepth: 0.3, max: 4 },
    pointDefense: { base: 0, perDepth: 0, max: 0 },
    crew: { base: 4, perDepth: 0.4, max: 8 },
    crates: { base: 5, perDepth: 0.6, max: 14 },
    size: { base: 0, perDepth: 0.5, max: 4 },
  },
} satisfies FactionDef;
