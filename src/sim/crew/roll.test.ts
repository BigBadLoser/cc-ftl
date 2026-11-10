import { describe, expect, it } from 'vitest';
import type { ContentRegistry, RoleDef, SkillName } from '../registry';
import { Rng } from '../rng';
import { CREW_KIND, rollCrewMember, rollCrewWith, rollStartingCrew, rollTraits } from './roll';
import type { TraitDef } from './traitDef';

const role = (skills: Partial<Record<SkillName, number>>): RoleDef => ({ name: 'R', priorities: {} as RoleDef['priorities'], skills });
const ROLES = {
  engineer: { shielding: 4, construction: 4, hacking: 2 },
  gunner: { gunnery: 6 },
} as const;
const trait = (o: Partial<TraitDef>): TraitDef => ({ name: 'T', flavour: '', kind: 'texture', effect: '', short: '', weight: 5, rollable: true, ...o });
const traits: Record<string, TraitDef> = {
  'trait.a': trait({ excludes: ['trait.b'] }),
  'trait.b': trait({ excludes: ['trait.a'] }),
  'trait.c': trait({ weight: 10 }),
  'trait.d': trait({ excludes: ['trait.c'] }), // one-sided: the draw must still keep them apart
  'trait.off': trait({ rollable: false, weight: 100 }),
};
const content = {
  roles: {
    'role.engineer': role(ROLES.engineer), 'role.gunner': role(ROLES.gunner), [CREW_KIND]: role({}),
    'role.bot': { name: 'Bot', priorities: {} as RoleDef['priorities'], species: 'species.robot' },
    'role.secbot': { name: 'Security bot', priorities: {} as RoleDef['priorities'], species: 'species.robot', skills: { melee: 2, gunnery: 1 } },
  },
  species: {
    'species.human': { name: 'H', moveSpeed: 2.5, workSpeed: 1, restDecay: 0.6, mood: true },
    'species.robot': { name: 'R', moveSpeed: 2, workSpeed: 1, restDecay: 0, designation: 'RX' },
  },
  crewNames: ['Ada', 'Bo', 'Cy'],
  traits,
  upbringings: { 'upbringing.x': { name: 'X', line: '', weight: 1, skills: { hacking: 2 } } },
  careers: {
    'career.fixer': { name: 'Fixer', line: '', weight: 1, skills: { construction: 5 } },
    'career.shot': { name: 'Shot', line: '', weight: 1, skills: { gunnery: 5 } },
  },
} as unknown as ContentRegistry;

describe('trait rolls', () => {
  it('draw 0 to 2 rollable traits and never two that exclude each other', () => {
    const counts = [0, 0, 0];
    for (let i = 0; i < 4000; i++) {
      const t = rollTraits(new Rng(i), traits);
      counts[t.length]!++;
      expect(t).not.toContain('trait.off');
      expect(new Set(t).size).toBe(t.length);
      expect(t.includes('trait.a') && t.includes('trait.b')).toBe(false);
      expect(t.includes('trait.c') && t.includes('trait.d')).toBe(false);
    }
    // 25% / 50% / 25%.
    expect(counts[0]! / 4000).toBeCloseTo(0.25, 1);
    expect(counts[1]! / 4000).toBeCloseTo(0.5, 1);
    expect(counts[2]! / 4000).toBeCloseTo(0.25, 1);
  });
});

describe('crew members (section 1)', () => {
  it('are deterministic per (seed, slot, rerolls) and differ on a reroll', () => {
    const a = rollCrewMember(42, 1, 0, 'role.engineer', content);
    expect(rollCrewMember(42, 1, 0, 'role.engineer', content)).toEqual(a);
    const others = [1, 2, 3, 4].map((r) => rollCrewMember(42, 1, r, 'role.engineer', content));
    expect(others.some((o) => JSON.stringify(o) !== JSON.stringify(a))).toBe(true);
    expect(rollCrewMember(43, 1, 0, 'role.engineer', content)).not.toEqual(a);
  });

  it('a reroll of one slot leaves the other slots as they were', () => {
    const picks = [{ role: 'role.engineer' }, { role: 'role.gunner' }, { role: 'role.engineer' }];
    const before = rollStartingCrew(7, picks, content);
    const after = rollStartingCrew(7, [picks[0]!, { role: 'role.gunner', rerolls: 3 }, picks[2]!], content);
    expect(after[0]).toEqual(before[0]);
    expect(after[2]?.skills).toEqual(before[2]?.skills);
    expect(after[2]?.traits).toEqual(before[2]?.traits);
  });

  it('never repeat a name, and keep a typed one', () => {
    for (let seed = 0; seed < 50; seed++) {
      const crew = rollStartingCrew(seed, [{ role: 'role.engineer' }, { role: 'role.engineer' }, { role: 'role.gunner' }], content);
      expect(new Set(crew.map((c) => c.name)).size).toBe(3);
    }
    expect(rollStartingCrew(1, [{ role: 'role.gunner', name: 'Vash' }], content)[0]?.name).toBe('Vash');
  });

  it('people become crew with a background; an old role is a career hint only when asked for', () => {
    const c = rollCrewMember(3, 0, 0, 'role.gunner', content);
    expect(c.role).toBe(CREW_KIND);
    expect(c.background?.upbringing).toBe('upbringing.x');
    for (let seed = 0; seed < 40; seed++) {
      const r = rollCrewWith(new Rng(seed), 'role.gunner', content, 'strict');
      expect(r.background?.career).toBe('career.shot');
    }
  });

  it('robots get a designation, no skill roll and no traits', () => {
    const bot = rollCrewMember(5, 0, 0, 'role.bot', content);
    expect(bot.name).toMatch(/^RX-\d{3}$/);
    expect(bot.skills).toBeNull();
    expect(bot.traits).toEqual([]);
    expect(bot.rest).toBe(100);
    // A robot role with fixed skills keeps them: no rolled snapshot replaces the role's skills.
    expect(rollCrewMember(5, 0, 0, 'role.secbot', content).skills).toBeNull();
  });
});
