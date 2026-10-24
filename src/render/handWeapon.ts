import type { HandWeaponArt, WeaponFamily } from '../sim';
import type { ClipDef } from './assets/manifest';

/**
 * Hand-weapon art: which clip a crew member plays with a weapon of each pose family, which layer (holster or held) is
 * drawn for a clip, and where the muzzle is. Pure data and functions; crewView and fightFx do the drawing.
 */

/** The clips of one pose family (the held weapon layer has exactly these, plus the cover variants). */
interface FamilyClips {
  aim: string;
  fire: string;
  /** Moving while engaged; absent for melee (the crew walk, weapon holstered). */
  walk?: string;
  /** The fire clip loops for as long as the cooldown lasts (flamethrower, repeater). */
  loopFire?: true;
  /** Crouched in cover: the same, behind a low obstacle. No sim notion of cover posture exists yet, so unused. */
  crouchAim?: string;
  crouchFire?: string;
}

export const FAMILY: Readonly<Record<WeaponFamily, FamilyClips>> = {
  '1h': { aim: 'aim_1h', fire: 'fire_1h', walk: 'walk_aim_1h', crouchAim: 'crouch_aim_1h', crouchFire: 'crouch_fire_1h' },
  '2h': { aim: 'aim_2h', fire: 'fire_2h', walk: 'walk_aim_2h', crouchAim: 'crouch_aim_2h', crouchFire: 'crouch_fire_2h' },
  heavy: { aim: 'aim_heavy', fire: 'fire_heavy', walk: 'walk_heavy', loopFire: true, crouchFire: 'crouch_fire_heavy' },
  '1m': { aim: 'ready_1m', fire: 'swing_1m', crouchAim: 'crouch_ready_1m' },
  '2m': { aim: 'ready_2m', fire: 'swing_2m' },
};

/** Every clip in which the weapon is in the hands (the holster is empty then). Leans are held-weapon clips too. */
const COMBAT = new Set<string>([
  ...Object.values(FAMILY).flatMap((f) => [f.aim, f.fire, f.walk, f.crouchAim, f.crouchFire]),
  'lean_l_1h', 'lean_r_1h', 'lean_l_2h', 'lean_r_2h',
].filter((c): c is string => !!c));

export function isCombatClip(clip: string): boolean {
  return COMBAT.has(clip);
}

export interface Stance {
  /** In a fight (a target to shoot or close on), or recently so. */
  engaged: boolean;
  moving: boolean;
}

/**
 * The combat clip for a weapon family, or null for the ordinary clip (not engaged, or a melee weapon on the move: the
 * crew walk with the blade holstered). The fire clip is not chosen here: it plays once per shot (see `fireClip`).
 */
export function stanceClip(family: WeaponFamily, st: Stance): string | null {
  if (!st.engaged) return null;
  const f = FAMILY[family];
  return st.moving ? f.walk ?? null : f.aim;
}

/** The clip played once per shot (looped for as long as the cooldown lasts when `loopFire`), and its seconds for `cooldownSec`. */
export function fireClip(family: WeaponFamily, clip: ClipDef | undefined, cooldownSec: number): { clip: string; sec: number } {
  const f = FAMILY[family];
  const own = clip ? clip.frames / Math.max(1, clip.fps) : 0;
  return { clip: f.fire, sec: f.loopFire ? Math.max(own, cooldownSec) : own };
}

/** Clips to queue when a crew member with this weapon enters a fight, so the first shot does not draw the idle pose. */
export function prefetchClips(family: WeaponFamily): string[] {
  const f = FAMILY[family];
  return [f.aim, f.fire, ...(f.walk ? [f.walk] : [])];
}

/**
 * Whether a weapon layer is drawn for a clip: the held layer only in combat clips, the holster only outside them, so
 * the weapon is never drawn twice. Other layers always.
 */
export function layerShown(slot: string, clip: string): boolean {
  if (slot === 'gear.hand') return isCombatClip(clip);
  if (slot === 'gear.holster') return !isCombatClip(clip);
  return true;
}

/** Layer ids for a weapon's art: the holster and the held layer of a species' set. */
export function weaponLayerIds(prefix: string, art: HandWeaponArt | undefined): string[] {
  return art ? [`${prefix}gear.holster.${art.id}`, `${prefix}gear.hand.${art.id}`] : [];
}

/** The muzzle (the tip, for melee) of a frame of a clip, in sprite px from the anchor (x right, y down), or null. */
export function muzzleAt(clip: ClipDef | undefined, dir: number, frame: number): { x: number; y: number } | null {
  const row = clip?.muzzle?.[((dir % 8) + 8) % 8];
  const pt = row?.[Math.max(0, Math.min(row.length - 1, frame))];
  return pt ? { x: pt[0], y: pt[1] } : null;
}
