/**
 * Body-part glyphs Tabler has no icon for (the crew Health tab, #601), drawn to the same rules as the set: a 24-unit grid, 2-unit round strokes, no fill
 * (Icon.svelte strokes them). Drawn for the right side; a left part is mirrored by the caller.
 */
export const BODY_GLYPHS = {
  // Three vertebrae on a cord.
  'part-spine': '<path d="M12 2v20" /><path d="M8.5 5h7" /><path d="M8 10h8" /><path d="M8 15h8" /><path d="M8.5 20h7" />',
  // Shoulder down to the elbow, the forearm out, an open hand.
  'part-arm': '<path d="M8 3v8a3 3 0 0 0 3 3h5" /><path d="M16 11.5v5" /><path d="M16 14h3.5" />',
  // Hip down to the knee, the shin, the foot forward.
  'part-leg': '<path d="M9 3l1.5 8l-1.5 8h7" />',
} as const;
