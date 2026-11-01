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
  '45947d5b','d315c0b5','f59db3e3','a2df5408','9780d04c','e87532d2','832bc282','738831aa','bb2c2286','2df54fbe','b7cdeb63','13d3e10a',
  '722bcad1','ddd30667','fa0f6410','31498bc9','eadfaad4','5f692c84','0fd810f6','53f9ec7d','57fcc25b','8a0b67a4','f75a3624','4362e85f',
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
