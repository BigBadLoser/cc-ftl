import { Container, Graphics } from 'pixi.js';
import { iso } from './iso';

/** The line brush's cut, drawn as a bold bright stroke through the tile centres (a wide coloured glow under a white core), on top of the plan ghosts. */
export interface CutLine {
  /** One polyline per segment (a mirrored cut has two); `color` is the glow. Empty clears. */
  set(segments: readonly (readonly { x: number; y: number }[])[], color: number): void;
}

export function createCutLine(parent: Container): CutLine {
  const g = new Graphics();
  g.visible = false;
  parent.addChild(g);
  return {
    set(segments, color) {
      g.clear();
      g.visible = segments.length > 0;
      for (const [width, c, alpha] of [[14, color, 0.45], [6, 0xffffff, 1]] as const) {
        for (const seg of segments) {
          seg.forEach((t, i) => {
            const p = iso(t.x, t.y);
            if (i === 0) g.moveTo(p.x, p.y);
            else g.lineTo(p.x, p.y);
          });
          if (seg.length === 1) {
            const p = iso((seg[0] as { x: number; y: number }).x, (seg[0] as { x: number; y: number }).y);
            g.lineTo(p.x + 0.01, p.y);
          }
        }
        g.stroke({ width, color: c, alpha, cap: 'round', join: 'round' });
      }
    },
  };
}
