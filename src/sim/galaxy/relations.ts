import type { Sim } from '../sim';
import type { FactionRelationDef, GalaxyContent, GalaxyFactionDef, Stance } from './defs';

/**
 * The faction relations table, read through one lookup. `GalaxyContent.relations` lists a pair once; this indexes both directions (and caches
 * per content object). That table is the generated baseline: how the pair stands now is `stanceOf(sim, a, b)` (`GalaxyState.war`, moved by war.ts), the one
 * answer to "are these at war" that every reader asks. A faction is never at war with itself; a pair with no entry is neutral and shares no standing. `alwaysHostile`
 * factions (the rogue AI) are at war with everyone whatever the table says, unless the table lists the pair as allied.
 */
interface Pair {
  stance: Stance;
  fixed: boolean;
  /** Weight of the other faction's reputation in this one's standing. */
  into: number;
}

const index = new WeakMap<readonly FactionRelationDef[], Map<string, Pair>>();

const key = (a: string, b: string): string => `${a}\u0000${b}`;

function pairs(rels: readonly FactionRelationDef[]): Map<string, Pair> {
  let m = index.get(rels);
  if (m) return m;
  m = new Map();
  for (const r of rels) {
    m.set(key(r.a, r.b), { stance: r.stance, fixed: !!r.fixed, into: r.spill?.[0] ?? 0 });
    m.set(key(r.b, r.a), { stance: r.stance, fixed: !!r.fixed, into: r.spill?.[1] ?? 0 });
  }
  index.set(rels, m);
  return m;
}

/** The key of a pair in `GalaxyState.war`: the two ids, sorted. */
export const pairKey = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`);

/** How `a` and `b` stand in the relations table, the generated baseline (symmetric). Readers in the sim ask `stanceOf`. */
export function baselineStance(content: GalaxyContent, a: string, b: string): Stance {
  if (a === b) return 'allied';
  const fa: GalaxyFactionDef | undefined = content.factions[a];
  const fb: GalaxyFactionDef | undefined = content.factions[b];
  if (!fa || !fb) return 'neutral';
  const listed = pairs(content.relations).get(key(a, b))?.stance;
  // An explicit alliance beats `alwaysHostile` (the zealots serve the machines).
  if (listed === 'allied') return 'allied';
  if (fa.alwaysHostile || fb.alwaysHostile) return 'war';
  return listed ?? 'neutral';
}

/** Can the pair's stance change (war.ts)? Only a pair the table lists without `fixed`; `alwaysHostile` factions and unlisted pairs stay as they are. */
export function mayChange(content: GalaxyContent, a: string, b: string): boolean {
  const p = pairs(content.relations).get(key(a, b));
  return !!p && !p.fixed && a !== b && !content.factions[a]?.alwaysHostile && !content.factions[b]?.alwaysHostile;
}

/** How `a` and `b` stand to each other now: the baseline, unless the coarse tier moved it (`GalaxyState.war`). The one answer to war and peace between factions. */
export function stanceOf(sim: Sim, a: string, b: string): Stance {
  const content = sim.content.galaxy;
  if (!content) return 'neutral';
  const now = a === b ? undefined : sim.galaxy.war[pairKey(a, b)];
  return now && mayChange(content, a, b) ? now.stance : baselineStance(content, a, b);
}

/** Do the two fight on sight (and rivals take each other's jobs)? */
export const atWar = (sim: Sim, a: string, b: string): boolean => a !== b && stanceOf(sim, a, b) === 'war';

/** The factions standing shares with `faction`, with the weight of each one's reputation in its standing, in table order. */
export function spillSources(content: GalaxyContent, faction: string): { faction: string; weight: number }[] {
  const out: { faction: string; weight: number }[] = [];
  for (const r of content.relations) {
    if (r.a === faction) out.push({ faction: r.b, weight: r.spill?.[0] ?? 0 });
    else if (r.b === faction) out.push({ faction: r.a, weight: r.spill?.[1] ?? 0 });
  }
  return out.filter((s) => s.weight !== 0);
}
