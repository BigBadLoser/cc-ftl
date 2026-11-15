import { describe, expect, it } from 'vitest';
import type { ModuleDef } from '../sim';
import { Layout } from '../sim/shipgen/layout';
import { roomProblems } from '../sim/shipgen/rooms/rules/check';
import { furnishByRule } from '../sim/shipgen/rooms/rules/place';
import { RULES } from '../sim/shipgen/rooms/rules/rules';
import type { RoomRole } from '../sim/shipgen/types';
import { Rng } from '../sim/rng';
import { footprintTiles } from '../sim/modules/footprint';
import { content } from './index';

const defs = content.modules as Record<string, ModuleDef>;
const beds = (n: number): string[] => Array<string>(n).fill('module.bed');
const k = (n: number, id: string): string[] => Array<string>(n).fill(id);
const MD = 'module.massDriver', BL = 'module.burstLaser', PD = 'module.pointDefense';

/** Each rule, the rooms it is made for (w, h) and what they are planned to hold. */
/** `small`: a room under the rule's size, where extras that do not fit are left out (checked on the layout only). */
const CASES: { role: RoomRole; name: string; need: string[]; sizes: [number, number][]; small?: true }[] = [
  { role: 'quarters', name: 'B1', need: beds(8), sizes: [[11, 5], [11, 6], [12, 5], [13, 6], [5, 9], [6, 9], [7, 10]] },
  { role: 'quarters', name: 'B1', need: beds(6), sizes: [[8, 6], [9, 5], [10, 5], [5, 8], [6, 12]] },
  { role: 'quarters', name: 'B3', need: beds(8), sizes: [[9, 6], [11, 6], [15, 6], [7, 10], [8, 15]] },
  { role: 'quarters', name: 'C1', need: beds(1), sizes: [[3, 6], [4, 5], [5, 4], [3, 4]] },
  { role: 'support', name: 'M1', need: ['module.galley', 'module.mess_table', 'module.mess_table'], sizes: [[11, 5], [14, 5], [18, 6], [14, 9]] },
  { role: 'support', name: 'M2', need: ['module.galley', 'module.mess_table', 'module.mess_table'], sizes: [[11, 5], [14, 5], [18, 6], [14, 9]] },
  { role: 'support', name: 'M3', need: ['module.galley', 'module.mess_table'], sizes: [[11, 5], [14, 5], [18, 6]] },
  { role: 'medbay', name: 'D1', need: ['module.med_bed', 'module.med_bed', 'module.med_bed', 'module.recovery'], sizes: [[9, 4], [10, 4], [13, 5]] },
  { role: 'medbay', name: 'D3', need: ['module.med_bed', 'module.med_bed', 'module.med_bed', 'module.recovery'], sizes: [[3, 10], [3, 12], [4, 11]] },
  { role: 'support', name: 'M4', need: ['module.galley', 'module.mess_table', 'module.mess_table'], sizes: [[6, 14], [6, 15], [5, 12], [16, 6], [17, 6]] },
  { role: 'medbay', name: 'D2', need: ['module.med_bed', 'module.med_bed', 'module.med_bed', 'module.med_bed', 'module.recovery'], sizes: [[9, 4], [11, 4], [11, 6]] },
  { role: 'weapons', name: 'G1', need: [MD, BL, PD], sizes: [[12, 7], [13, 7], [12, 8]] },
  { role: 'weapons', name: 'G1', need: [BL, BL], sizes: [[5, 3], [6, 4], [3, 6]], small: true },
  { role: 'weapons', name: 'G2', need: [MD, BL, MD, BL, PD], sizes: [[15, 8], [16, 8]] },
  { role: 'weapons', name: 'G3', need: [MD, MD, BL, PD], sizes: [[13, 8], [15, 10]] },
  { role: 'shields', name: 'S1', need: ['module.shieldGen', 'module.shieldGen', 'module.shieldGen'], sizes: [[12, 5], [13, 5], [17, 5]] },
  { role: 'reactor', name: 'R1', need: ['module.reactor.mk3', 'module.reactor.mk3', 'module.reactor.mk3'], sizes: [[12, 6], [13, 6], [17, 6]] },
  // The station rooms of furnishing mock round 2 (tools/shipgen/mocks/furnishingRooms.ts), at the mock's size and others.
  { role: 'quarters', name: 'B1', need: k(10, 'module.bunk'), sizes: [[11, 6], [12, 6], [13, 6], [7, 12]] },
  { role: 'quarters', name: 'B4', need: k(4, 'module.bunk'), sizes: [[7, 6], [8, 6], [9, 5], [11, 6]] },
  { role: 'quarters', name: 'B4', need: k(2, 'module.bed'), sizes: [[6, 5], [7, 5]] },
  { role: 'bridge', name: 'CO', need: [], sizes: [[6, 4], [7, 4], [8, 5], [5, 4], [10, 6]] },
  { role: 'bridge', name: 'CO', need: ['module.mess_table', 'module.chair', 'module.chair'], sizes: [[6, 4], [8, 5]] },
  { role: 'cargo', name: 'PA', need: k(2, 'module.storage_rack'), sizes: [[5, 3], [7, 3], [9, 4]] },
  { role: 'cargo', name: 'PA', need: k(3, 'module.storage_cold'), sizes: [[7, 3], [9, 3], [10, 4]] },
  { role: 'armoury', name: 'QM', need: [], sizes: [[9, 5], [10, 5], [11, 6], [7, 5]] },
  { role: 'armoury', name: 'BG', need: ['module.stasis_wheel'], sizes: [[7, 6], [8, 6], [9, 6], [9, 7]] },
  { role: 'industry', name: 'WS', need: ['module.fabricator', ...k(2, 'module.storage_rack'), ...k(2, 'module.storage_locker')], sizes: [[6, 4], [9, 5], [8, 5], [10, 6]] },
  { role: 'industry', name: 'WS', need: k(2, 'module.fabricator'), sizes: [[8, 4], [10, 5], [12, 5]] },
  { role: 'industry', name: 'BK', need: ['module.scrapper', ...k(2, 'module.storage_scrap'), 'module.storage_pallet'], sizes: [[8, 5], [9, 5], [10, 6]] },
  { role: 'industry', name: 'LB', need: [...k(2, 'module.research'), ...k(2, 'module.console'), ...k(2, 'module.storage_locker')], sizes: [[9, 5], [10, 5], [11, 5]] },
  { role: 'industry', name: 'LB', need: k(2, 'module.research'), sizes: [[6, 5], [7, 4], [9, 5]] },
  { role: 'industry', name: 'LB', need: ['module.research'], sizes: [[7, 4], [8, 5]] },
  { role: 'support', name: 'SU', need: [...k(6, 'module.storage_locker'), ...k(2, 'module.chair')], sizes: [[7, 4], [8, 4], [7, 3]] },
  { role: 'support', name: 'SU', need: k(4, 'module.storage_locker'), sizes: [[4, 3], [5, 3], [6, 4]] },
  { role: 'support', name: 'GY', need: k(3, 'module.exercise'), sizes: [[9, 5], [10, 5], [11, 6]] },
  { role: 'support', name: 'GY', need: k(2, 'module.exercise'), sizes: [[7, 4], [8, 5]] },
  { role: 'medbay', name: 'TR', need: ['module.recovery', 'module.med_bed', 'module.med_bed'], sizes: [[7, 4], [8, 4], [9, 5]] },
  { role: 'medbay', name: 'TR', need: ['module.recovery', 'module.med_bed'], sizes: [[5, 4], [6, 4]] },
  { role: 'hangar', name: 'DB', need: k(2, 'module.droneBay'), sizes: [[8, 4], [6, 4], [7, 4], [10, 5]] },
  { role: 'hangar', name: 'DB', need: k(3, 'module.droneBay'), sizes: [[8, 4], [10, 4]] },
  { role: 'hall', name: 'HL', need: [], sizes: [[17, 3], [10, 3], [8, 3], [25, 4], [12, 3]] },
  { role: 'plaza', name: 'CU', need: [], sizes: [[11, 3], [9, 3], [7, 3], [13, 4]] },
  { role: 'plaza', name: 'PZ', need: [], sizes: [[11, 9], [9, 7], [13, 9], [15, 11]] },
];

