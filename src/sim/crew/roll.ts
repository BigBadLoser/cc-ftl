import { hash32 } from '../galaxy/hash';
import type { ContentRegistry, SkillName } from '../registry';
import { Rng } from '../rng';
import type { TraitDef } from './traitDef';
import { SKILLS } from './skillList';
import { WONT_DO_SKILLS, type Background, type Interests, type WontDoId } from './background';
import { SKILL_ROLL_CAP, rollBackground, weightedIndex } from './backgroundRoll';

/**
 * Crew generation (docs/TRAITS.md sections 1, 4 and 10). A starting crew member is rolled from their own RNG,
 * `new Rng(hash32(seed, CREW_ROLL_SALT, slot, rerolls))`, never from `sim.rng`: a reroll on the crew screen changes nothing
 * else in the world, and slots never affect each other. Everything here is pure (no Sim), so the crew screen previews
 * exactly what `newGame` will create.
 */
export const CREW_ROLL_SALT = 0x7c3e9a11;

export { SKILLS, SKILL_ROLL_CAP };

/** One crew-screen berth: the crew kind the ship lists there (people become `role.crew`), how often it was rerolled, and a name the player typed. */
export interface CrewPick {
  role: string;
  rerolls?: number;
  name?: string;
}

/** A rolled crew member, ready for `createCrew`. `skills` is null for bodies without a background (robots keep their kind's package). */
export interface RolledCrew {
  role: string;
  name: string;
  appearanceSeed: number;
  rest: number;
  skills: Partial<Record<SkillName, number>> | null;
  traits: string[];
  background?: Background;
  interests?: Interests;
  wontDo?: WontDoId[];
}

/** The kind every person on the player's crew gets (docs/TRAITS.md 10.11): no skills or fixed priorities of its own. */
export const CREW_KIND = 'role.crew';

/** The skills an old role names as its main ones (its highest), read as a career hint for recruits and rescued crew (10.11). */
export function roleHint(content: ContentRegistry, roleId: string): SkillName[] {
  const skills = content.roles[roleId]?.skills ?? {};
  const top = Math.max(0, ...Object.values(skills).map((v) => v ?? 0));
  return top > 0 ? SKILLS.filter((k) => skills[k] === top) : [];
}

/**
 * Roll 0 (25%), 1 (50%) or 2 (25%) traits by weight, without replacement, skipping exclusions both ways. `weights` multiplies a trait's
 * weight (the backgrounds' `traitWeights`); a trait whose won't-do rules out `main` (the career's main skill) is never rolled.
 */
export function rollTraits(rng: Rng, traits: Readonly<Record<string, TraitDef>> | undefined, weights: Readonly<Record<string, number>> = {}, main?: SkillName): string[] {
  const r = rng.next();
  const count = r < 0.25 ? 0 : r < 0.75 ? 1 : 2;
  const weightOf = (id: string, d: TraitDef): number => (d.wontDo && main && WONT_DO_SKILLS[d.wontDo].includes(main) ? 0 : d.weight * (weights[id] ?? 1));
  let pool = Object.entries(traits ?? {}).filter(([id, d]) => d.rollable && weightOf(id, d) > 0);
  const out: string[] = [];
  for (let i = 0; i < count && pool.length; i++) {
    const idx = weightedIndex(rng, pool.map(([id, d]) => weightOf(id, d)));
    if (idx < 0) break;
    const [id, def] = pool[idx] as [string, TraitDef];
    out.push(id);
    pool = pool.filter(([o, od]) => o !== id && !def.excludes?.includes(o) && !od.excludes?.includes(id));
  }
  return out;
}

/**
 * Roll one crew member with any RNG (the crew-generation RNG, or `sim.rng` for crew who join mid-game). People (species with moods) roll a
 * background (crew/backgroundRoll.ts) and become `CREW_KIND`. `hint` makes the career follow the old role `roleId` names (recruits,
 * pods); starting crew roll without one (the ship's jobs list shows the gaps, a reroll fills them).
 * Robots and other fixed bodies keep their kind and its skills.
 */
export function rollCrewWith(rng: Rng, roleId: string, content: ContentRegistry, hint = false): RolledCrew {
  const role = content.roles[roleId];
  const speciesId = role?.species ?? 'species.human';
  const species = content.species[speciesId];
  const name = species?.designation
    ? `${species.designation}-${String(rng.int(0, 999)).padStart(3, '0')}`
    : (content.crewNames[rng.int(0, Math.max(0, content.crewNames.length - 1))] ?? 'Crew');
  const appearanceSeed = rng.int(0, 0x7fffffff);
  const rest = species && species.restDecay > 0 ? rng.int(60, 100) : 100;
  if (!species?.mood) return { role: roleId, name, appearanceSeed, rest, skills: null, traits: [] };
  const bg = rollBackground(rng, content, speciesId, hint ? roleHint(content, roleId) : undefined);
  const traits = rollTraits(rng, content.traits, bg?.traitWeights, bg?.main);
  const wontDo = [...(bg?.wontDo ?? [])];
  for (const t of traits) {
    const w = content.traits?.[t]?.wontDo;
    if (w && !wontDo.includes(w)) wontDo.push(w);
  }
  if (!bg) return { role: roleId, name, appearanceSeed, rest, skills: null, traits, ...(wontDo.length ? { wontDo } : {}) };
  return {
    role: content.roles[CREW_KIND] ? CREW_KIND : roleId, name, appearanceSeed, rest, skills: bg.skills, traits,
    background: bg.background, interests: bg.interests, ...(wontDo.length ? { wontDo } : {}),
  };
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
