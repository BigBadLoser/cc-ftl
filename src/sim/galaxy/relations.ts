import type { FactionRelationDef, GalaxyContent, GalaxyFactionDef, Stance } from './defs';

/**
 * The faction relations table, read through one lookup. `GalaxyContent.relations` lists a pair once; this indexes both directions (and caches
 * per content object). A faction is never at war with itself; a pair with no entry is neutral and shares no standing. `alwaysHostile`
 * factions (the rogue AI) are at war with everyone whatever the table says.
 */
interface Pair {
  stance: Stance;
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
    m.set(key(r.a, r.b), { stance: r.stance, into: r.spill?.[0] ?? 0 });
    m.set(key(r.b, r.a), { stance: r.stance, into: r.spill?.[1] ?? 0 });
  }
  index.set(rels, m);
  return m;
}

/** How `a` and `b` stand to each other (symmetric). */
export function stanceBetween(content: GalaxyContent, a: string, b: string): Stance {
  if (a === b) return 'allied';
  const fa: GalaxyFactionDef | undefined = content.factions[a];
  const fb: GalaxyFactionDef | undefined = content.factions[b];
  if (!fa || !fb) return 'neutral';
  if (fa.alwaysHostile || fb.alwaysHostile) return 'war';
  return pairs(content.relations).get(key(a, b))?.stance ?? 'neutral';
}

/** Do the two fight on sight? */
export const atWarContent = (content: GalaxyContent, a: string, b: string): boolean => a !== b && stanceBetween(content, a, b) === 'war';

/** The factions standing shares with `faction`, with the weight of each one's reputation in its standing, in table order. */
export function spillSources(content: GalaxyContent, faction: string): { faction: string; weight: number }[] {
  const out: { faction: string; weight: number }[] = [];
  for (const r of content.relations) {
    if (r.a === faction) out.push({ faction: r.b, weight: r.spill?.[0] ?? 0 });
    else if (r.b === faction) out.push({ faction: r.a, weight: r.spill?.[1] ?? 0 });
  }
  return out.filter((s) => s.weight !== 0);
}
