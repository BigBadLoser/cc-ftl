/**
 * Use-rule report (dev tool, not shipped): rule breaks (shipgen/rooms/usage.ts) over seeds of every faction and station
 * kind, by kind of break, module and room role.
 */
import { checkUse, type ModuleDef } from '../../src/sim';
import { content } from '../../src/content';
import { factionIds, gen, stationIds } from './draw';

const defs = content.modules as Record<string, ModuleDef>;

export interface UsageTally { layouts: number; modules: number; breaks: number; byKind: Record<string, number>; byDef: Record<string, number>; byRole: Record<string, number>; bySpec: Record<string, number> }

export function usageReport(from: number, count: number, specs = [...factionIds(), ...stationIds().map((s) => (s.startsWith('station.') ? s : `station.${s}`))]): UsageTally {
  const t: UsageTally = { layouts: 0, modules: 0, breaks: 0, byKind: {}, byDef: {}, byRole: {}, bySpec: {} };
  const add = (o: Record<string, number>, k: string): void => { o[k] = (o[k] ?? 0) + 1; };
  for (const spec of specs) {
    for (let seed = from; seed < from + count; seed++) {
      let g;
      try { g = gen(spec, seed, 4); } catch { continue; }
      t.layouts++;
      const mods = g.template.modules ?? [];
      t.modules += mods.length;
      for (const b of checkUse(g.template.rows, mods.map((m) => ({ ...m, rot: m.rot ?? 0 })), defs)) {
        t.breaks++;
        add(t.byKind, b.kind); add(t.byDef, `${b.def} ${b.kind}`); add(t.bySpec, spec);
        const room = g.roomOf[b.y * g.width + b.x] ?? -1;
        add(t.byRole, room >= 0 ? (g.rooms[room]?.role ?? '?') : 'none');
      }
    }
  }
  return t;
}
