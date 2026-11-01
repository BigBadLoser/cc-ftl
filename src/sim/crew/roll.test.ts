import { describe, expect, it } from 'vitest';
import type { ContentRegistry, RoleDef, SkillName } from '../registry';
import { Rng } from '../rng';
import { SKILL_ROLL_CAP, SKILLS, rollCrewMember, rollSkills, rollStartingCrew, rollTraits, skillLabel } from './roll';
import type { TraitDef } from './traitDef';

const role = (skills: Partial<Record<SkillName, number>>): RoleDef => ({ name: 'R', priorities: {} as RoleDef['priorities'], skills });
const ROLES = {
  engineer: { shielding: 2, repair: 2, hacking: 1 },
  security: { gunnery: 2, melee: 2 },
  gunner: { gunnery: 3 },
  medic: { medicine: 3 },
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
    'role.engineer': role(ROLES.engineer), 'role.gunner': role(ROLES.gunner),
    'role.bot': { name: 'Bot', priorities: {} as RoleDef['priorities'], species: 'species.robot' },
    'role.secbot': { name: 'Security bot', priorities: {} as RoleDef['priorities'], species: 'species.robot', skills: { melee: 2, gunnery: 1 } },
  },
  species: {
    'species.human': { name: 'H', moveSpeed: 2.5, workSpeed: 1, restDecay: 0.6, mood: true },
    'species.robot': { name: 'R', moveSpeed: 2, workSpeed: 1, restDecay: 0, designation: 'RX' },
  },
  crewNames: ['Ada', 'Bo', 'Cy'],
  traits,
} as unknown as ContentRegistry;

const sum = (s: Partial<Record<SkillName, number>>): number => Object.values(s).reduce((a, b) => a + (b ?? 0), 0);

describe('skill rolls (docs/TRAITS.md section 2)', () => {
  it('stay inside the budget: total within role total -1..+2, every core skill at least 1, nothing above the cap', () => {
    for (const [name, skills] of Object.entries(ROLES)) {
      const rt = sum(skills);
      const totals = new Set<number>();
      const labels = new Set<string | null>();
      for (let i = 0; i < 3000; i++) {
        const s = rollSkills(new Rng(i * 7919 + name.length), skills) as Partial<Record<SkillName, number>>;
        const t = sum(s);
        totals.add(t);
        expect(t, name).toBeGreaterThanOrEqual(rt - 1);
        expect(t, name).toBeLessThanOrEqual(rt + 2);
        for (const k of Object.keys(skills) as SkillName[]) expect(s[k] ?? 0, `${name} ${k}`).toBeGreaterThanOrEqual(1);
        for (const k of SKILLS) expect(s[k] ?? 0).toBeLessThanOrEqual(SKILL_ROLL_CAP);
        labels.add(skillLabel(s, skills));
      }
      // Every budget step happens, and both labels are reachable for every role (Green used to be impossible for engineers).
      expect([...totals].sort(), name).toEqual([rt - 1, rt, rt + 1, rt + 2]);
      expect(labels.has('talented'), name).toBe(true);
      expect(labels.has('green'), name).toBe(true);
    }
  });

  it('labels follow the final skills', () => {
    const r = ROLES.engineer;
    expect(skillLabel({ shielding: 2, repair: 1, hacking: 1 }, r)).toBe('green');
    expect(skillLabel({ shielding: 1, repair: 1, hacking: 1, gunnery: 1 }, r)).toBe(null); // below budget, but an off-role point
    expect(skillLabel({ shielding: 2, repair: 2, hacking: 1, gunnery: 2 }, r)).toBe('talented'); // off-role 2
    expect(skillLabel({ shielding: 4, repair: 1, hacking: 1 }, r)).toBe('talented'); // core +2
    expect(skillLabel({ shielding: 3, repair: 3, hacking: 1 }, r)).toBe('talented'); // total +2
    expect(skillLabel({ shielding: 3, repair: 2, hacking: 1 }, r)).toBe(null);
    expect(skillLabel(null, undefined)).toBe(null);
  });

  it('a role without skills rolls none', () => {
    expect(rollSkills(new Rng(1), undefined)).toBeNull();
    expect(rollSkills(new Rng(1), {})).toBeNull();
  });
});

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
