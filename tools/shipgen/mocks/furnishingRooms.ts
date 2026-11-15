/**
 * Furnishing mock, round 2 (dev tool, not shipped): the rooms without a furnishing rule yet, and the rooms the new
 * furniture opens (bunks, the brig's stasis wheel, the quartermaster's armoury lockers, the tank farm, the gym, hall and
 * customs furniture). Hand-placed, one or two takes each; door in the middle of the bottom wall.
 *   node tools/shipgen/cli.js --mock tools/shipgen/mocks/furnishingRooms.ts --out <dir>
 */
import { sheet, type Piece, type RoomMock, type Sheet } from './furnishing';

const BK = 'module.bunk', L = 'module.storage_locker', T = 'module.mess_table', C = 'module.chair', BE = 'module.bench';
const PL = 'module.planter', V = 'module.vending', VR = 'module.vending_red', BT = 'module.battery', CO = 'module.console';

/** Bunk pairs (bunk, locker, bunk) along the top wall from x0, n of them, a tile apart. */
const topPairs = (x0: number, n: number): Piece[] => Array.from({ length: n }, (_, i): Piece[] => { const x = x0 + 4 * i; return [[BK, x, 0, 0], [L, x + 1, 0, 0], [BK, x + 2, 0, 0]]; }).flat();
const botPairs = (xs: number[], y: number): Piece[] => xs.flatMap((x): Piece[] => [[BK, x, y, 2], [L, x + 1, y + 1, 2], [BK, x + 2, y, 2]]);

const quarters: RoomMock[] = [
  { role: 'quarters', caption: 'B1 bunks 11x6 (20 crew)', w: 11, h: 6, door: 5, pieces: [...topPairs(0, 3), ...botPairs([0, 8], 4)] },
  { role: 'quarters', caption: 'B1 bunks 7x6 (8)', w: 7, h: 6, door: 3, pieces: [...topPairs(0, 2), ['module.arcade', 0, 5, 2], ['module.gametable', 5, 3, 0]] },
  { role: 'bridge', caption: "CO chief's office 6x4", w: 6, h: 4, door: 3, pieces: [[C, 2, 0, 0], [T, 2, 1, 0], [C, 3, 2, 2], [PL, 0, 0, 0], [PL, 5, 0, 0], ['module.storage_rack', 0, 3, 2]] },
];

const stores: RoomMock[] = [
  { role: 'cargo', caption: 'PA pantry 7x3', w: 7, h: 3, door: 3, pieces: [['module.storage_cold', 0, 0, 0], ['module.storage_cold', 2, 0, 0], ['module.storage_cold', 5, 0, 0], ['module.storage_rack', 0, 2, 2]] },
  { role: 'armoury', caption: 'QM quartermaster 9x5', w: 9, h: 5, door: 4, pieces: [['module.storage_armory', 0, 0, 0], ['module.storage_armory', 2, 0, 0], ['module.storage_armory', 5, 0, 0], ['module.storage_armory', 7, 0, 0], [T, 3, 2, 0], [C, 3, 1, 0], ['module.storage_armory', 0, 4, 2], ['module.storage_armory', 7, 4, 2]] },
  { role: 'cargo', caption: 'TF tank farm 10x6', w: 10, h: 6, door: 5, pieces: [...[0, 2, 4, 6, 8].map((x): Piece => ['module.storage_tank', x, 0, 0]), ['module.storage_tank', 0, 4, 2], ['module.storage_tank', 2, 4, 2], ['module.storage_tank', 7, 4, 2]] },
  { role: 'armoury', caption: 'BG brig 7x6', w: 7, h: 6, door: 3, pieces: [['module.stasis_wheel', 2, 0, 0], [C, 0, 4, 3], [L, 0, 0, 3]] },
];

