import { Graphics } from 'pixi.js';
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

/** The colour of a lightning arc: its shot's tint, or the ion blue-violet. */
export const ARC_COLOR = 0xb48aff;

/**
 * A lightning arc from `a` to `b` (art px, `alpha` for its fade): a jagged line with a wobble fixed by its end points, so it holds still while it fades.
 * Both the combat view's `arc` effect and the render lab draw it here.
 */
export function drawBolt(g: Graphics, a: { x: number; y: number }, b: { x: number; y: number }, color: number, alpha: number, lift = 10 * S): void {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const steps = Math.max(3, Math.round(len / (12 * S)));
  g.moveTo(a.x, a.y - lift);
  for (let i = 1; i < steps; i++) {
    const k = i / steps;
    const off = (((i * 7 + Math.round(a.x + b.y)) % 5) - 2) * 3 * S;
    g.lineTo(a.x + dx * k - (dy / len) * off, a.y + dy * k - lift + (dx / len) * off);
  }
  g.lineTo(b.x, b.y - lift).stroke({ width: 2, color, alpha, pixelLine: true });
}
