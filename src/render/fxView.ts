import { Sprite } from 'pixi.js';
import { animNow } from './animClock';
import type { Grid } from '../sim/grid';
import { Struct } from '../sim/structure';
import type { Atlas, StaticSprite } from './assets/loader';
import { ART_SCALE, depthKey, iso } from './iso';
import { regionTiles } from './regionTiles';
import type { Layers } from './layers';

export interface FxViewHost {
  target(): { grid: Grid } | null;
}

export interface FxView {
  update(): void;
  dispose(): void;
}

const FIRE_FPS = 9;

interface FireSlot {
  spr: Sprite;
  glow: Sprite;
}

/** Fire flames: looping sprite frames plus glow, scaled by intensity. (Smoke, embers and sparks are particles, see fx/.) */
export function createFxView(atlas: Atlas, L: Layers, host: FxViewHost): FxView {
  const frames: StaticSprite[] = [];
  for (const id of atlas.ids('fx.fire.')) {
    const s = atlas.stat(id);
    if (s) frames.push(s);
  }
  const fires: FireSlot[] = [];
  let nf = 0;

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
  return {
    update() {
      nf = 0;
      const t = host.target();
      const now = animNow() / 1000;
      if (t && frames.length) {
        const tiles = regionTiles(t.grid);
        tiles.scan((x, y, i, ci, c) => {
          const kind = tiles.data('struct', c)?.[ci];
          if (kind !== Struct.Floor && kind !== Struct.Door) return;
          const fv = (tiles.data('fire', c)?.[ci] ?? 0) as number;
          if (fv > 0) {
            const f = frames[(Math.floor(now * FIRE_FPS) + i * 5) % frames.length] as StaticSprite;
            const sc = 0.45 + 0.8 * Math.min(1, fv / 255);
            const p = iso(x, y);
            const slot = fireSlot();
            const px = Math.round(p.x - f.ax * sc);
            const py = Math.round(p.y - f.ay * sc + 4 * ART_SCALE);
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
        });
      }
      for (let i = nf; i < fires.length; i++) {
        const f = fires[i] as FireSlot;
        f.spr.visible = f.glow.visible = false;
      }
    },
    dispose() {
      for (const f of fires) {
        f.spr.destroy();
        f.glow.destroy();
      }
      fires.length = 0;
    },
  };
}
