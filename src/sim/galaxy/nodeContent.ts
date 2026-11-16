import { inDanger, type GalaxyContent, type NodeContentDef, type NodeContentTable, type TierCurve } from './defs';

/** A curve's value at a tier, never below 0. */
export const curveAt = (c: TierCurve, tier: number): number => Math.max(0, c.base + (c.perTier ?? 0) * tier);

/** An entry's weight at a tier: its curve inside its danger range, else 0. */
export const entryWeight = (e: NodeContentDef, tier: number): number => (inDanger(e.danger, tier) ? curveAt(e.weight, tier) : 0);

/** What decides whether an entry may stand here. */
export interface NodeContentSite {
  /** Danger tier of the node. */
  tier: number;
  /** Kind of the faction owning the territory, or null for open space. */
  factionKind: string | null;
  /** The start node. */
  start: boolean;
}

/**
 * The share of nodes left empty at a tier: the `quiet` weight, plus the weight of every entry the faction or the start rules bar (their
 * draws land on quiet, so barring one never raises the odds of the others).
 */
export function quietShare(table: NodeContentTable, site: NodeContentSite): number {
  let total = curveAt(table.quiet, site.tier);
  let quiet = total;
  for (const e of Object.values(table.entries)) {
    const w = entryWeight(e, site.tier);
    total += w;
    if (barred(e, site)) quiet += w;
  }
  return total > 0 ? quiet / total : 1;
}

const barred = (e: NodeContentDef, site: NodeContentSite): boolean =>
  (site.factionKind !== null && (e.notIn?.includes(site.factionKind as never) ?? false)) || (site.start && e.notAtStart === true);

/**
 * One node's content: a single draw `u` in [0, 1) over `quiet` and the entries in table order, each by its weight at the tier. A node holds
 * at most one thing from the table. Pure in its arguments, so a node's content depends only on (seed, position) through `u`.
 * Returns the entry id, or null for a quiet node.
 */
export function rollNodeContent(table: NodeContentTable, site: NodeContentSite, u: number): string | null {
  const weights = Object.entries(table.entries).map(([id, e]) => [id, e, entryWeight(e, site.tier)] as const);
  const total = curveAt(table.quiet, site.tier) + weights.reduce((t, [, , w]) => t + w, 0);
  if (total <= 0) return null;
  let at = u * total;
  for (const [id, e, w] of weights) {
    if (at < w) return barred(e, site) ? null : id;
    at -= w;
  }
  return null;
}

/** The table entry that places a structure (the first one, in table order), or undefined. */
export const entryOfStructure = (table: NodeContentTable, structure: string): NodeContentDef | undefined =>
  Object.values(table.entries).find((e) => e.structure === structure);

/**
 * The one owner of an asteroid field's yield mix: the ores of a field placed as `structure`, each with the weight its table entry gives it (ores
 * the mix omits are left out). Returns undefined when the structure has no mix, and the caller falls back to the ores' own default weights
 * (debug and scenario fields).
 */
export function oreMixFor<O extends { weight: number }>(
  table: NodeContentTable | undefined, ores: Readonly<Record<string, O>>, structure: string | undefined,
): O[] | undefined {
  const mix = structure && table ? entryOfStructure(table, structure)?.ores : undefined;
  if (!mix) return undefined;
  return Object.entries(mix).filter(([id, w]) => w > 0 && ores[id]).map(([id, w]) => ({ ...(ores[id] as O), weight: w }));
}

/** Table problems (empty list when valid): unknown structures, bad curves or ranges. Content tests assert it is empty. */
export function nodeContentErrors(
  table: NodeContentTable, content: Pick<GalaxyContent, 'structures' | 'factions'>, oreIds?: readonly string[],
): string[] {
  const errs: string[] = [];
  const kinds = new Set(Object.values(content.factions).map((f) => f.kind));
  const curve = (what: string, c: TierCurve) => {
    if (!Number.isFinite(c.base) || !Number.isFinite(c.perTier ?? 0)) errs.push(`${what}: curve is not finite`);
    if (c.base < 0) errs.push(`${what}: negative base`);
  };
  curve('quiet', table.quiet);
  for (const [id, e] of Object.entries(table.entries)) {
    if (!content.structures[e.structure]) errs.push(`${id}: unknown structure ${e.structure}`);
    curve(id, e.weight);
    const { min = -Infinity, max = Infinity } = e.danger;
    if (min > max) errs.push(`${id}: danger min above max`);
    if (!(entryWeightPeak(e, min, max) > 0)) errs.push(`${id}: weight is 0 over its whole danger range`);
    for (const [ore, w] of Object.entries(e.ores ?? {})) {
      if (!(w >= 0)) errs.push(`${id}: ore ${ore} has a bad weight`);
      if (oreIds && !oreIds.includes(ore)) errs.push(`${id}: unknown ore ${ore}`);
    }
    if (content.structures[e.structure]?.kind === 'asteroids' && !Object.values(e.ores ?? {}).some((w) => w > 0)) errs.push(`${id}: a field needs an ore mix`);
    for (const k of e.notIn ?? []) if (!kinds.has(k)) errs.push(`${id}: notIn names no faction kind ${k}`);
  }
  return errs;
}

/** Highest weight an entry has over tiers 0..9 inside its range. */
function entryWeightPeak(e: NodeContentDef, min: number, max: number): number {
  let peak = 0;
  for (let t = Math.max(0, min); t <= Math.min(9, max); t++) peak = Math.max(peak, curveAt(e.weight, t));
  return peak;
}
