import { Sprite } from 'pixi.js';
import type { Grid } from '../sim/grid';
import { Struct } from '../sim/structure';
import type { Atlas, StaticSprite } from './assets/loader';
import { depthKey, iso } from './iso';
import type { Layers } from './layers';

export interface FxViewHost {
  target(): { grid: Grid } | null;
}

export interface FxView {
  update(): void;
  dispose(): void;
}

const FIRE_FPS = 9;
const SMOKE_MIN = 14;

interface FireSlot {
  spr: Sprite;
  glow: Sprite;
}

/** Fire flames (looping sprite frames plus glow, scaled by intensity) and smoke puffs (translucent, by density). */
export function createFxView(atlas: Atlas, L: Layers, host: FxViewHost): FxView {
  const frames: StaticSprite[] = [];
  for (const id of atlas.ids('fx.fire.')) {
    const s = atlas.stat(id);
    if (s) frames.push(s);
  }
  const smokeSpr = atlas.stat('fx.smoke');
  const fires: FireSlot[] = [];
  const puffs: Sprite[] = [];
  let nf = 0;
  let np = 0;

  const fireSlot = (): FireSlot => {
    let f = fires[nf];
    if (!f) {
      const spr = new Sprite();
      const glow = new Sprite();
      glow.blendMode = 'add';
      L.sorted.addChild(spr, glow);
      fires[nf] = f = { spr, glow };
    }
    nf++;
    f.spr.visible = f.glow.visible = true;
    return f;
  };
  const puff = (): Sprite => {
    let s = puffs[np];
    if (!s) {
      s = new Sprite(smokeSpr?.tex);
      L.fx.addChild(s);
      puffs[np] = s;
    }
    np++;
    s.visible = true;
    return s;
  };

  return {
    update() {
      nf = np = 0;
      const t = host.target();
      const now = performance.now() / 1000;
      if (t && frames.length) {
        const { grid } = t;
        const struct = grid.raw('struct');
        const fire = grid.raw('fire');
        const smoke = grid.raw('smoke');
        const w = grid.width;
        for (let i = 0; i < struct.length; i++) {
          const kind = struct[i];
          if (kind !== Struct.Floor && kind !== Struct.Door) continue;
          const x = i % w;
          const y = (i - x) / w;
          const fv = fire[i] as number;
          if (fv > 0) {
            const f = frames[(Math.floor(now * FIRE_FPS) + i * 5) % frames.length] as StaticSprite;
            const sc = 0.45 + 0.8 * Math.min(1, fv / 255);
            const p = iso(x, y);
            const slot = fireSlot();
            const px = Math.round(p.x - f.ax * sc);
            const py = Math.round(p.y - f.ay * sc + 4);
            slot.spr.texture = f.tex;
            slot.spr.scale.set(sc);
            slot.spr.position.set(px, py);
            slot.spr.zIndex = depthKey(x, y) + 0.3;
            if (f.glow) {
              slot.glow.texture = f.glow;
              slot.glow.scale.set(sc);
              slot.glow.position.set(px, py);
              slot.glow.zIndex = depthKey(x, y) + 0.31;
            } else slot.glow.visible = false;
          }
          const sv = smoke[i] as number;
          if (sv >= SMOKE_MIN && smokeSpr) {
            const p = iso(x, y);
            const n = sv > 150 ? 2 : 1;
            for (let k = 0; k < n; k++) {
              const s = puff();
              const ph = now * 0.7 + i * 1.7 + k * 3.1;
              const sc = 0.8 + (sv / 255) * 1.1 - k * 0.25;
              s.scale.set(sc);
              s.alpha = Math.min(0.7, 0.12 + (sv / 255) * 0.65);
              s.tint = 0xb8bec8;
              s.position.set(
                Math.round(p.x - smokeSpr.ax * sc + Math.sin(ph) * 5 + k * 6),
                Math.round(p.y - smokeSpr.ay * sc - 14 - k * 9 - ((now * 6 + i * 3) % 8)),
              );
            }
          }
        }
      }
      for (let i = nf; i < fires.length; i++) {
        const f = fires[i] as FireSlot;
        f.spr.visible = f.glow.visible = false;
      }
      for (let i = np; i < puffs.length; i++) (puffs[i] as Sprite).visible = false;
    },
    dispose() {
      for (const f of fires) {
        f.spr.destroy();
        f.glow.destroy();
      }
      for (const s of puffs) s.destroy();
      fires.length = puffs.length = 0;
    },
  };
}
