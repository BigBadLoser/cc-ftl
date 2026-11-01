import { hash32 } from '../galaxy/hash';
import type { ContentRegistry, SkillName } from '../registry';
import { Rng } from '../rng';
import type { TraitDef } from './traitDef';

/**
 * Crew generation (docs/TRAITS.md sections 1, 2 and 4). A starting crew member is rolled from their own RNG,
 * `new Rng(hash32(seed, CREW_ROLL_SALT, slot, rerolls))`, never from `sim.rng`: a reroll on the crew screen changes nothing
 * else in the world, and slots never affect each other. Everything here is pure (no Sim), so the crew screen previews
 * exactly what `newGame` will create.
 */
export const CREW_ROLL_SALT = 0x7c3e9a11;

export const SKILLS: readonly SkillName[] = ['gunnery', 'piloting', 'shielding', 'melee', 'repair', 'hacking', 'medicine', 'science'];
/** No rolled skill goes above this. */
export const SKILL_ROLL_CAP = 5;

/** Talented / Green, from the final skills; no effect on play. */
export type SkillLabel = 'talented' | 'green' | null;

/** One crew-screen slot: the role (fixed by the ship), how often it was rerolled, and a name the player typed. */
export interface CrewPick {
  role: string;
  rerolls?: number;
  name?: string;
}

/** A rolled crew member, ready for `createCrew`. `skills` is null for roles without skills to roll (robots). */
export interface RolledCrew {
  role: string;
  name: string;
  appearanceSeed: number;
  rest: number;
  skills: Partial<Record<SkillName, number>> | null;
  traits: string[];
  label: SkillLabel;
}

type Skills = Partial<Record<SkillName, number>>;

const total = (s: Skills): number => Object.values(s).reduce((n, v) => n + (v ?? 0), 0);

/** Weighted pick of an index; null when every weight is 0. */
function weighted(rng: Rng, weights: readonly number[]): number | null {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0) return null;
  let r = rng.next() * sum;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i] as number;
    if (r < 0 && (weights[i] as number) > 0) return i;
  }
  for (let i = weights.length - 1; i >= 0; i--) if ((weights[i] as number) > 0) return i;
  return null;
}

/**
 * Roll a role's skills, budget first: T = role total + d (d = -1 20%, 0 50%, +1 22%, +2 8%); start from the role's skills;
 * 0 to 2 swaps move a point from a core skill (kept at 1 or more) to an off-role skill (60%) or another core skill (40%);
 * then d points are added (core weight 3, off-role 1) or taken (from the highest core skill, else the highest off-role one).
 * Every point is placed once, so the total is always T. Null for a role without skills.
 */
export function rollSkills(rng: Rng, roleSkills: Skills | undefined): Skills | null {
  const core = SKILLS.filter((k) => (roleSkills?.[k] ?? 0) > 0);
  if (core.length === 0) return null;
  const off = SKILLS.filter((k) => !core.includes(k));
  const s: Record<SkillName, number> = Object.fromEntries(SKILLS.map((k) => [k, roleSkills?.[k] ?? 0])) as Record<SkillName, number>;
  const r = rng.next();
  const d = r < 0.2 ? -1 : r < 0.7 ? 0 : r < 0.92 ? 1 : 2;
  const r2 = rng.next();
  const swaps = r2 < 0.4 ? 0 : r2 < 0.8 ? 1 : 2;
  for (let i = 0; i < swaps; i++) {
    const donors = core.filter((k) => s[k] >= 2);
    const toCore = core.length > 1 && rng.chance(0.4);
    if (donors.length === 0) continue;
    const from = rng.pick(donors);
    const dests = (toCore ? core.filter((k) => k !== from) : off).filter((k) => s[k] < SKILL_ROLL_CAP);
    if (dests.length === 0) continue;
    const to = rng.pick(dests);
    s[from]--;
    s[to]++;
  }
  for (let i = 0; i < d; i++) {
    const idx = weighted(rng, SKILLS.map((k) => (s[k] >= SKILL_ROLL_CAP ? 0 : core.includes(k) ? 3 : 1)));
    if (idx !== null) s[SKILLS[idx] as SkillName]++;
  }
  if (d < 0) {
    const highest = (list: readonly SkillName[], min: number): SkillName | undefined =>
      list.reduce<SkillName | undefined>((best, k) => (s[k] >= min && (!best || s[k] > s[best]) ? k : best), undefined);
    const k = highest(core, 2) ?? highest(off, 1);
    if (k) s[k]--;
  }
  const out: Skills = {};
  for (const k of SKILLS) if (s[k] > 0) out[k] = s[k];
  return out;
}

