import type { FactionRelationDef } from '../sim';

/**
 * The faction relations table: one entry per pair. `stance` says who fights whom ('war': fleets fight on sight, rivals take each other's jobs);
 * `spill` is `[into a, into b]`: how far b's reputation with you moves a's standing, and a's moves b's (scaled by STANDING_SPILLOVER, so a
 * friend of the navy is a little friendlier to its allies). A pair that is not listed is neutral and shares nothing. The rogue AI is
 * `alwaysHostile`, so it is at war with everyone; its entries only carry the spill.
 * `pirates` is the Scrapper Clans. Phase 2b pirate factions (DESIGN.md): every pirate pair is listed, hostile unless noted (the black-market truce is slice 2); the
 * `fixed: true` pins a pair (the coarse tier, galaxy/war.ts, never changes it): the navy against the pirate factions, everyone against the rogue AI, the
 * traders, the mercenaries and the zealots' alliance. The other rows (the navy and the corporations, the pirate factions among themselves) are the starting
 * point of stances that drift: wars start between neighbours and end again.
 * The cartel is neutral with the Scrappers and at war with the raiders; the mercenaries are neutral to everyone; the zealots are allied with the Rogue AI.
 */
export const relations = [
  { a: 'navy', b: 'pirates', stance: 'war', spill: [-0.6, -0.5], fixed: true },
  { a: 'navy', b: 'rogue', stance: 'war', spill: [-0.5, 0], fixed: true },
  { a: 'navy', b: 'meridian', stance: 'neutral', spill: [0.3, 0.3] },
  { a: 'navy', b: 'helix', stance: 'neutral', spill: [0.2, 0.2] },
  { a: 'navy', b: 'vantor', stance: 'neutral', spill: [0.2, 0] },
  { a: 'meridian', b: 'helix', stance: 'war', spill: [-0.4, -0.4] },
  { a: 'meridian', b: 'vantor', stance: 'war', spill: [-0.2, -0.2] },
  { a: 'meridian', b: 'pirates', stance: 'war', spill: [-0.4, 0], fixed: true },
  { a: 'helix', b: 'rogue', stance: 'war', spill: [-0.3, 0], fixed: true },
  { a: 'helix', b: 'vantor', stance: 'neutral' },
  { a: 'vantor', b: 'traders', stance: 'neutral', spill: [0.2, 0.2], fixed: true },
  { a: 'vantor', b: 'pirates', stance: 'war', spill: [-0.3, 0], fixed: true },
  { a: 'traders', b: 'pirates', stance: 'war', spill: [-0.3, -0.3], fixed: true },
  // --- Pirate factions against the law and the traders (the mercenaries are neutral to all, so have no rows). ---
  { a: 'navy', b: 'raiders', stance: 'war', spill: [-0.5, -0.4], fixed: true },
  { a: 'navy', b: 'cartel', stance: 'war', spill: [-0.4, -0.3], fixed: true },
  { a: 'navy', b: 'zealots', stance: 'war', spill: [-0.5, -0.4], fixed: true },
  { a: 'meridian', b: 'raiders', stance: 'war', spill: [-0.3, 0], fixed: true },
  { a: 'vantor', b: 'raiders', stance: 'war', spill: [-0.25, 0], fixed: true },
  { a: 'meridian', b: 'zealots', stance: 'war', spill: [-0.2, 0], fixed: true },
  { a: 'traders', b: 'raiders', stance: 'war', spill: [-0.3, -0.2], fixed: true },
  { a: 'traders', b: 'cartel', stance: 'war', spill: [-0.2, -0.1], fixed: true },
  { a: 'traders', b: 'zealots', stance: 'war', spill: [-0.2, -0.2], fixed: true },
  // --- Pirates against each other. Killing one faction's ships warms its rivals a little (negative spill: its reputation counts against theirs). ---
  { a: 'pirates', b: 'raiders', stance: 'war', spill: [-0.2, -0.2] },
  { a: 'pirates', b: 'zealots', stance: 'war', spill: [-0.2, -0.2] },
  { a: 'raiders', b: 'cartel', stance: 'war', spill: [-0.4, -0.4] },
  { a: 'raiders', b: 'zealots', stance: 'war', spill: [-0.2, -0.2] },
  { a: 'cartel', b: 'zealots', stance: 'war', spill: [-0.2, -0.2] },
  // The cartel buys the Scrappers' salvage, and pays the mercenaries.
  { a: 'cartel', b: 'pirates', stance: 'neutral', spill: [0.15, 0.15] },
  { a: 'cartel', b: 'mercenaries', stance: 'neutral', spill: [0.2, 0.2], fixed: true },
  // Mercenaries are neutral to the other pirates and the law: listed so every pirate pair has a row.
  { a: 'mercenaries', b: 'pirates', stance: 'neutral', fixed: true },
  { a: 'mercenaries', b: 'raiders', stance: 'neutral', fixed: true },
  { a: 'mercenaries', b: 'zealots', stance: 'neutral', fixed: true },
  // The cult serves the machines: it never fights them. Hurting the drones costs the zealots' goodwill.
  { a: 'zealots', b: 'rogue', stance: 'allied', spill: [0.6, 0], fixed: true },
] as const satisfies readonly FactionRelationDef[];
