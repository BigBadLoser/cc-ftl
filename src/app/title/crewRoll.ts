import { COWARD_FLEE_BELOW, CREW_MAX_HP, DEFAULT_CARRY_CAPACITY, MOOD_BASE, SKILLS, rollStartingCrew, surrenderBelow, type ContentRegistry, type TraitDef } from '../../sim';
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
  // What the fight code reads: a Coward flees from the foes it sees below COWARD_FLEE_BELOW hp (no one else flees for
  // being hurt), and the surrender threshold is the sim's own (`surrenderBelow`: role, Brave, Coward, fearless species).
  const brave = defs.filter((d) => d.effects?.brave);
  const coward = defs.filter((d) => d.effects?.coward);
  const pct = (v: number): string => (v > 0 ? `${Math.round(v * 100)}% hp` : 'never');
  row('Flees below', pct(coward.length ? COWARD_FLEE_BELOW : 0), coward, false);
  const give = surrenderBelow(content, role, content.roles[role]?.species ?? 'species.human', true, { brave: brave.length > 0, coward: coward.length > 0 });
  row('Surrenders below', pct(give), give > 0 ? coward : brave, give <= 0);
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
      const adds = defs.flatMap((d) => (d.modifiers ?? []).filter((m) => m.stat === skill && m.op === 'add').map((m) => m.value));
      const trait = adds.filter((v) => v > 0).reduce((n, v) => n + v, 0);
      const lost = Math.min(r + trait, -adds.filter((v) => v < 0).reduce((n, v) => n + v, 0));
      return { skill, name: cap(skill), rolled: r, trait, lost, role: role?.skills?.[skill] ?? 0, value: Math.max(0, r + trait - lost) };
    });
    const roleName = role?.name ?? c.role;
    const r = roleName.toLowerCase();
    const lead = c.label === 'talented' ? `Talented for ${/^[aeiou]/.test(r) ? 'an' : 'a'} ${r}.` : c.label === 'green' ? `A rookie ${r}.` : '';
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
