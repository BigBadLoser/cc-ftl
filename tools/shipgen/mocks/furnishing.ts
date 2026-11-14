/**
 * Furnishing mock (dev tool, not shipped): rooms of a military station, each furnished in two or three arrangements, and a
 * pirate barracks and mess for the kind's mood, laid out as one template of real modules so the labelled view and the
 * layout lab's game renderer can both draw it. Rooms stand in rows, a door in each one's bottom wall onto a corridor.
 *   node tools/shipgen/cli.js --mock tools/shipgen/mocks/furnishing.ts --out <dir>  (then /tools/layout/?case=mock-furnishing)
 */
import { content } from '../../../src/content';
import type { ModuleDef, RoomRole, ShipTemplate } from '../../../src/sim';
import { accessTiles, footprintTiles } from '../../../src/sim/modules/footprint';

type Rot = 0 | 1 | 2 | 3;
/** A piece in room coordinates (0, 0 the room's top-left floor tile). Rot 0 faces south, 1 west, 2 north, 3 east. */
type Piece = [def: string, x: number, y: number, rot?: Rot];
interface RoomMock { caption: string; role?: RoomRole; w: number; h: number; door: number; pieces: Piece[] }

const defs = content.modules as Record<string, ModuleDef>;
const B = 'module.bed', L = 'module.storage_locker', T = 'module.mess_table', C = 'module.chair', G = 'module.galley', K = 'module.storage_rack';
const CR = 'module.storage', LS = 'module.lifeSupport';

/** Chairs either side of a table along x (rot 0) at (x, y): above facing down, below facing up. */
const seats = (x: number, y: number, w = 2): Piece[] => Array.from({ length: w }, (_, i) => [[C, x + i, y - 1, 0], [C, x + i, y + 1, 2]] as Piece[]).flat();

const barracks: RoomMock[] = [
  {
    role: 'quarters', caption: 'B1 bunk rows, aisle', w: 11, h: 6, door: 5,
    pieces: [
      ...[0, 1, 3, 4, 6, 7, 9, 10].map((x): Piece => [B, x, 0, 0]),
      ...[2, 5, 8].map((x): Piece => [L, x, 0, 0]),
      ...[0, 1, 2, 3, 7, 8, 9, 10].map((x): Piece => [L, x, 5, 2]),
    ],
  },
  {
    role: 'quarters', caption: 'B2 alcoves, game table', w: 11, h: 6, door: 5,
    pieces: [
      ...[0, 1, 3, 4].flatMap((y): Piece[] => [[B, 0, y, 1], [B, 9, y, 1]]),
      [L, 0, 2, 3], [L, 10, 2, 1], [L, 0, 5, 3], [L, 10, 5, 1],
      ['module.gametable', 4, 2, 0], [L, 4, 0, 0], [L, 6, 0, 0],
    ],
  },
  {
    role: 'quarters', caption: 'B3 two bays, shared table', w: 11, h: 6, door: 5,
    pieces: [
      ...[0, 1, 9, 10].flatMap((x): Piece[] => [[B, x, 0, 0], [B, x, 4, 2]]),
      [L, 3, 0, 0], [L, 7, 0, 0], [L, 3, 5, 2], [L, 7, 5, 2],
      [T, 4, 2, 0], ...seats(4, 2),
    ],
  },
  {
    role: 'quarters', caption: 'P pirate bunks', w: 11, h: 6, door: 5,
    pieces: [
      [B, 0, 0, 1], [B, 3, 0, 0], [B, 0, 3, 0], [B, 9, 0, 1], [B, 9, 2, 1], [B, 8, 4, 0],
      [CR, 2, 1, 0], [CR, 5, 0, 0], [CR, 6, 0, 0], [CR, 1, 5, 2], ['module.arcade', 10, 5, 2],
      ['module.storage_pallet', 5, 3, 0], [L, 10, 3, 1], [C, 4, 3, 1],
    ],
  },
];

