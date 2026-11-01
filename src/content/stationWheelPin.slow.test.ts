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
  '22fde531','e24edc57','1557114b','1800aa8f','ffab8ce1','9be74522','18dbc35e','2c158a3d','8dc40acb','d0ae37a2','dc69f759','440d32d6',
  'bc4eb15f','fe868906','cc8de534','1cc53a80','30f36b9c','6b00d47e','891caf3e','dc9f62df','88b00559','9f7063c4','58658857','71da12a5',
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
