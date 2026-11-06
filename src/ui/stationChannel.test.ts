import { describe, expect, it } from 'vitest';
import type { UiTradePartner } from './api';
import { contactFor, linesFor, servicesFor } from './stationChannel';

const partner = (info: Partial<NonNullable<UiTradePartner['info']>> = {}): UiTradePartner =>
  ({ id: 7, name: 'Ceres', trades: true, lines: [], info: { services: [], blueprints: [], docks: 2, guns: 4, shields: 2, alarm: null, yard: null, ...info } }) as unknown as UiTradePartner;

describe('station channel', () => {
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
});
