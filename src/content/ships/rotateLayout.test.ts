import { describe, expect, it } from 'vitest';
import { content } from '../index';
import type { ModuleDef } from '../../sim';
import { airlockTiles } from '../../sim/modules/airlock';
import { hullSide } from '../../sim/modules/footprint';
import { rotateLayout } from '../../sim/shipgen/rotate';
import { buildStation } from '../../sim/shipgen/stationBuild';

const MODS: Record<string, ModuleDef> = content.modules;

describe('rotateLayout', () => {
  const st = buildStation(content.stations['station.mining']!, 'station.mining', 'outpost', 2, MODS);

  it('four quarter turns give back the layout', () => {
    let r = st;
    for (let q = 0; q < 4; q++) r = rotateLayout(r, MODS);
    expect(r.template.rows).toEqual(st.template.rows.map((row) => row.padEnd(st.width, '.')));
    expect(r.template.modules).toEqual(st.template.modules);
    expect([...r.roomOf]).toEqual([...st.roomOf]);
    expect(r.rooms).toEqual(st.rooms);
  });

  it('turns rows, rooms and modules together: an east-facing airlock faces south, its outer door on the same tile', () => {
    const r = rotateLayout(st, MODS);
    expect([r.width, r.height]).toEqual([st.height, st.width]);
    const at = (x: number, y: number) => ({ x: st.height - 1 - y, y: x });
    const before = (st.template.modules ?? []).filter((m) => MODS[m.def]?.airlock);
    const after = (r.template.modules ?? []).filter((m) => MODS[m.def]?.airlock);
    const turn = { n: 'e', e: 's', s: 'w', w: 'n' } as const;
    before.forEach((m, i) => {
      const def = MODS[m.def]!, n = after[i]!;
      expect(hullSide(def, n.rot)).toBe(turn[hullSide(def, m.rot)!]);
      const o = airlockTiles(def, m).outer;
      expect(airlockTiles(def, n).outer).toEqual(at(o.x, o.y));
    });
    for (const room of st.rooms) for (const i of room.tiles.slice(0, 5)) {
      const p = at(i % st.width, Math.floor(i / st.width));
      expect(r.roomOf[p.y * r.width + p.x]).toBe(st.roomOf[i]);
      expect(r.template.rows[p.y]![p.x]).toBe(st.template.rows[Math.floor(i / st.width)]![i % st.width]);
    }
  });
});
