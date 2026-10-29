import { describe, expect, it } from 'vitest';
import type { UiConsole, UiShipModule } from '../api';
import { stationTags } from './stations';

const con = (kind: UiConsole['kind'], operator: string | null, powered = true): UiConsole => ({
  id: 1, kind, name: kind, operator, powered,
});
const eng = (powered: boolean, hp = 10): UiShipModule => ({
  id: 2, name: 'Engine', kind: 'engine', hp, maxHp: 10, ion: false, powered,
});

describe('stationTags', () => {
  it('lists weapons, shields, helm, engines in order', () => {
    expect(stationTags([], []).map((t) => t.tag)).toEqual(['WPN', 'SHD', 'HELM', 'ENG']);
  });

  it('marks a manned, powered console MANNED and names the operator', () => {
    const [w] = stationTags([con('weapons', 'Ada')], []);
    expect(w).toMatchObject({ ok: true, status: 'MANNED', tip: 'Weapons manned by Ada' });
  });

  it('marks an empty console NO CREW with its consequence', () => {
    const tags = stationTags([con('weapons', null), con('shields', null), con('helm', null)], []);
    expect(tags[0]).toMatchObject({ ok: false, status: 'NO CREW', tip: "Weapons console has no crew: weapons won't charge" });
    expect(tags[1]?.tip).toBe('Shield console has no crew: shields regenerate slower');
    expect(tags[2]?.tip).toBe("Helm has no crew: no evasion, FTL won't charge");
  });

  it('explains a missing or unpowered console', () => {
    expect(stationTags([], [])[0]?.tip).toContain('no console installed');
    expect(stationTags([con('helm', 'Bo', false)], [])[2]?.tip).toContain('console unpowered');
    expect(stationTags([con('helm', 'Bo', false)], [])[2]?.ok).toBe(false);
  });

  it('engines are online with one powered, intact engine module', () => {
    expect(stationTags([], [eng(true)])[3]).toMatchObject({ ok: true, status: 'ONLINE', tip: 'Engines online' });
    expect(stationTags([], [eng(false)])[3]).toMatchObject({ ok: false, status: 'OFFLINE' });
    expect(stationTags([], [eng(true, 0)])[3]?.ok).toBe(false);
    expect(stationTags([], [])[3]?.tip).toBe('No engines installed: no evasion');
  });
});
