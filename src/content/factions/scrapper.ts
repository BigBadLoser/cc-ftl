import type { ChunkDef, FactionDef } from '../../sim';

/**
 * Scrapper raiders: lopsided hulls of bolted-on chunks, irregular edges and protrusions. Heavy storage, cheap guns,
 * patched reactors; they board by shuttle. Chunk ASCII: see ChunkDef (bow points west, pods drawn as north pods).
 */
const bows: ChunkDef[] = [
  { id: 'scrap.bow.wedge', rows: [
    '....######',
    '..###bbbb#',
    '###bbbbbb#',
    '#bbbbbbbb#',
    '#bbbbbbbb#',
    '##bbbbbbbD',
    '.###bbbbb#',
    '...#######',
  ] },
  { id: 'scrap.bow.cockpit', rows: [
    '...########.',
    '.###bbbbbb#.',
    '##bbbbbbbb##',
    '#bbbbbbbbbbD',
    '##bbbbbbbbb#',
    '.#####D#####',
    '.#11111111#.',
    '.##111111##.',
    '..########..',
  ] },
  { id: 'scrap.bow.prow', rows: [
    '......######',
    '......#bbbb#',
    '#######bbbbD',
    '#11111Dbbbb#',
    '#11111#bbbb#',
    '#######bbbb#',
    '......######',
  ] },
  { id: 'scrap.bow.jaw', rows: [
    '#######.....',
    '#11111#.....',
    '#11111######',
    '#11111Dbbbb#',
    '######bbbbbD',
    '...#bbbbbbb#',
    '...#bbbbbbb#',
    '...#########',
  ] },
];

const sterns: ChunkDef[] = [
  { id: 'scrap.stern.low', rows: [
    '.....#######',
    '.....#eeeee#',
    '######eeeee#',
    '#rrrr#eeeee#',
    'DrrrrDeeeee#',
    '#rrrr#eeeee#',
    '#rrrr#eeeee#',
    '######eeeee#',
    '.....#eeeee#',
    '.....#eeeee#',
    '.....#eeeee#',
    '.....#######',
  ] },
  { id: 'scrap.stern.high', rows: [
    '.....#######',
    '.....#eeeee#',
    '.....#eeeee#',
    '.....#eeeee#',
    '######eeeee#',
    '#rrrr#eeeee#',
    '#rrrr#eeeee#',
    'DrrrrDeeeee#',
    '#rrrr#eeeee#',
    '######eeeee#',
    '.....#eeeee#',
    '.....#######',
  ] },
  { id: 'scrap.stern.single', rows: [
    '##########',
    '#eeeeeeee#',
    'Deeeeeeee#',
    '#eeeeeeee#',
    '#eeeeeeee#',
    '##########',
  ] },
];

const pods: ChunkDef[] = [
  { id: 'scrap.pod.box', rows: [
    '######',
    '#1111#',
    '#1111#',
    '#1111#',
    '##D###',
  ] },
  { id: 'scrap.pod.ell', rows: [
    '...#####',
    '####111#',
    '#111111#',
    '#111111#',
    '#111111#',
    '####D###',
  ] },
  { id: 'scrap.pod.twin', rows: [
    '#########',
    '#111#222#',
    '#111#222#',
    '#111D222#',
    '#111#222#',
    '##D######',
  ] },
  { id: 'scrap.pod.tower', rows: [
    '#####',
    '#111#',
    '#111#',
    '#111#',
    '#111#',
    '#111#',
    '##D##',
  ] },
  { id: 'scrap.pod.slab', rows: [
    '#########',
    '#1111111#',
    '#1111111#',
    '####D####',
  ] },
  { id: 'scrap.pod.hold', weight: 1.5, rows: [
    '##########',
    '#11111111#',
    '#11111111#',
    '#11111111#',
    '#11111111#',
    '#11111111#',
    '###D######',
  ] },
];

const nubs: ChunkDef[] = [
  { id: 'scrap.nub.box', rows: ['#####', '#111#', '#111#', '##D##'] },
  { id: 'scrap.nub.crate', rows: ['####', '#11#', '#11#', '#D##'] },
  { id: 'scrap.nub.tank', rows: ['.####.', '##11##', '#1111#', '#1111#', '###D##'] },
  { id: 'scrap.nub.strip', rows: ['######', '#1111#', '##D###'] },
];

export const scrapper = {
  name: 'Scrapper',
  motif: 'motif.scrapper',
  art: { hull: 'hull.patched', wall: 'wall.rusted', roof: 'roof.patchwork', livery: 'livery.scrapper', signature: ['module.vehicle_bay', 'module.storage'] },
  hull: { symmetry: 'none', corridorWidth: [1, 2], repeatPods: false, nubChance: 0.55, gapChance: 0.3 },
  chunks: { bows, sterns, pods, nubs },
  rooms: [
    { value: 'cargo', weight: 5 }, { value: 'weapons', weight: 3 }, { value: 'quarters', weight: 2 },
    { value: 'reactor', weight: 1 }, { value: 'shields', weight: 1 },
  ],
  requiredRooms: ['hangar', 'weapons', 'quarters', 'cargo'],
  fill: {
    cargo: [
      { def: 'module.storage', min: 3, max: 6, stock: [{ item: 'item.scrap', min: 2, max: 8 }, { item: 'item.metal', min: 0, max: 4 }] },
      { def: 'module.fabricator', min: 0, max: 1 },
    ],
    hangar: [{ def: 'module.storage', min: 1, max: 2, stock: [{ item: 'item.scrap', min: 2, max: 6 }] }],
    quarters: [{ def: 'module.storage', min: 0, max: 1, stock: [{ item: 'item.polymer', min: 0, max: 4 }] }],
    weapons: [{ def: 'module.storage', min: 0, max: 1 }],
  },
  weapons: {
    light: [{ value: 'module.burstLaser', weight: 3 }, { value: 'module.incendiaryLauncher', weight: 2 }],
    heavy: [{ value: 'module.massDriver', weight: 1 }],
  },
  shields: [{ value: 'module.shieldGenSmall', weight: 1 }],
  living: true,
  aiCore: false,
  crew: {
    required: ['role.pilot', 'role.gunner', 'role.security', 'role.security'],
    pool: [{ value: 'role.security', weight: 3 }, { value: 'role.engineer', weight: 2 }, { value: 'role.gunner', weight: 1 }],
    species: ['species.human'],
  },
  doctrine: { targeting: 'random', boarding: { party: 2, afterSec: 60, losingBelow: 0.6, weapon: 'item.sidearm' } },
  budget: {
    pods: { base: 2, perDepth: 0.3, max: 5 },
    weapons: { base: 1.6, perDepth: 0.35, max: 4 },
    heavyPct: { base: 5, perDepth: 5, max: 40 },
    shields: { base: 0, perDepth: 0.25, max: 2 },
    engines: { base: 1, perDepth: 0.2, max: 2 },
    reactors: { base: 2, perDepth: 0.3, max: 3 },
    pointDefense: { base: 0, perDepth: 0, max: 0 },
    crew: { base: 4, perDepth: 0.4, max: 8 },
  },
} satisfies FactionDef;
