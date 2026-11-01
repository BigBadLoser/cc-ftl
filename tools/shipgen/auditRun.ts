import { content } from '../../src/content';
import { audit, type Audit } from './audit';
import { gen, stationIds } from './draw';

/** Room-layout audit runs over many seeds (`node tools/shipgen/audit-cli.js`). */

/** Audit `count` seeds of each spec at a depth; one summary line per spec, plus the first examples of each problem. */
export function auditSheet(specs: string[], from: number, count: number, depth: number): string {
  const lines: string[] = [];
  for (const spec of specs) {
    const tally: Record<keyof Audit, number> = { viaQuarters: 0, behind: 0, empty: 0, short: 0, tight: 0, sealed: 0 };
    const ships: Record<keyof Audit, number> = { viaQuarters: 0, behind: 0, empty: 0, short: 0, tight: 0, sealed: 0 };
    const examples: string[] = [];
    let rooms = 0;
    let attempts = 0;
    let courts = 0;
    let floor = 0;
    for (let s = from; s < from + count; s++) {
      const g = gen(spec, s, depth);
      rooms += g.rooms.filter((r) => r.role !== 'hall').length;
      attempts += g.attempts;
      for (const r of g.rooms) {
        if (r.role === 'hall') continue;
        floor += r.tiles.length;
        if (r.role === 'plaza' || r.role === 'garden' || r.role === 'drill') courts += r.tiles.length;
      }
      const a = audit(g);
      for (const k of Object.keys(tally) as (keyof Audit)[]) {
        tally[k] += a[k].length;
        if (a[k].length > 0) ships[k]++;
        if (a[k].length > 0 && examples.length < 6) examples.push(`  seed ${s}: ${k} ${a[k].slice(0, 4).join(', ')}`);
      }
    }
    const cols = (Object.keys(tally) as (keyof Audit)[]).map((k) => `${k} ${tally[k]} (${ships[k]} of ${count})`).join(' | ');
    lines.push(`${spec} d${depth}: rooms ${rooms}, attempts ${(attempts / count).toFixed(1)}, courts ${Math.round((100 * courts) / Math.max(1, floor))}% | ${cols}`, ...examples);
  }
  return lines.join('\n');
}

export const allSpecs = (): string[] => [...Object.keys(content.factions), ...stationIds().map((id) => `${id}:outpost,station,hub`)];
