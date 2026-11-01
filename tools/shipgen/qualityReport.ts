/**
 * Layout quality report (dev tool, not shipped): room quality (shipgen/rooms/quality.ts) by room role, layout family and room shape,
 * over seeds of every faction and station kind. The baseline to measure
 * generator changes against: compare means over the same seed range, never single seeds.
 */
import { roomQuality, type ModuleDef, type RoomQuality } from '../../src/sim';
import { content } from '../../src/content';
import { factionIds, gen, stationIds } from './draw';

const defs = content.modules as Record<string, ModuleDef>;
const TERMS = ['score', 'pockets', 'alignment', 'circulation', 'balance', 'density', 'openness', 'rect', 'ragged'] as const;

type Sum = Record<(typeof TERMS)[number], number> & { n: number };
export interface QualityTally {
  layouts: number;
  rooms: Sum;
  byRole: Record<string, Sum>;
  /** Rooms (corridors aside) by the layout that drew them (the topology's first word). */
  byFamily: Record<string, Sum>;
  /** Rooms (corridors aside) by shape: a rectangle (rect >= 0.95), near one (>= 0.8), or not. */
  byShape: Record<string, Sum>;
  ms: number;
}

const zero = (): Sum => ({ n: 0, score: 0, pockets: 0, alignment: 0, circulation: 0, balance: 0, density: 0, openness: 0, rect: 0, ragged: 0 });
const add = (s: Sum, q: RoomQuality): void => { s.n++; for (const t of TERMS) s[t] += q[t]; };

export function qualityReport(from: number, count: number, specs = [...factionIds(), ...stationIds().map((s) => (s.startsWith('station.') ? s : `station.${s}`))]): QualityTally {
  const t: QualityTally = { layouts: 0, rooms: zero(), byRole: {}, byFamily: {}, byShape: {}, ms: 0 };
  for (const spec of specs) {
    for (let seed = from; seed < from + count; seed++) {
      const t0 = performance.now();
      let g;
      try { g = gen(spec, seed, 4); } catch { continue; }
      t.ms += performance.now() - t0;
      t.layouts++;
      const roles = g.rooms.map((r) => r.role);
      const mods = (g.template.modules ?? []).map((m) => ({ ...m, rot: m.rot ?? 0 }));
      const rq = roomQuality({ rows: g.template.rows, modules: mods, roomOf: g.roomOf, defs });
      for (const q of rq) {
        const role = roles[q.room] ?? '?';
        add(t.byRole[role] ??= zero(), q);
        if (role === 'hall') continue; // corridors are walkways, not rooms to arrange
        add(t.rooms, q);
        add(t.byFamily[/\((\w+)/.exec(g.topology)?.[1] ?? g.topology.split(' ')[0] ?? '?'] ??= zero(), q);
        add(t.byShape[q.rect >= 0.95 ? 'rectangle' : q.rect >= 0.8 ? 'near' : 'irregular'] ??= zero(), q);
      }
    }
  }
  return t;
}