const messes: RoomMock[] = [
  {
    role: 'support', caption: 'M1 table grid', w: 14, h: 5, door: 6,
    pieces: [[G, 0, 0, 0], [G, 2, 0, 0], [LS, 0, 3, 0], ...[5, 8, 11].flatMap((x): Piece[] => [[T, x, 2, 0], ...seats(x, 2)])],
  },
  {
    role: 'support', caption: 'M2 long table', w: 14, h: 5, door: 6,
    pieces: [[G, 0, 4, 2], [G, 12, 4, 2], ...[2, 4, 6, 8, 10].flatMap((x): Piece[] => [[T, x, 2, 0], ...seats(x, 2)])],
  },
  {
    role: 'support', caption: 'M3 galley corner, booths', w: 14, h: 5, door: 6,
    pieces: [[G, 0, 0, 3], [G, 0, 2, 3], [LS, 0, 4, 1], [T, 8, 1, 0], ...seats(8, 1), [T, 11, 1, 0], ...seats(11, 1), ['module.arcade', 13, 4, 2], ['module.gametable', 4, 2, 0]],
  },
  {
    role: 'support', caption: 'P pirate mess', w: 14, h: 5, door: 6,
    pieces: [
      [G, 0, 0, 0], [T, 3, 2, 1], [C, 2, 2, 3], [C, 4, 3, 1], [T, 8, 1, 0], [C, 8, 0, 0], [C, 10, 1, 1], [C, 9, 2, 2],
      [CR, 12, 0, 0], [CR, 13, 0, 0], [CR, 13, 2, 0], ['module.gametable', 10, 3, 0], ['module.arcade', 0, 4, 2], [CR, 2, 0, 0],
    ],
  },
];

const guns: RoomMock[] = [
  {
    role: 'weapons', caption: 'G1 guns on the hull, racks behind', w: 13, h: 6, door: 6,
    pieces: [
      ['module.massDriver', 0, 0], ['module.massDriver', 4, 0], ['module.burstLaser', 8, 0], ['module.pointDefense', 11, 0],
      [K, 0, 5, 2], [K, 2, 5, 2], [K, 9, 5, 2], [K, 11, 5, 2], ['module.battery', 4, 5], ['module.battery', 8, 5],
    ],
  },
  {
    role: 'weapons', caption: 'G2 guns paired, ammo between', w: 13, h: 6, door: 6,
    pieces: [
      ['module.massDriver', 0, 0], ['module.battery', 3, 0], ['module.battery', 3, 1], ['module.massDriver', 4, 0],
      ['module.burstLaser', 8, 0], ['module.battery', 10, 0], ['module.battery', 10, 1], ['module.burstLaser', 11, 0],
      ['module.weaponsConsole', 9, 4, 2], [L, 0, 5, 2], [L, 1, 5, 2],
    ],
  },
];

const medbays: RoomMock[] = [
  {
    role: 'medbay', caption: 'D1 beds along a wall', w: 9, h: 4, door: 4,
    pieces: [...[0, 2, 4, 6].map((x): Piece => ['module.med_bed', x, 0, 0]), ['module.recovery', 7, 2, 2], ['module.console', 0, 3, 2], [L, 1, 3, 2]],
  },
  {
    role: 'medbay', caption: 'D2 bays, pod in the middle', w: 9, h: 4, door: 4,
    pieces: [['module.med_bed', 0, 0, 1], ['module.med_bed', 0, 2, 1], ['module.med_bed', 7, 0, 1], ['module.med_bed', 7, 2, 1], ['module.recovery', 3, 0, 0], ['module.console', 6, 0, 0], [L, 2, 0, 0]],
  },
];

const shields: RoomMock[] = [
  {
    role: 'shields', caption: 'S1 generators in a row', w: 12, h: 4, door: 10,
    pieces: [['module.shieldGen', 0, 0], ['module.shieldGen', 5, 0], ['module.shieldGen', 10, 0], ['module.shieldConsole', 4, 2, 2], ['module.battery', 0, 3], ['module.battery', 11, 3]],
  },
  {
    role: 'shields', caption: 'S2 generators at the ends', w: 12, h: 5, door: 8,
    pieces: [['module.shieldGen', 0, 0], ['module.shieldGen', 10, 0], ['module.shieldGen', 5, 3], ['module.shieldConsole', 4, 0, 0], ['module.battery', 0, 4], ['module.battery', 11, 4]],
  },
];

export const ROWS: RoomMock[][] = [barracks, messes, [...guns, ...medbays], shields];

