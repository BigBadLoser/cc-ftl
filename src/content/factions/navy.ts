import type { ChunkDef, FactionDef } from '../../sim';

/**
 * Navy / corporate: clean, disciplined, near-symmetric hulls (mirrored shape; rooms may differ side to side), a
 * tapered nose, a broad engine block, well armed and shielded.
 */
const bows: ChunkDef[] = [
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
    '.###11111#bbbbb#',
    '##1111111Dbbbbb#',
    '#11111111#bbbbbD',
    '#11111111#bbbbbD',
    '##1111111Dbbbbb#',
    '.###11111#bbbbb#',
    '...#############',
  ] },
];

const sterns: ChunkDef[] = [
  { id: 'navy.stern.triple', rows: [
    '###########',
    '#rrr#eeeee#',
    '#rrr#eeeee#',
    '#rrrDeeeee#',
    '#rrr#eeeee#',
    '#rrr#eeeee#',
    '#####eeeee#',
    'Deeeeeeeee#',
    'Deeeeeeeee#',
    '#####eeeee#',
    '#RRR#eeeee#',
    '#RRR#eeeee#',
    '#RRRDeeeee#',
    '#RRR#eeeee#',
    '#RRR#eeeee#',
    '###########',
  ] },
  { id: 'navy.stern.wide', rows: [
    '....#######',
    '....#eeeee#',
    '#####eeeee#',
    '#rrr#eeeee#',
    '#rrrDeeeee#',
    '#####eeeee#',
    'Deeeeeeeee#',
    'Deeeeeeeee#',
    '#####eeeee#',
    '#RRRDeeeee#',
    '#RRR#eeeee#',
    '#####eeeee#',
    '....#eeeee#',
    '....#######',
  ] },
];

const pods: ChunkDef[] = [
  { id: 'navy.pod.bay', rows: [
    '########',
    '#111111#',
    '#111111#',
    '#111111#',
    '#111111#',
    '###D####',
  ] },
  { id: 'navy.pod.split', rows: [
    '##########',
    '#1111#222#',
    '#1111#222#',
    '#1111#222#',
    '#1111#222#',
    '##D####D##',
  ] },
  { id: 'navy.pod.chamfer', rows: [
    '.#######.',
    '##11111##',
    '#1111111#',
    '#1111111#',
    '#1111111#',
    '####D####',
  ] },
];

export const navy = {
  name: 'Navy',
  motif: 'motif.navy',
  art: { hull: 'hull.plated', wall: 'wall.clean', roof: 'roof.armour', livery: 'livery.navy', signature: ['module.shieldGen', 'module.missileLauncher'] },
  hull: { symmetry: 'loose', corridorWidth: [2, 2], repeatPods: false, nubChance: 0, gapChance: 0 },
  chunks: { bows, sterns, pods, nubs: [] },
  rooms: [
    { value: 'weapons', weight: 4 }, { value: 'shields', weight: 2 }, { value: 'quarters', weight: 2 },
    { value: 'cargo', weight: 1 }, { value: 'reactor', weight: 1 },
  ],
  requiredRooms: ['weapons', 'shields', 'quarters', 'core', 'cargo'],
  fill: {
    cargo: [
      { def: 'module.storage', min: 2, max: 3, stock: [{ item: 'item.missile', min: 3, max: 8 }, { item: 'item.metal', min: 0, max: 4 }] },
      { def: 'module.fabricator', min: 0, max: 1 },
    ],
  },
  weapons: {
    light: [{ value: 'module.burstLaser', weight: 3 }, { value: 'module.ionCannon', weight: 1 }],
    heavy: [{ value: 'module.missileLauncher', weight: 2 }, { value: 'module.massDriver', weight: 1 }],
  },
  shields: [{ value: 'module.shieldGen', weight: 3 }, { value: 'module.shieldGenSmall', weight: 1 }],
  living: true,
  aiCore: true,
  crew: {
    required: ['role.pilot', 'role.gunner', 'role.engineer'],
    pool: [{ value: 'role.gunner', weight: 2 }, { value: 'role.engineer', weight: 2 }, { value: 'role.security', weight: 2 }, { value: 'role.medic', weight: 1 }],
    species: ['species.human'],
  },
  doctrine: { targeting: 'weapons' },
  budget: {
    pods: { base: 2, perDepth: 0.3, max: 5 },
    weapons: { base: 2, perDepth: 0.4, max: 6 },
    heavyPct: { base: 15, perDepth: 6, max: 60 },
    shields: { base: 1, perDepth: 0.3, max: 3 },
    engines: { base: 2, perDepth: 0.15, max: 3 },
    reactors: { base: 2, perDepth: 0.3, max: 4 },
    pointDefense: { base: 0, perDepth: 0.25, max: 2 },
    crew: { base: 5, perDepth: 0.5, max: 10 },
  },
} satisfies FactionDef;
