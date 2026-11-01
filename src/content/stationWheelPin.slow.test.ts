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
  'c1db1cba','1a8ff04a','5666d9ce','7dbc5260','f439f9c9','0c47d675','a3d0c0f6','bd92c917','55a19e8d','e546f71a','1d62a37f','c04f5ff9',
  '2ff8810e','688f6085','4ac86939','d9f4c2cd','434cc67f','80d7e50a','2a6186c3','05855ee1','426c9d30','990c78d6','4dcc547c','f7e4a066',
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
