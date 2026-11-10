import type { SkillName } from '../registry';
import type { Sim } from '../sim';
import { skillOf } from '../combat/operators';
import { SKILL_STEP } from '../tuning';
import type { Job } from './components';

/**
 * The one job-kind -> skill map (docs/TRAITS.md 10.2): the skill a job trains while it progresses, and for Construction, Botany and
 * Industry the skill that speeds it. Hauling, rescue and the rest train none. Consoles train their console skill in their own systems.
 */
const JOB_SKILL: Partial<Record<Job['kind'], SkillName>> = {
  build: 'construction', module: 'construction', deconstruct: 'construction', moduleDecon: 'construction', repair: 'construction',
  extinguish: 'construction', forceDoor: 'construction', fit: 'construction', mend: 'construction', salvage: 'construction',
  assemble: 'construction', plant: 'botany', harvest: 'botany', research: 'science', hack: 'hacking',
};

/** Skills whose level speeds their job kinds here (science and hacking speed research and hacks where those are worked). */
const SPEED_SKILLS: ReadonlySet<SkillName> = new Set(['construction', 'botany', 'industry']);

/** The skill a job trains: a meal recipe its quality skill (cooking), any other craft or refining job Industry, else the kind's skill. */
export function workSkill(sim: Sim, job: Job): SkillName | undefined {
  if (job.kind === 'craft') {
    const q = sim.content.recipes[job.craft?.recipe ?? '']?.quality?.skill;
    return q ?? 'industry';
  }
  return JOB_SKILL[job.kind];
}

/** Work-speed multiplier a crew member's skill gives this job: `1 + SKILL_STEP x level` for Construction, Botany and Industry work, else 1. */
export function workSkillMult(sim: Sim, crew: number, job: Job): number {
  const skill = workSkill(sim, job);
  return skill && SPEED_SKILLS.has(skill) ? 1 + SKILL_STEP * Math.max(0, skillOf(sim, crew, skill)) : 1;
}
