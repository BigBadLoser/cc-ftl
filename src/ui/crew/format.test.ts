import { describe, expect, it } from 'vitest';
import { attackBlocked, crewState } from './format';

const base = { dead: false, downed: null, surrendered: false, prisoner: false, drafted: false, job: null, activity: 'idle' };

describe('the crew Overview state line', () => {
  it('names a surrendered or captured crew member, who would otherwise read as idle', () => {
    expect(crewState({ ...base, surrendered: true })).toEqual({ chip: 'Surrendered', text: 'Out of the fight', bad: false });
    expect(crewState({ ...base, surrendered: true, prisoner: true })).toEqual({ chip: 'Prisoner', text: 'Held captive', bad: false });
    expect(crewState(base)).toEqual({ chip: null, text: 'idle', bad: false });
    expect(crewState({ ...base, surrendered: true, downed: { bleed: 12, stabilized: false } })).toMatchObject({ chip: 'Surrendered', bad: true });
  });

  it('says why a hostile cannot be attacked', () => {
    expect(attackBlocked(base)).toBeNull();
    expect(attackBlocked({ ...base, surrendered: true })).toMatch(/Surrendered/);
    expect(attackBlocked({ ...base, surrendered: true, prisoner: true })).toMatch(/prisoner/);
    expect(attackBlocked({ ...base, downed: { bleed: 5, stabilized: false } })).toMatch(/Downed/);
  });
});
