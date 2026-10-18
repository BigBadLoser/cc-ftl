import type { ChunkDef, FactionDef } from '../../sim';

/**
 * Navy / corporate: standardised naval engineering. Mirrored hulls in several archetypes (escort spine, ring-corridor
 * warship, carrier with twin nacelles), zoned by function, continuous hull lines, hand-made noses.
 */
const noses: ChunkDef[] = [
  { id: 'navy.bow.taper', rows: [
    '......#####',
    '....###bbb#',
    '..###bbbbb#',
    '.##bbbbbbb#',
    '##bbbbbbbb#',
    '#bbbbbbbbbD',
    '#bbbbbbbbbD',
    '##bbbbbbbb#',
    '.##bbbbbbb#',
    '..###bbbbb#',
    '....###bbb#',
    '......#####',
  ] },
  { id: 'navy.bow.gunnose', rows: [
    '......#######',
    '....###bbbbb#',
    '..#####bbbbb#',
    '.##www#bbbbb#',
    '##wwwwDbbbbb#',
    '#wwwww#bbbbbD',
    '#wwwww#bbbbbD',
    '##wwwwDbbbbb#',
    '.##www#bbbbb#',
    '..#####bbbbb#',
    '....###bbbbb#',
    '......#######',
  ] },
  { id: 'navy.bow.blunt', rows: [
    '...#############',
    '.###wwwww#bbbbb#',
    '##wwwwwwwDbbbbb#',
    '#wwwwwwww#bbbbbD',
    '#wwwwwwww#bbbbbD',
    '##wwwwwwwDbbbbb#',
    '.###wwwww#bbbbb#',
    '...#############',
  ] },
];

export const navy = {
  name: 'Navy',
  motif: 'motif.navy',
  art: { hull: 'hull.plated', wall: 'wall.clean', roof: 'roof.armour', livery: 'livery.navy', signature: ['module.shieldGen', 'module.missileLauncher'] },
  architecture: {
    roles: [
      { id: 'escort', weight: { base: 6, perDepth: -0.6, max: 6 }, archetypes: [{ value: 'spine', weight: 1 }] },
      { id: 'cruiser', weight: { base: 1, perDepth: 0.6, max: 5 }, archetypes: [{ value: 'ring', weight: 1 }], bonus: { weapons: 1, shields: 1, size: 1 } },
      { id: 'carrier', weight: { base: -1, perDepth: 0.45, max: 3 }, archetypes: [{ value: 'carrier', weight: 1 }], bonus: { engines: 1, pointDefense: 1 }, bays: 2 },
    ],
    symmetry: 1,
    corridorWidth: [2, 2],
    strutLength: [2, 3],
    battery: 2,
    noses,
  },
  // Hull families (assembly-driven): standard sections, family proportions.
  hullFamilies: [
    {
      id: 'corvette', weight: { base: 5, perDepth: -0.5, max: 5 }, bonus: { weapons: -1, crew: -3, crates: -3, shields: -1, engines: -1 },
      depth: { battery: [3, 4], core: [3, 3], habitat: [3, 3], cargo: [3, 3] }, batteryCols: [1, 2], sponsonChance: 0.25, sectionRooms: 4, merge: true, grammars: [{ value: 'linear', weight: 2 }, { value: 'componentFrigate', weight: 3 }, { value: 'deckPair', weight: 0.5 }], aspect: [3, 4], propulsion: ['bank', 'cluster', 'sideDrives'],
    },
    {
      id: 'frigate', weight: { base: 3, perDepth: 0, max: 3 },
      depth: { battery: [3, 5], core: [3, 4], habitat: [3, 3], cargo: [3, 4] }, batteryCols: [1, 2], sponsonChance: 0.5, sectionRooms: 3, grammars: [{ value: 'componentFrigate', weight: 5 }, { value: 'spineWings', weight: 1 }], aspect: [3, 4], propulsion: ['wingPods', 'nacelles', 'cluster'],
    },
    {
      id: 'cruiser', weight: { base: -1, perDepth: 0.5, max: 4 }, bonus: { weapons: 2, shields: 1, crew: 2 },
      depth: { battery: [4, 5], core: [4, 5], habitat: [3, 3], cargo: [3, 4] }, batteryCols: [1, 2], sponsonChance: 0.5, sectionRooms: 3, citadel: true, grammars: [{ value: 'citadelFlanked', weight: 0.5 }, { value: 'twinHull', weight: 3 }, { value: 'componentBattleship', weight: 1.5 }], aspect: [2.5, 3.5], propulsion: ['bank', 'cluster'],
    },
    {
      id: 'carrier', weight: { base: -2, perDepth: 0.6, max: 4 }, bonus: { pointDefense: 1, engines: 1 }, bays: 3,
      depth: { battery: [3, 4], core: [3, 4], habitat: [3, 4], cargo: [3, 5] }, batteryCols: [1, 2], sponsonChance: 0.3, sectionRooms: 3, grammars: [{ value: 'carrierIsland', weight: 1 }, { value: 'flightDeck', weight: 1 }], aspect: [2.8, 3.6], propulsion: ['bank', 'cluster'],
    },
  ],
  metrics: { compactness: [0.38, 1], corridorRatio: [0.1, 0.45] },
  weapons: {
    light: [{ value: 'module.burstLaser', weight: 3 }, { value: 'module.ionCannon', weight: 1 }],
    heavy: [{ value: 'module.missileLauncher', weight: 2 }, { value: 'module.massDriver', weight: 1 }],
  },
  shields: [{ value: 'module.shieldGen', weight: 3 }, { value: 'module.shieldGenSmall', weight: 1 }],
  stock: [{ item: 'item.missile', min: 2, max: 6 }, { item: 'item.metal', min: 0, max: 4 }],
  living: true,
  aiCore: true,
  crew: {
    required: ['role.pilot', 'role.gunner', 'role.engineer'],
    pool: [{ value: 'role.gunner', weight: 2 }, { value: 'role.engineer', weight: 2 }, { value: 'role.security', weight: 2 }, { value: 'role.medic', weight: 1 }],
    species: ['species.human'],
  },
  doctrine: { targeting: 'weapons' },
  budget: {
    weapons: { base: 2, perDepth: 0.4, max: 6 },
    heavyPct: { base: 15, perDepth: 6, max: 60 },
    shields: { base: 1, perDepth: 0.25, max: 3 },
    engines: { base: 2, perDepth: 0.15, max: 3 },
    reactors: { base: 2, perDepth: 0.3, max: 4 },
    pointDefense: { base: 0, perDepth: 0.25, max: 2 },
    crew: { base: 5, perDepth: 0.5, max: 10 },
    crates: { base: 2, perDepth: 0.3, max: 6 },
    size: { base: 0, perDepth: 0.5, max: 4 },
  },
} satisfies FactionDef;
