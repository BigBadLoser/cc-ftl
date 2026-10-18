import type { ChunkDef, FactionDef } from '../../sim';

/**
 * Drones: symmetric, compact hulls of one repeated pod design, clean right angles. No beds or life support: crewed by
 * robots (species to come; they spawn as humans for now) and meant to be captured by disabling the AI core (follow-up).
 */
const bows: ChunkDef[] = [
  { id: 'drone.bow.block', rows: [
    '..#######',
    '.##bbbbb#',
    '##bbbbbb#',
    '#bbbbbbbD',
    '##bbbbbb#',
    '.##bbbbb#',
    '..#######',
  ] },
  { id: 'drone.bow.core', rows: [
    '##########',
    '#aaa#bbbb#',
    '#aaa#bbbb#',
    '#aaaDbbbbD',
    '#aaa#bbbb#',
    '#aaa#bbbb#',
    '##########',
  ] },
  { id: 'drone.bow.prong', rows: [
    '#####......',
    '#www#######',
    '#wwwDbbbbb#',
    '#####bbbbb#',
    '....#bbbbbD',
    '#####bbbbb#',
    '#WWWDbbbbb#',
    '#WWW#######',
    '#####......',
  ] },
];

const sterns: ChunkDef[] = [
  { id: 'drone.stern.twin', rows: [
    '###########',
    '#rrr#eeeee#',
    '#rrr#eeeee#',
    '#rrrDeeeee#',
    '#####eeeee#',
    'Deeeeeeeee#',
    '#####eeeee#',
    '#RRRDeeeee#',
    '#RRR#eeeee#',
    '#RRR#eeeee#',
    '###########',
  ] },
  { id: 'drone.stern.box', rows: [
    '##########',
    '#eeeeeeee#',
    '#eeeeeeee#',
    'Deeeeeeee#',
    '#eeeeeeee#',
    '#eeeeeeee#',
    '##########',
  ] },
];

const pods: ChunkDef[] = [
  { id: 'drone.pod.cell', rows: [
    '######',
    '#1111#',
    '#1111#',
    '#1111#',
    '#1111#',
    '##D###',
  ] },
  { id: 'drone.pod.cube', rows: [
    '#####',
    '#111#',
    '#111#',
    '#111#',
    '##D##',
  ] },
  { id: 'drone.pod.double', rows: [
    '#########',
    '#111#222#',
    '#111#222#',
    '#111#222#',
    '##D###D##',
  ] },
];

export const drones = {
  name: 'Drone',
  motif: 'motif.drone',
  art: { hull: 'hull.clean', wall: 'wall.panel', roof: 'roof.grid', livery: 'livery.drone', signature: ['module.aiCore', 'module.pointDefense'] },
  hull: { symmetry: 'mirror', corridorWidth: [1, 1], repeatPods: true, nubChance: 0, gapChance: 0 },
  chunks: { bows, sterns, pods, nubs: [] },
  rooms: [
    { value: 'weapons', weight: 4 }, { value: 'shields', weight: 2 }, { value: 'reactor', weight: 1 }, { value: 'cargo', weight: 1 },
  ],
  requiredRooms: ['weapons', 'shields', 'core'],
  fill: {
    cargo: [{ def: 'module.storage', min: 1, max: 2, stock: [{ item: 'item.electronics', min: 1, max: 4 }] }],
  },
  weapons: {
    light: [{ value: 'module.burstLaser', weight: 3 }, { value: 'module.ionCannon', weight: 2 }],
    heavy: [{ value: 'module.massDriver', weight: 1 }],
  },
  shields: [{ value: 'module.shieldGenSmall', weight: 2 }, { value: 'module.shieldGen', weight: 1 }],
  living: false,
  aiCore: true,
  crew: {
    required: ['role.pilot', 'role.gunner'],
    pool: [{ value: 'role.engineer', weight: 1 }],
    species: ['species.robot'],
  },
  doctrine: { targeting: 'shields' },
  budget: {
    pods: { base: 2, perDepth: 0.3, max: 4 },
    weapons: { base: 2, perDepth: 0.4, max: 5 },
    heavyPct: { base: 10, perDepth: 6, max: 50 },
    shields: { base: 1, perDepth: 0.2, max: 2 },
    engines: { base: 1, perDepth: 0.25, max: 2 },
    reactors: { base: 2, perDepth: 0.25, max: 4 },
    pointDefense: { base: 1, perDepth: 0.2, max: 2 },
    crew: { base: 2, perDepth: 0.2, max: 4 },
  },
} satisfies FactionDef;
