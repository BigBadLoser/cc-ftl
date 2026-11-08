import { describe, expect, it } from 'vitest';
import type { UiTradePartner } from './api';
import { contactFor, linesFor, servicesFor } from './channel';

const partner = (info: Partial<NonNullable<UiTradePartner['info']>> = {}): UiTradePartner =>
  ({ id: 7, name: 'Ceres', station: true, hail: 'answered', trades: true, lines: [], info: { services: [], blueprints: [], docks: 2, guns: 4, shields: 2, alarm: null, yard: null, ...info } }) as unknown as UiTradePartner;

describe('comms channel', () => {
  it('gives each service its own stable contact', () => {
    expect(contactFor(7, 'jobs')).toEqual(contactFor(7, 'jobs'));
    expect(contactFor(7, 'jobs').title).toBe('Job broker');
    expect(contactFor(7, 'crew').look.appearanceSeed).not.toBe(contactFor(7, 'jobs').look.appearanceSeed);
  });
  it('lists only the services the station has', () => {
    expect(servicesFor(partner(), 2, 3).map((s) => s.id)).toEqual(['station', 'trade', 'jobs', 'crew']);
    const full = partner({ services: ['Blueprints'], yard: { size: 'hub', cap: 40, price: { credits: 5, metal: 1 }, hull: { tiles: 1, capacity: 2 } } });
    expect(servicesFor(full, 0, 0).map((s) => s.id)).toEqual(['station', 'trade', 'jobs', 'crew', 'blueprints', 'yard']);
    expect(servicesFor(partner(), 2, 3).find((s) => s.id === 'trade')?.opens).toBe(true);
  });
  it('draws the quote from the real state', () => {
    const p = partner();
    const q = linesFor('jobs', p, contactFor(7, 'jobs'), 2, 0);
    expect(q.some((l) => l.kind === 'speech' && l.text.includes('2 runs'))).toBe(true);
    expect(linesFor('station', partner({ alarm: 'raiders' }), contactFor(7, 'station'), 0, 0).some((l) => l.text.includes('raiders'))).toBe(true);
  });
  // #384: a trader ship is hailed on the same channel as a station, with only the services it really has.
  const ship = (o: Partial<UiTradePartner> = {}): UiTradePartner =>
    ({ id: 9, name: 'Mule', kind: 'ship', station: false, hail: 'answered', reason: '', trades: true, role: 'Freighter', lines: [{ item: 'item.metal', theirs: 4 }], recruits: [], ...o }) as unknown as UiTradePartner;
  it('opens a ship on the channel: its bridge and trade, no station services', () => {
    expect(servicesFor(ship(), 3, 0).map((s) => s.id)).toEqual(['station', 'trade']);
    expect(servicesFor(ship(), 0, 0)[0]?.label).toBe('Bridge');
    expect(contactFor(9, 'station', true).title).toBe('Captain');
    expect(linesFor('station', ship(), contactFor(9, 'station', true), 0, 0).some((l) => l.kind === 'speech' && l.text.includes('1 line'))).toBe(true);
  });
  it('keeps a ship that refused on the channel with its reason and nothing else to pick', () => {
    const p = ship({ hail: 'refused', reason: 'weaponsHot' });
    expect(servicesFor(p, 0, 0).map((s) => s.id)).toEqual(['station']);
    expect(linesFor('station', p, contactFor(9, 'station', true), 0, 0)[0]?.text).toContain('guns');
  });
});
