import { CREW_MAX_HP, DEFAULT_CARRY_CAPACITY, MOOD_BASE, SKILLS, rollStartingCrew, type ContentRegistry, type TraitDef } from '../../sim';
import type { UiCrewPlan, UiRollCrew } from '../../ui/title/titleApi';

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
const num = (v: number): string => `${Math.round(v * 100) / 100}`;

/** The product of one stat's `mul` modifiers over a crew member's traits, and the traits that set it. */
function mulOf(defs: readonly TraitDef[], stat: string): { mult: number; by: TraitDef[] } {
  let mult = 1;
  const by: TraitDef[] = [];
  for (const d of defs) for (const m of d.modifiers ?? []) if (m.stat === stat && m.op === 'mul') { mult *= m.value; by.push(d); }
  return { mult, by };
}

/** The stats grid of a rolled crew member, from the species base and the traits' modifiers and effects (no sim yet). */
function statsOf(content: ContentRegistry, role: string, defs: readonly TraitDef[]): UiRollCrew['stats'] {
  const species = content.species[content.roles[role]?.species ?? 'species.human'];
  const out: UiRollCrew['stats'] = [];
  const row = (label: string, value: string, by: readonly TraitDef[], good: boolean): void =>
    void out.push(by.length ? { label, value, source: by.map((d) => d.name).join(', '), good } : { label, value });
  const effect = (key: 'maxHpMult' | 'hungerMult'): { mult: number; by: TraitDef[] } => {
    const by = defs.filter((d) => typeof d.effects?.[key] === 'number');
    return { mult: by.reduce((n, d) => n * (d.effects?.[key] as number), 1), by };
  };
  const hp = effect('maxHpMult');
  row('Health', `${Math.round(CREW_MAX_HP * hp.mult)}`, hp.by, hp.mult >= 1);
  const move = mulOf(defs, 'moveSpeed');
  row('Move', `${num((species?.moveSpeed ?? 1) * move.mult)} tiles/s`, move.by, move.mult >= 1);
  const work = mulOf(defs, 'workSpeed');
  row('Work speed', `×${num(work.mult)}`, work.by, work.mult >= 1);
  const tire = mulOf(defs, 'restDecay');
  row('Tires', `×${num(tire.mult)}`, tire.by, tire.mult <= 1);
  const carry = mulOf(defs, 'carryCapacity');
  row('Carry', `${Math.round((species?.carryCapacity ?? DEFAULT_CARRY_CAPACITY) * carry.mult)}`, carry.by, carry.mult >= 1);
  const hunger = effect('hungerMult');
  row('Hunger', `×${num(hunger.mult)}`, hunger.by, hunger.mult <= 1);
  const moodBy = defs.filter((d) => typeof d.effects?.mood === 'number');
  const mood = MOOD_BASE + moodBy.reduce((n, d) => n + (d.effects?.mood ?? 0), 0);
  row('Mood', `${mood}`, moodBy, mood >= MOOD_BASE);
  const brave = defs.find((d) => d.effects?.brave);
  const coward = defs.find((d) => d.effects?.coward);
  row('In a fight', brave ? 'fights bare-handed' : coward ? 'runs when hurt' : 'grabs a gun', brave ? [brave] : coward ? [coward] : [], !!brave);
  return out;
}

/**
 * The crew screen's preview: the crew of a plan rolled exactly as `newGame` will roll them (`rollStartingCrew`, keyed by
 * seed, slot and rerolls, typed names winning), with what the screen shows of each: label, traits, skills against the
 * role and the stats grid.
 */
export function previewCrew(content: ContentRegistry, plan: UiCrewPlan): UiRollCrew[] {
  const rolled = rollStartingCrew(plan.seed, plan.picks, content);
  return rolled.map((c, slot) => {
    const role = content.roles[c.role];
    const traits = c.traits.flatMap((id) => {
      const d = content.traits?.[id];
      return d ? [{ id, def: d }] : [];
    });
    const defs = traits.map((t) => t.def);
    const skills = SKILLS.map((skill) => {
      const r = c.skills?.[skill] ?? role?.skills?.[skill] ?? 0;
      const trait = defs.reduce((n, d) => n + (d.modifiers ?? []).reduce((k, m) => k + (m.stat === skill && m.op === 'add' ? m.value : 0), 0), 0);
      return { skill, name: cap(skill), rolled: r, trait, role: role?.skills?.[skill] ?? 0, value: Math.max(0, r + trait) };
    });
    const roleName = role?.name ?? c.role;
    const lead = c.label === 'talented' ? `Talented for a ${roleName.toLowerCase()}.` : c.label === 'green' ? `A rookie ${roleName.toLowerCase()}.` : '';
    return {
      slot, role: c.role, roleName, name: c.name, rerolls: plan.picks[slot]?.rerolls ?? 0, label: c.label,
      look: { species: role?.species ?? 'species.human', role: c.role, appearanceSeed: c.appearanceSeed },
      read: [lead, ...defs.map((d) => d.flavour)].filter(Boolean).join(' ') || `A steady ${roleName.toLowerCase()}.`,
      traits: traits.map(({ id, def }) => ({ id, name: def.name, kind: def.kind, effect: def.effect, short: def.short, flavour: def.flavour })),
      skills,
      stats: statsOf(content, c.role, defs),
    };
  });
}
