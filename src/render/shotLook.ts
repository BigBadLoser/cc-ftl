import { ColorMatrixFilter, Graphics, type Sprite } from 'pixi.js';
import type { ShotLook } from '../sim/registry';
import { ART_SCALE as S } from './iso';

/** Colour per weapon def id for trails, flashes and sparks. */
export const WEAPON_COLOR: Readonly<Record<string, number>> = {
  'weapon.burstLaser': 0xff5a4a, 'weapon.massDriver': 0xffd27a, 'weapon.missile': 0xffe9c0, 'weapon.ion': 0x66ccff, 'weapon.incendiary': 0xff8a3a,
};

/** What a shot looks like: its weapon's colour, overlaid by the fitted upgrade's `look` (tint of bolt, trail and burst; blast and trail scale). */
export function shotLook(weapon: string, look?: ShotLook): { tint: number; blast: number; trail: number } {
  return { tint: look?.tint ?? WEAPON_COLOR[weapon] ?? 0xffffff, blast: look?.blast ?? 1, trail: look?.trail ?? 1 };
}

/**
 * The bolt sprite a shot draws: an upgraded (tinted) shot takes its weapon's neutral grey sprite (`<asset>_neutral`, the `upgrades` sheet) when the art has
 * one, so `recolor` gives every tint the same even brightness (a coloured bolt carries its hue's own, a blue one dark); otherwise, and for plain shots, the
 * weapon's own coloured one.
 */
export function boltAsset(asset: string, tinted: boolean, has: (id: string) => boolean): string {
  const n = `${asset}_neutral`;
  return tinted && has(n) ? n : asset;
}

/** The colour of a lightning arc: its shot's tint, or the ion blue-violet. */
export const ARC_COLOR = 0xb48aff;

const recolors = new Map<number, ColorMatrixFilter>();

/**
 * Recolour a sprite to `tint` for real: its brightness is kept and its own hues are replaced (a plain `tint` only multiplies, which turns a coloured
 * sprite muddy). The filter is shared per colour. For an upgraded shot's bolt (its neutral sprite: `boltAsset`) and impact blast.
 */
export function recolor(spr: Sprite, tint: number): void {
  let f = recolors.get(tint);
  if (!f) {
    const k = 1.4; // brightness gain: additive bolts should glow
    const [r, g, b] = [(tint >> 16) & 255, (tint >> 8) & 255, tint & 255].map((c) => (c / 255) * k);
    const lum = [0.3, 0.59, 0.11];
    f = new ColorMatrixFilter();
    f.matrix = [
      ...lum.map((l) => l * (r as number)), 0, 0,
      ...lum.map((l) => l * (g as number)), 0, 0,
      ...lum.map((l) => l * (b as number)), 0, 0,
      0, 0, 0, 1, 0,
    ] as unknown as ColorMatrixFilter['matrix'];
    recolors.set(tint, f);
  }
  spr.filters = [f];
}

/** Lightning is drawn brighter than its shot's tint: pulled towards white. */
export const arcColor = (tint: number): number => {
  const mix = (c: number) => Math.round(c + (255 - c) * 0.45);
  return (mix((tint >> 16) & 255) << 16) | (mix((tint >> 8) & 255) << 8) | mix(tint & 255);
};

/**
 * A lightning arc from `a` to `b` (art px, `alpha` for its fade): a jagged line with a wobble fixed by its end points, so it holds still while it fades.
 * Both the combat view's `arc` effect and the render lab draw it here.
 */
export function drawBolt(g: Graphics, a: { x: number; y: number }, b: { x: number; y: number }, color: number, alpha: number, lift = 10 * S): void {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const steps = Math.max(3, Math.round(len / (12 * S)));
  const pts: { x: number; y: number }[] = [];
  for (let i = 1; i < steps; i++) {
    const k = i / steps;
    const off = (((i * 7 + Math.round(a.x + b.y)) % 5) - 2) * 5 * S;
    pts.push({ x: a.x + dx * k - (dy / len) * off, y: a.y + dy * k - lift + (dx / len) * off });
  }
  g.moveTo(a.x, a.y - lift);
  for (const p of pts) g.lineTo(p.x, p.y);
  g.lineTo(b.x, b.y - lift);
  // a wide soft glow under a thick bright core
  g.stroke({ width: 8 * S / 2, color, alpha: alpha * 0.35 });
  g.moveTo(a.x, a.y - lift);
  for (const p of pts) g.lineTo(p.x, p.y);
  g.lineTo(b.x, b.y - lift).stroke({ width: 2.5 * S / 2, color: arcColor(color), alpha });
}
