import { Container, Graphics, Text } from 'pixi.js';

const C_OUTLINE = 0x05080d;
/** Dash length, gap and flow speed (towards the target), in screen px. */
const DASH = 11;
const DASH_GAP = 9;
const DASH_SPEED = 26;
/** Lateral spacing between neighbouring arrows' tails and the share of it kept at the head (so several arrows fan in to the target). */
const LANE = 58;
const HEAD_FAN = 0.2;
const MARGIN = 8;
const PILL_H = 20;

export interface ArrowIn {
  key: number;
  /** Target marker centre and radius (art px, the sector layer). */
  x: number;
  y: number;
  r: number;
  /** Unit screen direction from the target towards the attacker. */
  dx: number;
  dy: number;
  eta: number;
  /** This shot's colour (matches its marker in the incoming timeline). */
  color: number;
}

/** The visible rectangle of the pass being drawn, in art px. */
export interface ArrowFrame {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface ThreatArrows {
  /** Draw the arrows (`s`: device px per art px). Call with an empty list to clear. */
  update(arrows: readonly ArrowIn[], f: ArrowFrame, s: number): void;
}

/**
 * PLACEHOLDER overlay: one red arrow per incoming shot. It starts at the frame edge the attacker lies towards and flows into the target marker, with the
 * seconds to impact in a pill at its tail. Drawn in the sector layer, sized in screen px whatever the camera. Reads nothing from the sim.
 */
export function createThreatArrows(parent: Container): ThreatArrows {
  const gfx = new Graphics();
  parent.addChild(gfx);
  const texts: Text[] = [];
  const text = (i: number): Text => {
    let t = texts[i];
    if (!t) {
      t = new Text({ text: '', style: { fontFamily: 'Rajdhani, Arial Narrow, sans-serif', fontWeight: '700', fontSize: 14, fill: 0xffffff }, resolution: 2 });
      t.anchor.set(0.5);
      parent.addChild(t);
      texts[i] = t;
    }
    return t;
  };

  return {
    update(arrows, f, s) {
      gfx.clear();
      const px = (n: number) => n / s;
      const m = px(MARGIN);
      const pills: { x: number; y: number; w: number; px: number; py: number; color: number }[] = [];
      const sorted = [...arrows].sort((a, b) => a.key - b.key);
      sorted.forEach((a, i) => {
        // Lanes fan out along the edge, perpendicular to the direction.
        const lane = (i - (sorted.length - 1) / 2) * px(LANE);
        const nx = -a.dy;
        const ny = a.dx;
        const ox = a.x + nx * lane;
        const oy = a.y + ny * lane;
        // Walk from the (offset) target along the direction to the inset frame edge.
        const tx = a.dx > 1e-6 ? (f.x1 - m - ox) / a.dx : a.dx < -1e-6 ? (f.x0 + m - ox) / a.dx : Infinity;
        const ty = a.dy > 1e-6 ? (f.y1 - m - oy) / a.dy : a.dy < -1e-6 ? (f.y0 + m - oy) / a.dy : Infinity;
        const len = Math.max(px(50), Math.min(tx, ty));
        const tailX = ox + a.dx * len;
        const tailY = oy + a.dy * len;
        const gap = a.r + px(5);
        const headX = a.x + nx * lane * HEAD_FAN + a.dx * gap;
        const headY = a.y + ny * lane * HEAD_FAN + a.dy * gap;
        const L = Math.hypot(tailX - headX, tailY - headY);
        if (L < px(10)) return;
        const ux = (tailX - headX) / L;
        const uy = (tailY - headY) / L;
        // Dashed shaft, flowing tail -> head.
        const period = px(DASH + DASH_GAP);
        const off = period - px(((performance.now() / 1000) * DASH_SPEED) % (DASH + DASH_GAP)); // distance from the head to the first dash start
        for (let d = off - period; d < L; d += period) {
          const d0 = Math.max(px(14), d);
          const d1 = Math.min(L - px(1), d + px(DASH));
          if (d1 <= d0) continue;
          gfx.moveTo(headX + ux * d0, headY + uy * d0).lineTo(headX + ux * d1, headY + uy * d1);
        }
        gfx.stroke({ width: px(3), color: a.color, alpha: 0.95, cap: 'butt' });
        // Head.
        const hl = px(13);
        const hw = px(8);
        gfx.poly([headX, headY, headX + ux * hl - uy * hw, headY + uy * hl + ux * hw, headX + ux * hl + uy * hw, headY + uy * hl - ux * hw]).fill({ color: a.color }).stroke({ width: px(1.5), color: C_OUTLINE, alpha: 0.8 });
        pills.push({ x: tailX, y: tailY, w: 0, px: nx, py: ny, color: a.color });
        const t = text(pills.length - 1);
        t.text = `${a.eta.toFixed(1)}s`;
        t.scale.set(px(1));
        const p = pills[pills.length - 1] as (typeof pills)[number];
        p.w = px(Math.max(40, t.width * s + 14));
      });
      // Pills: nudge along the edge until none overlap, then keep them inside the frame.
      const h = px(PILL_H);
      for (let i = 0; i < pills.length; i++) {
        const p = pills[i] as (typeof pills)[number];
        for (let tries = 0; tries < 8; tries++) {
          const hit = pills.slice(0, i).some((q) => Math.abs(q.x - p.x) < (q.w + p.w) / 2 + px(3) && Math.abs(q.y - p.y) < h + px(3));
          if (!hit) break;
          p.x += p.px * px(26);
          p.y += p.py * px(26);
        }
        p.x = Math.max(f.x0 + p.w / 2 + px(2), Math.min(f.x1 - p.w / 2 - px(2), p.x));
        p.y = Math.max(f.y0 + h / 2 + px(2), Math.min(f.y1 - h / 2 - px(2), p.y));
        gfx.roundRect(p.x - p.w / 2, p.y - h / 2, p.w, h, h / 2).fill({ color: 0x3a0c12, alpha: 0.94 }).stroke({ width: px(1.5), color: p.color });
        text(i).position.set(p.x, p.y);
        text(i).visible = true;
      }
      for (let i = pills.length; i < texts.length; i++) (texts[i] as Text).visible = false;
    },
  };
}
