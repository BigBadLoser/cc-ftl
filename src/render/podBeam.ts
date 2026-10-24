import { Container, Sprite } from 'pixi.js';
import type { Atlas, StaticSprite } from './assets/loader';
import { TILE_W } from './iso';
import { barrel, beamEnd, HIDDEN } from './podMuzzle';

/**
 * The mining pod's laser from the `fx_mining` sheet (tools/blender/sprites/fx_mining.py): `fx.mining.beam.<0-3>` is a one-tile
 * segment pointing screen-right, square-ended so segments tile; here it is cut into equal pieces along the straight line from the
 * emitter face to the ore's top face (podMuzzle.ts, so the beam stays collinear with the barrel), each rotated onto the line.
 * `fx.mining.hit.<0-3>` (the molten spot) and `fx.mining.chips.<0-3>` (thrown rock) loop at the impact. Render-only.
 */
export interface PodBeam {
  /** Behind the pod's hull: the beam while the barrel points away from the camera (headings d4 to d6). */
  back: Container;
  /** In front of the pod: the beam on the other headings, and the impact. */
  front: Container;
  /** Draw the beam of a pod on heading `d` for the mining frame `frame` (0 or 1) at time `clock` (s). */
  show(d: number, frame: number, clock: number, pulse: number): void;
  hide(): void;
}

/** A segment of the sheet's beam spans one Blender unit, which is this many art px on screen. */
const UNIT = TILE_W / Math.SQRT2;
/** Ms per frame of the 4-frame beam and impact loops. */
const LOOP_MS = 90;
const LOOP = 4;

interface Part {
  body: Sprite;
  glow: Sprite;
}

/** Sprites reused from frame to frame: `put` places the next one, `flush` hides the rest. */
function pool(parent: Container): { put(s: StaticSprite, x: number, y: number, rot: number, sx: number, alpha: number): void; flush(): void } {
  const parts: Part[] = [];
  let used = 0;
  return {
    put(s, x, y, rot, sx, alpha) {
      let p = parts[used];
      if (!p) {
        const body = new Sprite();
        const glow = new Sprite();
        glow.blendMode = 'add';
        parent.addChild(body, glow);
        p = { body, glow };
        parts.push(p);
      }
      used++;
      for (const [sp, tex] of [[p.body, s.tex], [p.glow, s.glow]] as const) {
        sp.visible = !!tex;
        if (!tex) continue;
        sp.texture = tex;
        sp.anchor.set(s.ax / tex.width, s.ay / tex.height);
        sp.position.set(x, y);
        sp.rotation = rot;
        sp.scale.set(sx, 1);
        sp.alpha = alpha;
      }
    },
    flush() {
      for (let i = used; i < parts.length; i++) {
        const p = parts[i] as Part;
        p.body.visible = false;
        p.glow.visible = false;
      }
      used = 0;
    },
  };
}

export function createPodBeam(atlas: Atlas): PodBeam {
  const back = new Container();
  const front = new Container();
  const beams = { back: pool(back), front: pool(front) };
  const impact = pool(front);
  return {
    back,
    front,
    show(d, frame, clock, pulse) {
      const k = Math.floor((clock * 1000) / LOOP_MS) % LOOP;
      const [sx, sy] = barrel(d, frame).tip;
      const [ex, ey] = beamEnd(d, frame);
      const len = Math.hypot(ex - sx, ey - sy);
      const seg = atlas.stat(`fx.mining.beam.${k}`);
      const layer = HIDDEN.has(d) ? beams.back : beams.front;
      if (seg && len > 1) {
        const n = Math.max(1, Math.round(len / UNIT));
        const step = len / n;
        const rot = Math.atan2(ey - sy, ex - sx);
        for (let i = 0; i < n; i++) {
          const c = (i + 0.5) * step;
          layer.put(seg, sx + (Math.cos(rot) * c), sy + Math.sin(rot) * c, rot, step / UNIT, 0.75 + 0.25 * pulse);
        }
      }
      const hit = atlas.stat(`fx.mining.hit.${k}`);
      if (hit) impact.put(hit, ex, ey, 0, 1, 1);
      const chips = atlas.stat(`fx.mining.chips.${k}`);
      if (chips) impact.put(chips, ex, ey, 0, 1, 1);
      beams.back.flush();
      beams.front.flush();
      impact.flush();
    },
    hide() {
      beams.back.flush();
      beams.front.flush();
      impact.flush();
    },
  };
}
