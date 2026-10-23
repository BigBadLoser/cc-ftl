import { ROOF_H } from '../heights';
import { DEPLOY_FRAMES } from '../deployArt';
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
  /** Draw the sprite once per footprint tile (solid tiles only) instead of once at the front tile, so a stand-in fills a multi-tile footprint. */
  perTile?: boolean;
  /** Deploy-frame stand-in: 0..1 how far out it is (drawn lower while small). */
  rise?: number;
}

const CRATE = ['prop.crate'];
const CONSOLE = ['module.console'];
const FLOOR = ['tile.floor.a'];

/**
 * Fallback table, keyed by the missing asset id. Swapping in real art means adding the ids to the manifest: an id
 * that exists is always used as is, and an id that is in neither the manifest nor this table simply draws nothing.
 */
export const FALLBACK: Record<string, Fallback> = {
  // Combat modules, one stand-in sprite per footprint tile. Weapons are floor bays (flat plates) under a roof turret.
  'module.burst_laser.bay': { ids: FLOOR, tint: 0xff9a8a, perTile: true },
  'module.mass_driver.bay': { ids: FLOOR, tint: 0xffc38a, perTile: true },
  'module.missile_launcher.bay': { ids: FLOOR, tint: 0xffe08a, perTile: true },
  'module.ion_cannon.bay': { ids: FLOOR, tint: 0x8ac8ff, perTile: true },
  'module.incendiary_launcher.bay': { ids: FLOOR, tint: 0xff7a4a, perTile: true },
  'module.point_defense.bay': { ids: FLOOR, tint: 0xd0d8e8, perTile: true },
  // Engine: the always-full-height hull section (one wall block per hull-row tile) and the machine behind it.
  'module.engine.hull': { ids: ['tile.hull.full.m15', 'tile.hull.m15'], tint: 0xffc080, perTile: true },
  'module.engine.machine': { ids: CRATE, tint: 0xffb060, perTile: true },
  'module.engine.machine.active': { ids: CRATE, tint: 0xffe0a0, perTile: true },
  // Pod bay (asteroids slice 2): a hatch plate per tile until its art exists.
  'module.pod_bay': { ids: FLOOR, tint: 0xd8c070, perTile: true },
  'module.shield_gen': { ids: CRATE, tint: 0x7fe6ff, perTile: true },
  'module.shield_gen_small': { ids: CRATE, tint: 0x7fe6ff, perTile: true },
  'module.weapons_console': { ids: CONSOLE, tint: 0xff9a8a, perTile: true },
  'module.shield_console': { ids: CONSOLE, tint: 0x8ad8ff, perTile: true },
  'module.helm': { ids: CONSOLE, tint: 0xa8ff9a, perTile: true },
  'module.ai_core': { ids: CONSOLE, tint: 0xd9a8ff, perTile: true },
  // Galley / food printer: the fabricator tinted mint green until it has its own model (art list in docs/STATUS.md).
  'module.galley': { ids: ['module.fabricator'], tint: 0x8affc0 },
  // Ore refinery (3x4): a crate per footprint tile, tinted orange, until it has art.
  'module.refinery': { ids: CRATE, tint: 0xffa060, perTile: true },
  // Cargo containers have no entry: until their sheets land they are drawn boxes (render/containerBox.ts).
  // Roof turret: a crate with a barrel nub pointing along the aim (see turretView).
  'turret.generic': { ids: CRATE, tint: 0xd0d8e8 },
  'turret.generic.charged': { ids: CRATE, tint: 0xfff0b0 },
  // Roofs: the floor plate raised to wall height and lightened/coloured by an additive pass, so it reads as a roof, not a floor.
  'roof.generic': { ids: ['tile.floor.a'], tint: 0xffffff, lift: ROOF_H, add: 0x707c92 },
  'roof.shield_gen': { ids: CRATE, tint: 0x9fe8ff, perTile: true },
  'roof.shield_gen_small': { ids: CRATE, tint: 0x9fe8ff, perTile: true },
  'roof.ai_core': { ids: CONSOLE, tint: 0xd9a8ff, perTile: true },
  'roof.ai_core.active': { ids: CONSOLE, tint: 0xf0d8ff, perTile: true },
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

/**
 * Placeholders for deployable roof parts: a flat cap while stowed, and the deployed stand-in rising by `rise` for the
 * deploy frames. Stand-ins only; the real art is pre-rendered frames under the same ids.
 */
function deployFallbacks(): Record<string, Fallback> {
  const out: Record<string, Fallback> = {};
  const parts: [string, string][] = [['turret.generic', 'turret.generic']];
  for (const stem of ['burst_laser', 'mass_driver', 'missile_launcher', 'ion_cannon', 'incendiary_launcher', 'point_defense']) parts.push([`turret.${stem}`, 'turret.generic']);
  for (const id of ['roof.shield_gen', 'roof.shield_gen_small', 'roof.ai_core']) parts.push([id, id]);
  for (const [base, like] of parts) {
    const out_ = FALLBACK[like] as Fallback;
    const turret = base.startsWith('turret');
    out[`${base}.stowed`] = { ids: FLOOR, tint: 0x8a94a8, lift: ROOF_H, add: 0x303844, ...(turret ? {} : { perTile: true }) };
    for (let i = 0; i < DEPLOY_FRAMES; i++) out[`${base}.deploy.f${i}`] = { ...out_, rise: (i + 1) / (DEPLOY_FRAMES + 1) };
  }
  return out;
}
Object.assign(FALLBACK, deployFallbacks());

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
  perTile: boolean;
  /** 1 for anything but a deploy-frame stand-in. */
  rise: number;
}

/** The first existing asset of `chain`, else the fallback for `key`, else undefined. */
export function resolveArt(atlas: Atlas, chain: readonly string[], key: string = chain[chain.length - 1] ?? ''): Art | undefined {
  const real = atlas.firstOf(chain);
  if (real) return { s: real, tint: 0xffffff, scale: 1, fallback: false, lift: 0, perTile: false, rise: 1 };
  if (atlas.loading(chain)) return undefined; // the real art is on its way: draw nothing, not the stand-in
  const fb = FALLBACK[key];
  const s = fb && atlas.firstOf(fb.ids);
  return fb && s ? { s, tint: fb.tint ?? 0xffffff, scale: fb.scale ?? 1, fallback: true, lift: fb.lift ?? 0, add: fb.add, perTile: !!fb.perTile, rise: fb.rise ?? 1 } : undefined;
}