/** A w x h room with a wall round it, a door under the bottom wall at column d, and a hall beyond the door. */
function room(w: number, h: number, d: number): Layout {
  const rows = Array.from({ length: h + 4 }, (_, y) => Array.from({ length: w + 2 }, (_, x) => {
    if (y === 0 || x === 0 || x === w + 1) return y <= h + 1 ? '#' : '.';
    if (y <= h) return '_';
    if (y === h + 1) return x === d + 1 ? 'D' : '#';
    return y === h + 2 ? '_' : '#';
  }).join(''));
  const roomOf = new Int16Array((w + 2) * (h + 4)).fill(-1);
  for (let y = 1; y <= h; y++) for (let x = 1; x <= w; x++) roomOf[y * (w + 2) + x] = 0;
  for (let x = 1; x <= w; x++) roomOf[(h + 2) * (w + 2) + x] = 1;
  const lay = new Layout(rows, roomOf, ['quarters', 'hall'], defs);
  lay.gunsOnHull = false; // as on a station
  return lay;
}

const tally = (ids: readonly string[]): Record<string, number> => ids.reduce<Record<string, number>>((m, id) => ({ ...m, [id]: (m[id] ?? 0) + 1 }), {});

describe('furnishing rules', () => {
  for (const c of CASES) {
    it(`${c.name} (${c.role}, ${c.need.length} planned): pieces stand clear of each other, every one reached from the door, the plan placed`, () => {
      const rule = RULES[c.role]?.find((a) => a.name.startsWith(c.name));
      expect(rule).toBeDefined();
      for (const [w, h] of c.sizes) {
        for (const d of [Math.floor(w / 2) - 1, Math.floor(w / 2), Math.floor(w / 2) + 1]) {
          const label = `${c.name} ${w}x${h} door ${d}`;
          const pieces = rule!.rule({ w, h, d, need: c.need, defs });
          const inside = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < w && y < h;
          if (!c.small) expect(roomProblems(inside, [{ x: d, y: h - 1 }], pieces, defs), label).toEqual([]);
          // A seated crew member faces r0 -y, r1 +x, r2 +y, r3 -x (furniture.ts): every chair a rule places faces a table beside it.
          const tableTiles = new Set(pieces.filter((p) => p.def === 'module.mess_table').flatMap((p) => footprintTiles(defs[p.def]!, p.x, p.y, p.rot)).map((t) => `${t.x},${t.y}`));
          for (const ch of pieces.filter((p) => p.def === 'module.chair')) {
            const [dx, dy] = ([[0, -1], [1, 0], [0, 1], [-1, 0]] as const)[ch.rot % 4] as readonly [number, number];
            expect(tableTiles.has(`${ch.x + dx},${ch.y + dy}`), `${label} chair ${ch.x},${ch.y} r${ch.rot} faces a table`).toBe(true);
          }
          const got = tally(pieces.map((p) => p.def));
          // No batteries in gun rooms: power storage is the battery room's.
          if (c.role === 'weapons') expect(got['module.battery'] ?? 0, label).toBe(0);
          // The rule's own kinds (beds, guns, gens, reactors, tables) all there; the rest the placer sets beside it.
          for (const [id, n] of Object.entries(tally(c.need))) if (got[id]) expect(got[id], `${label} ${id}`).toBeGreaterThanOrEqual(n);
          // On a layout: furnished by rule, every planned module in, and the room still works.
          const lay = room(w, h, d);
          const made = furnishByRule(lay, new Rng(w * 31 + h * 7 + d), 0, c.role, c.need, () => [0, 1, 2, 3]);
          expect(made, label).not.toBeNull();
          const placed = tally(lay.modules.map((m) => m.def));
          for (const [id, n] of Object.entries(tally(c.need))) expect(placed[id] ?? 0, `${label} placed ${id}`).toBeGreaterThanOrEqual(n);
          expect(roomProblems((x, y) => lay.roomOf[y * lay.w + x] === 0 && lay.at(x, y) === '_', [{ x: d + 1, y: h }], lay.modules, defs), label).toEqual([]);
        }
      }
    });
  }

  // The signed-off mock rooms (tools/shipgen/mocks/furnishingRooms.ts) at their own size: the rule draws the same pieces.
  const MOCKS: { role: RoomRole; name: string; need: string[]; w: number; h: number; d: number; pieces: string }[] = [
    { role: 'bridge', name: 'CO', need: [], w: 6, h: 4, d: 3, pieces: 'chair 2,0,2;mess_table 2,1,0;chair 3,2,0;planter 0,0,0;planter 5,0,0;storage_rack 0,3,2' },
    { role: 'armoury', name: 'QM', need: [], w: 9, h: 5, d: 4, pieces: 'storage_armory 0,0,0;storage_armory 2,0,0;storage_armory 7,0,0;storage_armory 5,0,0;mess_table 3,2,0;chair 3,1,2;storage_armory 0,4,2;storage_armory 7,4,2' },
    { role: 'industry', name: 'WS', need: ['module.fabricator'], w: 9, h: 5, d: 4, pieces: 'storage_rack 0,0,0;storage_rack 7,0,0;fabricator 3,0,0;storage_pallet 0,3,2;storage_pallet 7,3,2' },
    { role: 'medbay', name: 'TR', need: ['module.recovery', 'module.med_bed', 'module.med_bed'], w: 7, h: 4, d: 3, pieces: 'recovery 0,0,0;med_bed 6,0,0;med_bed 4,0,0' },
    { role: 'hangar', name: 'DB', need: k(2, 'module.droneBay'), w: 8, h: 4, d: 4, pieces: 'droneBay 1,1,0;droneBay 5,1,0' },
    { role: 'plaza', name: 'PZ', need: [], w: 11, h: 9, d: 5, pieces: 'planter 0,0,0;planter 10,0,0;planter 4,4,0;planter 6,4,0;bench 4,2,0;bench 5,6,2;bench 2,4,3;bench 8,4,1;vending 0,8,2;vending_red 10,8,2' },
    { role: 'hall', name: 'HL', need: [], w: 17, h: 3, d: 8, pieces: 'planter 0,0,0;bench 1,0,0;planter 3,0,0;vending 6,0,0;vending_red 7,0,0;planter 10,0,0;bench 11,0,0;planter 13,0,0;vending 16,0,0' },
  ];
  for (const m of MOCKS) {
    it(`${m.name} at the mock's size ${m.w}x${m.h} draws the mock room`, () => {
      const rule = RULES[m.role]?.find((a) => a.name.startsWith(m.name));
      const got = rule!.rule({ w: m.w, h: m.h, d: m.d, need: m.need, defs }).map((p) => `${p.def.replace('module.', '')} ${p.x},${p.y},${p.rot}`);
      expect(got.sort()).toEqual(m.pieces.split(';').sort());
    });
  }

  it('barracks beds come in pairs, a locker between the two, and only beds have lockers', () => {
    const b1 = RULES.quarters?.find((a) => a.name.startsWith('B1'));
    const pieces = b1!.rule({ w: 11, h: 5, d: 5, need: beds(8), defs });
    const lockers = pieces.filter((p) => p.def === 'module.storage_locker');
    expect(pieces.filter((p) => p.def === 'module.bed')).toHaveLength(8);
    expect(lockers).toHaveLength(4);
    for (const l of lockers) {
      const beside = pieces.filter((p) => p.def === 'module.bed' && Math.abs(p.x - l.x) === 1 && Math.abs(p.y - l.y) <= 1);
      expect(beside, `locker ${l.x},${l.y}`).toHaveLength(2);
    }
  });
});
