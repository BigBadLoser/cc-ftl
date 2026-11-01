import { describe, expect, it } from 'vitest';
import { Rng } from '../../rng';
import { dockSpec, type RoomSpec } from '../plan';
import { SLOT_DEPTH, SLOT_WING } from './assign';
import { coreBlock } from './core';
import { K } from './grid';
import { harbourStrategy } from './harbour';
import { PREC, addRoom, type Ctx2 } from './kit';
import type { Facility } from './program';
import { rasterise, type Structure } from './structure';
import type { Template } from './template';
import { build } from './walls';

const fac = (spec: RoomSpec, shape: 'rect' | 'soft'): Facility => ({ spec, shape, minSide: 3, area: { min: spec.w * spec.h, target: spec.w * spec.h, max: spec.w * spec.h } });

/** A core station (engineering block, inner ring, promenade broken at a south harbour) and its harbour slot parcel. */
function setup(R: number, customs: [number, number]): { c: Ctx2; slot: number[]; facilities: Facility[] } {
  const t: Template = {
    kind: 'concentric', centre: 'core', occupant: 'engineering', rc: 9.5, outer: 0, bands: [0, R - 14],
    rings: [{ w: 3, gaps: [[Math.PI / 2, 2 * Math.atan((7 + SLOT_WING) / R)]] }, { w: 2 }], spokes: [{ dir: 6, hw: 1, reach: 0, from: 1 }], chords: [],
    harbours: [{ dir: 2, docks: 3 }], open: [], block: coreBlock([[8, 7], [7, 6], [7, 6], [12, 5]]),
  };
  const s = rasterise(t, R) as Structure;
  expect(typeof s).toBe('object');
  const g = s.g;
  const band = s.regions.filter((r) => r.band === 1).flatMap((r) => r.tiles);
  // The slot as assign() cuts it: the bank's half (seven for three docks) and a wing either side, SLOT_DEPTH from the face.
  const slot = band.filter((i) => g.y(i) >= s.faces[0]!.line - SLOT_DEPTH + 1 && Math.abs(g.x(i)) <= 7 + SLOT_WING);
  const c: Ctx2 = { rng: new Rng(1), s, g, rooms: [], publics: [], halls: new Map(), owner: new Map() };
  addRoom(c, { tiles: g.tiles((k) => k === K.Hall), spec: { role: 'hall', mods: [], w: 1, h: 1 }, dept: 'public', prec: PREC.hall, doors: [] });
  c.publics.push(0);
  for (const i of slot) c.owner.set(i, 'harbour');
  // The band's other floor: one plain room per side, so the slot's walls fall as they would among neighbours.
  for (const side of [-1, 1]) {
    const ts = band.filter((i) => !c.owner.has(i) && Math.sign(g.x(i)) === side);
    addRoom(c, { tiles: ts, spec: { role: 'cargo', mods: [], w: 3, h: 3 }, dept: 'market', prec: PREC.soft + c.rooms.length, doors: ['public'] });
  }
  const facilities = [
    ...[0, 1, 2].map(() => fac(dockSpec(), 'rect')),
    fac({ role: 'armoury', mods: [], w: customs[0], h: customs[1], pinned: true }, 'soft'),
    fac({ role: 'bridge', mods: [], w: 7, h: 5, pinned: true }, 'soft'),
  ];
  return { c, slot, facilities };
}

describe('harbour slot in a core station', () => {
  for (const [R, customs] of [[32, [9, 3]], [33, [10, 6]], [34, [10, 4]], [31, [9, 3]]] as const) {
    it(`gives the dock office and customs their floor and doors (R ${R}, customs ${customs[0]}x${customs[1]})`, () => {
      const { c, slot, facilities } = setup(R, [customs[0], customs[1]]);
      expect(harbourStrategy(c, 'harbour', slot, c.s.faces[0]!, facilities)).toBe(true);
      const d = build(c);
      expect(typeof d).not.toBe('string');
      if (typeof d === 'string') return;
      const floorOf = (role: string): number => {
        const id = c.rooms.findIndex((r) => r.spec.role === role && r.dept === 'harbour');
        let n = 0;
        for (let i = 0; i < d.floor.length; i++) if (d.floor[i] === id) n++;
        return n;
      };
      const doorsOf = (role: string): number => {
        const id = c.rooms.findIndex((r) => r.spec.role === role && r.dept === 'harbour');
        return d.doors.filter((w) => c.g.nb(w).some((j) => d.floor[j] === id)).length;
      };
      // Office and customs at their target size at least; each with a door.
      expect(floorOf('bridge')).toBeGreaterThanOrEqual(7 * 5);
      expect(floorOf('armoury')).toBeGreaterThanOrEqual(customs[0] * customs[1]);
      expect(doorsOf('bridge')).toBeGreaterThan(0);
      expect(doorsOf('armoury')).toBeGreaterThanOrEqual(2);
      expect(c.rooms.filter((r) => r.spec.role === 'dock')).toHaveLength(3);
    });
  }
});
