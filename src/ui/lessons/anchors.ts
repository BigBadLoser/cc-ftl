/**
 * The UI elements a lesson can point at. An element opts in with `data-lesson={anchor('combat.heat')}` (or a kit `Frame`'s
 * `lesson` prop); a lesson step targets it by the same name. The list is typed, so a missing or renamed anchor fails the typecheck.
 */
export const LESSON_ANCHORS = [
  'combat.weapons',
  'combat.actions',
  'combat.heat',
  'combat.status',
  'combat.flee',
  'combat.enemy',
  'station.hail',
  'station.tabs',
] as const;

export type LessonAnchor = (typeof LESSON_ANCHORS)[number];

/** The `data-lesson` value for an anchor (a typo is a type error at the call site). */
export const anchor = (name: LessonAnchor): LessonAnchor => name;

/** The CSS selector of an anchor. */
export const anchorSelector = (name: LessonAnchor): string => `[data-lesson="${name}"]`;
