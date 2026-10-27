import type { FactionRelationDef } from '../sim';

/**
 * The faction relations table: one entry per pair. `stance` says who fights whom ('war': fleets fight on sight, rivals take each other's jobs);
 * `spill` is `[into a, into b]`: how far b's reputation with you moves a's standing, and a's moves b's (scaled by STANDING_SPILLOVER, so a
 * friend of the navy is a little friendlier to its allies). A pair that is not listed is neutral and shares nothing. The rogue AI is
 * `alwaysHostile`, so it is at war with everyone; its entries only carry the spill.
 * Phase 2b (more pirate factions) adds rows here: pirates at war with each other, the cartel neutral with the Scrappers, and so on.
 */
export const relations = [
  { a: 'navy', b: 'pirates', stance: 'war', spill: [-0.6, -0.5] },
  { a: 'navy', b: 'rogue', stance: 'war', spill: [-0.5, 0] },
  { a: 'navy', b: 'meridian', stance: 'neutral', spill: [0.3, 0.3] },
  { a: 'navy', b: 'helix', stance: 'neutral', spill: [0.2, 0.2] },
  { a: 'navy', b: 'vantor', stance: 'neutral', spill: [0.2, 0] },
  { a: 'meridian', b: 'helix', stance: 'war', spill: [-0.4, -0.4] },
  { a: 'meridian', b: 'vantor', stance: 'war', spill: [-0.2, -0.2] },
  { a: 'meridian', b: 'pirates', stance: 'war', spill: [-0.4, 0] },
  { a: 'helix', b: 'rogue', stance: 'war', spill: [-0.3, 0] },
  { a: 'vantor', b: 'traders', stance: 'neutral', spill: [0.2, 0.2] },
  { a: 'vantor', b: 'pirates', stance: 'war', spill: [-0.3, 0] },
  { a: 'traders', b: 'pirates', stance: 'war', spill: [-0.3, -0.3] },
] as const satisfies readonly FactionRelationDef[];
