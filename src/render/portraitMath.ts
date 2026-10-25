/** The pure parts of the crew portraits: which loadout a portrait shows, and which part of the figure is cut out. */

/** Facing of a portrait: 1 = straight at the camera (directions run SE, S, SW, W, NW, N, NE, E). */
export const PORTRAIT_DIR = 1;
/** The clip a portrait takes its frame from (its first frame). */
export const PORTRAIT_CLIP = 'idle';
/** Size of a humanoid portrait crop in world px (2 per art px): head and shoulders, 16 x 18 art px. */
export const HEAD_CROP = 32;
export const HEAD_CROP_H = 36;
/** Empty rows kept above the head, in world px. */
const HEAD_MARGIN = 2;

export interface Rect { x: number; y: number; w: number; h: number }

/** What a portrait looks like, as a cache key: it changes only when species, role, appearance or the worn weapon does. */
export function portraitKey(species: string, role: string, appearanceSeed: number, weaponArt: string | undefined): string {
  return `${species}|${role}|${appearanceSeed}|${weaponArt ?? ''}`;
}

/** Frame cell of the body at the portrait's clip, in world px from the layer frame's top-left, and the layer anchor. */
export interface BodyCell { ox: number; oy: number; w: number; h: number; ax: number; ay: number }

/**
 * The crop, in world px from the anchor (feet), for a figure: a humanoid layered body gets a fixed head-and-shoulders block
 * centred on the anchor, its top just above the body's top; a single-body figure (robot, creature) gets a square (or less, for
 * a narrower body) off the top of its body cell, centred on the cell. Even sizes, so it halves to whole art px.
 */
export function cropRect(c: BodyCell, humanoid: boolean): Rect {
  const top = c.oy - c.ay;
  if (humanoid) return { x: -HEAD_CROP / 2, y: top - HEAD_MARGIN, w: HEAD_CROP, h: HEAD_CROP_H };
  const side = Math.max(2, Math.min(c.w, c.h) & ~1);
  return { x: Math.round(c.ox + c.w / 2 - c.ax - side / 2) & ~1, y: top & ~1, w: side, h: side };
}
