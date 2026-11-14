import { describe, expect, it } from 'vitest';
import type { ModuleDef } from '../sim';
import { Layout } from '../sim/shipgen/layout';
import { roomProblems } from '../sim/shipgen/rooms/rules/check';
import { furnishByRule } from '../sim/shipgen/rooms/rules/place';
import { RULES } from '../sim/shipgen/rooms/rules/rules';
import type { RoomRole } from '../sim/shipgen/types';
import { Rng } from '../sim/rng';
import { content } from './index';

const defs = content.modules as Record<string, ModuleDef>;
const beds = (n: number): string[] => Array<string>(n).fill('module.bed');
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
  { role: 'medbay', name: 'D2', need: ['module.med_bed', 'module.med_bed', 'module.med_bed', 'module.med_bed', 'module.recovery'], sizes: [[9, 4], [11, 4], [11, 6]] },
  { role: 'weapons', name: 'G1', need: [MD, BL, PD], sizes: [[12, 7], [13, 7], [12, 8]] },
  { role: 'weapons', name: 'G1', need: [BL, BL], sizes: [[5, 3], [6, 4], [3, 6]], small: true },
  { role: 'weapons', name: 'G2', need: [MD, BL, MD, BL, PD], sizes: [[15, 8], [16, 8]] },
  { role: 'weapons', name: 'G3', need: [MD, MD, BL, PD], sizes: [[13, 8], [15, 10]] },
  { role: 'shields', name: 'S1', need: ['module.shieldGen', 'module.shieldGen', 'module.shieldGen'], sizes: [[12, 5], [13, 5], [17, 5]] },
  { role: 'reactor', name: 'R1', need: ['module.reactor.mk3', 'module.reactor.mk3', 'module.reactor.mk3'], sizes: [[12, 6], [13, 6], [17, 6]] },
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
          const got = tally(pieces.map((p) => p.def));
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