const works: RoomMock[] = [
  { role: 'industry', caption: 'WS workshop 9x5', w: 9, h: 5, door: 4, pieces: [['module.storage_rack', 0, 0, 0], ['module.fabricator', 3, 0, 0], ['module.storage_rack', 7, 0, 0], ['module.storage_pallet', 0, 3, 2], ['module.storage_pallet', 7, 3, 2]] },
  { role: 'industry', caption: 'BK breaker 10x6', w: 10, h: 6, door: 5, pieces: [['module.storage_scrap', 0, 0, 0], ['module.scrapper', 3, 0, 0], ['module.storage_scrap', 8, 0, 0], ['module.storage_pallet', 8, 4, 2], ['module.storage_pallet', 0, 4, 2]] },
  { role: 'industry', caption: 'LB lab 9x5', w: 9, h: 5, door: 4, pieces: [['module.research', 0, 0, 0], ['module.research', 6, 0, 0], ['module.storage_cold', 0, 4, 2], [PL, 8, 4, 2]] },
  { role: 'support', caption: 'SU suit-up 7x4', w: 7, h: 4, door: 3, pieces: [[L, 0, 0, 0], [L, 1, 0, 0], [L, 2, 0, 0], [L, 4, 0, 0], [L, 5, 0, 0], [L, 6, 0, 0], [BE, 0, 3, 2], [BE, 5, 3, 2]] },
];

const power: RoomMock[] = [
  { role: 'reactor', caption: 'BR batts 7x4', w: 7, h: 4, door: 3, pieces: [[BT, 0, 0], [BT, 1, 0], [CO, 3, 0, 0], [BT, 5, 0], [BT, 6, 0]] },
  { role: 'reactor', caption: 'BR batts 11x4 hub', w: 11, h: 4, door: 5, pieces: [[BT, 0, 0], [BT, 1, 0], [BT, 2, 0], [BT, 3, 0], [CO, 5, 0, 0], [BT, 7, 0], [BT, 8, 0], [BT, 9, 0], [BT, 10, 0]] },
  { role: 'medbay', caption: 'TR trauma 7x4', w: 7, h: 4, door: 3, pieces: [['module.recovery', 0, 0, 0], ['module.med_bed', 4, 0, 0], ['module.med_bed', 6, 0, 0]] },
  { role: 'hangar', caption: 'DB drone bay 8x4', w: 8, h: 4, door: 4, pieces: [['module.droneBay', 1, 1, 0], ['module.droneBay', 5, 1, 0]] },
];

const social: RoomMock[] = [
  { role: 'support', caption: 'GY gym 9x5', w: 9, h: 5, door: 4, pieces: [['module.exercise', 1, 1, 0], ['module.exercise', 4, 1, 0], ['module.exercise', 7, 1, 0], [BE, 0, 4, 2], [BE, 7, 4, 2], [V, 8, 0, 0]] },
  { role: 'hall', caption: 'HL hall street 17x3', w: 17, h: 3, door: 8, pieces: [[PL, 0, 0, 0], [BE, 1, 0, 0], [PL, 3, 0, 0], [V, 6, 0, 0], [VR, 7, 0, 0], [PL, 10, 0, 0], [BE, 11, 0, 0], [PL, 13, 0, 0], [V, 16, 0, 0]] },
  { role: 'hall', caption: 'CU customs 11x3', w: 11, h: 3, door: 5, pieces: [[T, 3, 0, 0], [C, 3, 1, 2], [C, 4, 1, 2], [BE, 8, 0, 0], [PL, 10, 0, 0], [PL, 0, 0, 0]] },
  {
    role: 'plaza', caption: 'PZ parade hall 11x9', w: 11, h: 9, door: 5,
    pieces: [[PL, 0, 0, 0], [PL, 10, 0, 0], [PL, 4, 4, 0], [PL, 6, 4, 0], [BE, 4, 2, 0], [BE, 5, 6, 2], [BE, 2, 4, 3], [BE, 8, 4, 1], [V, 0, 8, 2], [VR, 10, 8, 2]],
  },
];

export const ROOM_ROWS: RoomMock[][] = [quarters, stores, works, power, social];

export function mock(): Sheet { return sheet(ROOM_ROWS, 'Furnishing: more rooms'); }
