import { describe, expect, it } from 'vitest';
import { generateStation, type ModuleDef, type StationDef } from '../sim';
import { content } from './index';
import { stations } from './stations';

/**
 * The wheel's output pinned for seeds 1-24 (trading, size station): a hash of the template rows and modules. Refactors
 * that should not change the layout keep it; a step that changes the wheel on purpose updates it (docs/STATIONGEN2.md).
 */

const defs = content.modules as Record<string, ModuleDef>;

function hash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(16).padStart(8, '0');
}

const PIN: string[] = [
  '5bc6cdbc','6a9ec296','ee9eb0b2','0b981a4d','77f78075','0c47d675','05278c25','579ecb66','f5144691','bc9cbde1','65db0894','84a3e88b',
  '69df9bef','c0da67fe','c636a8dd','2553cfad','389b59da','44e2c9a3','4908fc07','2bf4fcad','426c9d30','7ba4ff07','4053dff2','79203b90',
];

describe('wheel station pin', () => {
  it('trading wheels for seeds 1-24 are unchanged', () => {
    const def = stations['station.trading'] as StationDef;
    const forced: StationDef = { ...def, tiers: { ...def.tiers, station: { ...def.tiers.station, grammars: [{ value: 'stationWheel', weight: 1 }] } } };
    const got = Array.from({ length: 24 }, (_, i) => {
      const g = generateStation(forced, 'station.trading', 'station', i + 1, defs);
      return hash(`${g.template.rows.join('\n')}|${JSON.stringify(g.template.modules ?? [])}`);
    });
    if (PIN.length === 0) console.log(JSON.stringify(got));
    expect(got).toEqual(PIN);
  }, 120000);
});