/** Talented or Green, from the final skills against the role's (docs/TRAITS.md section 2). */
export function skillLabel(skills: Skills | null, roleSkills: Skills | undefined): SkillLabel {
  if (!skills) return null;
  const roleTotal = total(roleSkills ?? {});
  const t = total(skills);
  const isCore = (k: SkillName): boolean => (roleSkills?.[k] ?? 0) > 0;
  if (t >= roleTotal + 2 || SKILLS.some((k) => (isCore(k) ? (skills[k] ?? 0) >= (roleSkills?.[k] ?? 0) + 2 : (skills[k] ?? 0) >= 2))) return 'talented';
  if (t < roleTotal && SKILLS.every((k) => isCore(k) || !skills[k])) return 'green';
  return null;
}

/** Roll 0 (25%), 1 (50%) or 2 (25%) traits by weight, without replacement, skipping exclusions both ways. */
export function rollTraits(rng: Rng, traits: Readonly<Record<string, TraitDef>> | undefined): string[] {
  const r = rng.next();
  const count = r < 0.25 ? 0 : r < 0.75 ? 1 : 2;
  let pool = Object.entries(traits ?? {}).filter(([, d]) => d.rollable && d.weight > 0);
  const out: string[] = [];
  for (let i = 0; i < count && pool.length; i++) {
    const idx = weighted(rng, pool.map(([, d]) => d.weight));
    if (idx === null) break;
    const [id, def] = pool[idx] as [string, TraitDef];
    out.push(id);
    pool = pool.filter(([o, od]) => o !== id && !def.excludes?.includes(o) && !od.excludes?.includes(id));
  }
  return out;
}

/** Roll one crew member of a role with any RNG (the crew-generation RNG, or `sim.rng` for crew who join mid-game). */
export function rollCrewWith(rng: Rng, roleId: string, content: ContentRegistry): RolledCrew {
  const role = content.roles[roleId];
  const species = content.species[role?.species ?? 'species.human'];
  const name = species?.designation
    ? `${species.designation}-${String(rng.int(0, 999)).padStart(3, '0')}`
    : (content.crewNames[rng.int(0, Math.max(0, content.crewNames.length - 1))] ?? 'Crew');
  const appearanceSeed = rng.int(0, 0x7fffffff);
  const rest = species && species.restDecay > 0 ? rng.int(60, 100) : 100;
  // Only crew with moods (people) roll skills and traits; robots and other fixed bodies keep their role's skills.
  const skills = species?.mood ? rollSkills(rng, role?.skills) : null;
  const traits = species?.mood ? rollTraits(rng, content.traits) : [];
  return { role: roleId, name, appearanceSeed, rest, skills, traits, label: skillLabel(skills, role?.skills) };
}

/** The crew-generation RNG of one starting slot. */
export function crewRollRng(seed: number, slot: number, rerolls: number): Rng {
  return new Rng(hash32(seed, CREW_ROLL_SALT, slot, rerolls));
}

/** Roll one starting crew member: deterministic per (seed, slot, rerolls), independent of `sim.rng` and the other slots. */
export function rollCrewMember(seed: number, slot: number, rerolls: number, roleId: string, content: ContentRegistry): RolledCrew {
  return rollCrewWith(crewRollRng(seed, slot, rerolls), roleId, content);
}

/**
 * Roll a whole starting crew from the crew-screen picks. A typed name wins; a rolled name already taken by an earlier slot
 * moves to the next free name of the pool (deterministic), so two crew never share a name.
 */
export function rollStartingCrew(seed: number, picks: readonly CrewPick[], content: ContentRegistry): RolledCrew[] {
  const taken = new Set<string>();
  return picks.map((p, slot) => {
    const c = rollCrewMember(seed, slot, p.rerolls ?? 0, p.role, content);
    if (p.name) c.name = p.name;
    else if (taken.has(c.name) && content.crewNames.includes(c.name)) {
      const pool = content.crewNames;
      const at = pool.indexOf(c.name);
      for (let i = 1; i < pool.length; i++) {
        const n = pool[(at + i) % pool.length] as string;
        if (!taken.has(n)) {
          c.name = n;
          break;
        }
      }
    }
    taken.add(c.name);
    return c;
  });
}

/** Default picks for a ship's crew list: one slot per role, never rerolled. */
export const defaultPicks = (roles: readonly string[]): CrewPick[] => roles.map((role) => ({ role }));
