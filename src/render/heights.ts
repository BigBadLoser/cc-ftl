/**
 * Height in art px of a full-height wall: the plane the roof sits on. This is the ONE place the wall/roof height lives.
 * It lifts roofs, roof parts, turrets, overlay markers and projectile launch points, and sizes the fallback roof plates.
 * When the walls get taller (walls-tall), change this number (and the wall sprites) and nothing else.
 */
export const ROOF_H = 38;

/** Launch height of a shot: the roof turret. Shots descend to ground level at their target. */
export const MUZZLE_H = ROOF_H;
export const IMPACT_H = 6;
