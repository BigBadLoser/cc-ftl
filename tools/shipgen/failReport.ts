/** Dev tool: why layouts were rejected (GenResult.failures) and the problems of accepted ones, over seeds of every spec. */
import { factionIds, gen, stationIds } from './draw';

export function failReport(from: number, count: number, only?: string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const spec of [...factionIds(), ...stationIds().map((s) => (s.startsWith('station.') ? s : `station.${s}`))].filter((s) => !only || s === only)) {
    for (let seed = from; seed < from + count; seed++) {
      let g;
      try { g = gen(spec, seed, 4); } catch (e) { (out[spec] ??= []).push(`seed ${seed} threw ${(e as Error).message}`); continue; }
      for (const f of g.failures) (out[spec] ??= []).push(`seed ${seed} fail: ${f}`);
      for (const p of g.problems) (out[spec] ??= []).push(`seed ${seed} PROBLEM: ${p}`);
    }
  }
  return out;
}
