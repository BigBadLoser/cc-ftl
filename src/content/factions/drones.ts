import type { FactionDef } from '../../sim';

/**
 * Drones: mobile machinery. No bridge or main hallway: a processing core (helm, weapons console, AI core) with
 * struts out to compact pods, parallel rails, or distributed clusters on long thin struts. Redundant single-reactor
 * pods, single mounts, symmetry only when the roll says the mounts are balanced. No beds or life support: crewed by
 * robots (they spawn as humans until the robots branch lands) and meant to be captured by disabling the core (follow-up).
 */
export const drones = {
  name: 'Drone',
  motif: 'motif.drone',
  art: { hull: 'hull.clean', wall: 'wall.panel', roof: 'roof.grid', livery: 'livery.drone', signature: ['module.aiCore', 'module.pointDefense'] },
  architecture: {
    roles: [
      { id: 'picket', weight: { base: 4, perDepth: -0.3, max: 4 }, archetypes: [{ value: 'hub', weight: 3 }, { value: 'clusters', weight: 1 }] },
      { id: 'lancer', weight: { base: 2, perDepth: 0.2, max: 4 }, archetypes: [{ value: 'rails', weight: 3 }, { value: 'hub', weight: 1 }], bonus: { heavyPct: 20 } },
      { id: 'swarm', weight: { base: 0, perDepth: 0.4, max: 4 }, archetypes: [{ value: 'clusters', weight: 3 }, { value: 'rails', weight: 1 }], bonus: { weapons: 1, size: 1 } },
    ],
    symmetry: 0.35,
    corridorWidth: [1, 1],
    strutLength: [2, 5],
    battery: 1,
    noses: [],
  },
  // Machine hull families (assembly-driven): sealed pods on crawlways and beams, the AI core as the bridge.
  hullFamilies: [
    {
      id: 'picket', weight: { base: 4, perDepth: -0.3, max: 4 }, grammars: [{ value: 'spoke', weight: 1 }],
      aspect: [0.9, 1.8], depth: {}, batteryCols: [1, 1], sponsonChance: 0, sectionRooms: 3, propulsion: ['cluster'],
    },
    {
      id: 'lancer', weight: { base: 2, perDepth: 0.2, max: 4 }, bonus: { heavyPct: 20 }, grammars: [{ value: 'truss', weight: 1 }],
      aspect: [2.2, 4.5], depth: {}, batteryCols: [1, 1], sponsonChance: 0, sectionRooms: 3, propulsion: ['cluster'],
    },
    {
      id: 'swarm', weight: { base: 0, perDepth: 0.4, max: 4 }, bonus: { weapons: 1, size: 1 }, grammars: [{ value: 'cluster', weight: 1 }],
      aspect: [1.2, 3], depth: {}, batteryCols: [1, 1], sponsonChance: 0, sectionRooms: 3, propulsion: ['cluster'],
    },
  ],
  weapons: {
    light: [{ value: 'module.burstLaser', weight: 3 }, { value: 'module.ionCannon', weight: 2 }],
    heavy: [{ value: 'module.massDriver', weight: 1 }],
  },
  shields: [{ value: 'module.shieldGenSmall', weight: 3 }, { value: 'module.shieldGen', weight: 1 }],
  stock: [{ item: 'item.electronics', min: 1, max: 4 }],
  living: false,
  aiCore: true,
  crew: {
    required: ['role.pilot', 'role.gunner'],
    pool: [{ value: 'role.engineer', weight: 1 }],
    species: ['species.robot'],
  },
  doctrine: { targeting: 'shields' },
  budget: {
    weapons: { base: 2, perDepth: 0.4, max: 6 },
    heavyPct: { base: 10, perDepth: 5, max: 50 },
    shields: { base: 1, perDepth: 0.2, max: 3 },
    engines: { base: 1, perDepth: 0.25, max: 3 },
    reactors: { base: 2, perDepth: 0.25, max: 4 },
    pointDefense: { base: 1, perDepth: 0.2, max: 3 },
    crew: { base: 2, perDepth: 0.2, max: 4 },
    crates: { base: 0, perDepth: 0.2, max: 2 },
    size: { base: 0, perDepth: 0.4, max: 4 },
  },
} satisfies FactionDef;
