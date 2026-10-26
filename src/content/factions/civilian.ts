import type { FactionDef } from '../../sim';

/**
 * Civilians: freighters, liners, mining ships and stations, from the shared civil builders (the same sections the
 * scrappers salvage). Lightly armed: point defence in the core room, the odd single light gun or a small shield,
 * never a battery. Transitions are shallow fairings: commercial hulls are plain and cheaply built, so their section
 * changes get gentle low steps (a long slope, at most two tiles high), never the navy's armoured shoulders.
 */
export const civilian = {
  name: 'Civilian',
  side: 'neutral',
  motif: 'motif.civilian',
  art: { hull: 'hull.clean', wall: 'wall.clean', roof: 'roof.grid', livery: 'livery.navy', signature: ['module.storage', 'module.bed'] },
  architecture: {
    roles: [
      { id: 'freighter', weight: { base: 4, perDepth: 0, max: 4 }, archetypes: [{ value: 'salvage', weight: 1 }] },
      { id: 'liner', weight: { base: 2, perDepth: 0, max: 2 }, archetypes: [{ value: 'salvage', weight: 1 }] },
      { id: 'mining', weight: { base: 3, perDepth: 0, max: 3 }, archetypes: [{ value: 'salvage', weight: 1 }] },
      { id: 'station', weight: { base: 1, perDepth: 0.2, max: 3 }, archetypes: [{ value: 'salvage', weight: 1 }] },
    ],
    symmetry: 1,
    corridorWidth: [1, 1],
    strutLength: [1, 3],
    battery: 1,
    noses: [],
  },
  transition: { slope: 3, max: 2, jitter: 0, label: 'fairing' },
  // Civil families (assembly-driven): each its own construction, one grammar each.
  hullFamilies: [
    {
      id: 'freighter', weight: { base: 4, perDepth: 0, max: 4 }, bonus: { crates: 8 }, grammars: [{ value: 'freighter', weight: 1 }],
      aspect: [3, 6], depth: {}, batteryCols: [1, 1], sponsonChance: 0, sectionRooms: 3, propulsion: ['bank'],
    },
    {
      id: 'liner', weight: { base: 2, perDepth: 0, max: 2 }, bonus: { crew: 6, crates: -4 }, grammars: [{ value: 'liner', weight: 1 }],
      aspect: [3, 7], depth: {}, batteryCols: [1, 1], sponsonChance: 0, sectionRooms: 3, propulsion: ['bank'],
    },
    {
      id: 'mining', weight: { base: 3, perDepth: 0, max: 3 }, bonus: { crates: 6 }, grammars: [{ value: 'mining', weight: 1 }],
      aspect: [2, 4], depth: {}, batteryCols: [1, 1], sponsonChance: 0, sectionRooms: 3, propulsion: ['bank'],
    },
    {
      id: 'station', weight: { base: 1, perDepth: 0.2, max: 3 }, bonus: { crew: 2 }, grammars: [{ value: 'station', weight: 1 }],
      aspect: [1, 1.5], depth: {}, batteryCols: [1, 1], sponsonChance: 0, sectionRooms: 3, propulsion: ['bank'],
    },
  ],
  weapons: {
    light: [{ value: 'module.burstLaser', weight: 1 }],
    heavy: [],
  },
  shields: [{ value: 'module.shieldGen', weight: 1 }],
  stock: [{ item: 'item.metal', min: 1, max: 6 }, { item: 'item.electronics', min: 0, max: 3 }],
  living: true,
  aiCore: true,
  crew: {
    required: ['role.pilot', 'role.engineer'],
    pool: [{ value: 'role.engineer', weight: 2 }, { value: 'role.medic', weight: 1 }, { value: 'role.security', weight: 1 }],
    species: ['species.human'],
  },
  doctrine: { targeting: 'random' },
  budget: {
    weapons: { base: 0.5, perDepth: 0.18, max: 2 },
    heavyPct: { base: 0, perDepth: 0, max: 0 },
    shields: { base: 0, perDepth: 0.12, max: 1 },
    engines: { base: 1, perDepth: 0.15, max: 2 },
    reactors: { base: 2, perDepth: 0.25, max: 4 },
    pointDefense: { base: 0.4, perDepth: 0.1, max: 1 },
    crew: { base: 3, perDepth: 0.4, max: 7 },
    crates: { base: 6, perDepth: 0.8, max: 16 },
    size: { base: 0, perDepth: 0.4, max: 4 },
  },
} satisfies FactionDef;