/** The sheet as one template, the captions and roles at their rooms, and every placement problem found. */
export function mock(): { template: ShipTemplate; captions: { x: number; y: number; text: string; cx: number; cy: number }[]; roles: { x: number; y: number; role: RoomRole }[]; problems: string[] } {
  // Rooms in rows, GAP tiles apart, a caption row above each and a corridor along under each row, its doors onto it;
  // one corridor down the left joins them. Open space between.
  const GAP = 3, X0 = 4, rowsH = ROWS.map((row) => Math.max(...row.map((r) => r.h)));
  const W = X0 + Math.max(...ROWS.map((row) => row.reduce((n, r) => n + r.w + 2 + GAP, 0))) + 2;
  // A row: caption line, the rooms (walls round them), spurs down to the corridor, the corridor with its walls.
  const rowSpan = (h: number): number => 1 + h + 2 + 1 + 4;
  const H = rowsH.reduce((n, h) => n + rowSpan(h), 0) + 2;
  const grid = Array.from({ length: H }, () => Array<string>(W).fill('.'));
  const set = (x: number, y: number, c: string): void => { const row = grid[y]; if (row) row[x] = c; };
  const box = (x0: number, y0: number, x1: number, y1: number): void => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, x === x0 || x === x1 || y === y0 || y === y1 ? '#' : '_');
  };
  const captions: { x: number; y: number; text: string; cx: number; cy: number }[] = [];
  const roles: { x: number; y: number; role: RoomRole }[] = [];
  const modules: NonNullable<ShipTemplate['modules']> = [];
  const problems: string[] = [];
  let top = 1;
  const halls: [number, number][] = [];
  for (const [i, row] of ROWS.entries()) {
    const rowH = rowsH[i] as number, wallTop = top + 1, hallTop = wallTop + rowH + 2 + 1;
    halls.push([hallTop, hallTop + 3]);
    let x = X0;
    for (const r of row) {
      box(x, wallTop, x + r.w + 1, wallTop + r.h + 1);
      const fx = x + 1, fy = wallTop + 1;
      captions.push({ x, y: top, text: r.caption, cx: fx + (r.w - 1) / 2, cy: fy + (r.h - 1) / 2 });
      if (r.role) roles.push({ x: fx, y: fy, role: r.role });
      const taken = new Map<string, string>();
      for (const [def, px, py, rot = 0] of r.pieces) {
        const d = defs[def];
        if (!d) { problems.push(`${r.caption}: no module ${def}`); continue; }
        for (const t of footprintTiles(d, fx + px, fy + py, rot)) {
          const k = `${t.x},${t.y}`;
          if (t.x < fx || t.y < fy || t.x >= fx + r.w || t.y >= fy + r.h) problems.push(`${r.caption}: ${def} at ${px},${py} leaves the room`);
          if (taken.has(k)) problems.push(`${r.caption}: ${def} at ${px},${py} overlaps ${taken.get(k)}`);
          taken.set(k, def);
        }
        modules.push({ def, x: fx + px, y: fy + py, rot });
      }
      // Access tiles: on the room's floor and under nothing else.
      for (const [def, px, py, rot = 0] of r.pieces) {
        const d = defs[def];
        if (!d) continue;
        const own = new Set(footprintTiles(d, fx + px, fy + py, rot).map((t) => `${t.x},${t.y}`));
        for (const t of accessTiles(d, fx + px, fy + py, rot)) {
          if (own.has(`${t.x},${t.y}`)) continue;
          if (t.x < fx || t.y < fy || t.x >= fx + r.w || t.y >= fy + r.h || taken.has(`${t.x},${t.y}`)) problems.push(`${r.caption}: ${def} at ${px},${py} has its access at ${t.x - fx},${t.y - fy} blocked`);
        }
      }
      if (taken.has(`${fx + r.door},${fy + r.h - 1}`)) problems.push(`${r.caption}: the door is blocked`);
      // The door, and a spur from it down to the corridor.
      const dx = fx + r.door, dy = fy + r.h;
      for (let y = dy + 1; y < hallTop; y++) { set(dx - 1, y, '#'); set(dx, y, '_'); set(dx + 1, y, '#'); }
      x += r.w + 2 + GAP;
    }
    top = hallTop + 4;
  }
  // The corridors: under each row, and down the left joining them.
  const last = halls[halls.length - 1] as [number, number];
  box(1, (halls[0] as [number, number])[0], 3 + 1, last[1]);
  for (const [y0, y1] of halls) box(1, y0, W - 2, y1);
  for (const [y0, y1] of halls) for (let y = y0 + 1; y < y1; y++) for (let x = 2; x <= 3; x++) set(x, y, '_');
  for (let y = (halls[0] as [number, number])[0] + 1; y < last[1]; y++) for (let x = 2; x <= 3; x++) set(x, y, '_');
  // Doors where each spur meets its room and its corridor.
  for (const [i, row] of ROWS.entries()) {
    let x = X0;
    let t = 1;
    for (let j = 0; j < i; j++) t = (halls[j] as [number, number])[0] + 4;
    for (const r of row) {
      const dx = x + 1 + r.door, dy = t + 1 + 1 + r.h;
      set(dx, dy, 'D');
      set(dx, (halls[i] as [number, number])[0], 'D');
      x += r.w + 2 + GAP;
    }
  }
  const rows = grid.map((r) => r.join(''));
  return { template: { name: 'Furnishing mock', rows, modules } as ShipTemplate, captions, roles, problems };
}
