import type { Atlas, StaticSprite } from './loader';

/** Stand-in art for an asset id the manifest does not have (yet): existing sprites, plus a tint and an integer scale. */
export interface Fallback {
  ids: readonly string[];
  tint?: number;
  scale?: number;
  /** Art px to raise the sprite (roof plates sit at wall height). */
  lift?: number;
  /** Extra additive pass with this colour, to brighten a dark sprite into a clearly different plate. */
  add?: number;
}

const CRATE = ['prop.crate'];
const CONSOLE = ['module.console'];

/**
 * Fallback table, keyed by the missing asset id. Swapping in real art means adding the ids to the manifest: an id
 * that exists is always used as is, and an id that is in neither the manifest nor this table simply draws nothing.
 */
export const FALLBACK: Readonly<Record<string, Fallback>> = {
  // Combat modules.
  'module.burst_laser': { ids: CRATE, tint: 0xff9a8a },
  'module.mass_driver': { ids: CRATE, tint: 0xffc38a },
  'module.missile_launcher': { ids: CRATE, tint: 0xffe08a },
  'module.ion_cannon': { ids: CRATE, tint: 0x8ac8ff },
  'module.incendiary_launcher': { ids: CRATE, tint: 0xff7a4a },
  'module.engine': { ids: CRATE, tint: 0xffb060 },
  'module.shield_gen': { ids: CRATE, tint: 0x7fe6ff },
  'module.weapons_console': { ids: CONSOLE, tint: 0xff9a8a },
  'module.shield_console': { ids: CONSOLE, tint: 0x8ad8ff },
  'module.helm': { ids: CONSOLE, tint: 0xa8ff9a },
  'module.ai_core': { ids: CONSOLE, tint: 0xd9a8ff },
  // Roofs: the floor plate raised to wall height and lightened/coloured by an additive pass, so it reads as a roof, not a floor.
  'roof.generic': { ids: ['tile.floor.a'], tint: 0xffffff, lift: 38, add: 0x707c92 },
  'roof.weapon': { ids: ['tile.floor.a'], tint: 0xffffff, lift: 38, add: 0xc03020 },
  'roof.shield': { ids: ['tile.floor.a'], tint: 0xffffff, lift: 38, add: 0x1090c8 },
  'roof.engine': { ids: ['tile.floor.a'], tint: 0xffffff, lift: 38, add: 0xc07808 },
  // Projectiles and combat effects.
  'fx.laser_bolt': { ids: ['fx.spark'], tint: 0xff4d4d, scale: 8 },
  'fx.mass_slug': { ids: ['fx.ember'], tint: 0xffd27a, scale: 8 },
  'fx.missile': { ids: ['fx.ember'], tint: 0xffffff, scale: 8 },
  'fx.ion_bolt': { ids: ['fx.spark'], tint: 0x66ccff, scale: 10 },
  'fx.fire_shell': { ids: ['fx.ember'], tint: 0xff7a2a, scale: 8 },
  'fx.shield_hit': { ids: ['fx.ice'], tint: 0x66e0ff, scale: 4 },
  'fx.explosion_small': { ids: ['fx.ember'], tint: 0xffb24a, scale: 8 },
  'fx.pd_shot': { ids: ['fx.spark'], tint: 0xffffff, scale: 2 },
};

export interface Art {
  s: StaticSprite;
  /** Multiply tint (white for real art). */
  tint: number;
  /** Integer scale (1 for real art). */
  scale: number;
  /** True when this is a stand-in. */
  fallback: boolean;
  lift: number;
  add?: number;
}

/** The first existing asset of `chain`, else the fallback for `key`, else undefined. */
export function resolveArt(atlas: Atlas, chain: readonly string[], key: string = chain[chain.length - 1] ?? ''): Art | undefined {
  const real = atlas.firstOf(chain);
  if (real) return { s: real, tint: 0xffffff, scale: 1, fallback: false, lift: 0 };
  const fb = FALLBACK[key];
  const s = fb && atlas.firstOf(fb.ids);
  return fb && s ? { s, tint: fb.tint ?? 0xffffff, scale: fb.scale ?? 1, fallback: true, lift: fb.lift ?? 0, add: fb.add } : undefined;
}
