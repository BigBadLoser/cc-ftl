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

/** Table problems (empty list when valid): unknown structures, bad curves or ranges. Content tests assert it is empty. */
export function nodeContentErrors(table: NodeContentTable, content: Pick<GalaxyContent, 'structures' | 'factions'>): string[] {
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
