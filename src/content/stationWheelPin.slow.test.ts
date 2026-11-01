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
  'd4b8eb93','32ffd570','42e9584d','b23adba5','60746716','0c47d675','45f894f6','39f6b846','384c22f2','754696b0','309082fe','c04f5ff9',
  '2ff8810e','08e9be0d','0e1fafd3','84d2bf03','66cc2b2c','6c30ba53','fafe0964','08d285e7','426c9d30','de05a019','b72c0693','79203b90',
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
