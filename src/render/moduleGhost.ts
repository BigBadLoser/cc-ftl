import { Container, Graphics, Sprite } from 'pixi.js';
import { accessTile, rotatedSize } from '../sim/modules/footprint';
import type { ModuleDef } from '../sim/registry';
import { iso, TILE_H, TILE_W } from './iso';
import type { ModuleThumbs } from './moduleThumb';

/** What the player is about to place: a module def at its top-left tile and rotation. */
export interface ModuleGhostSpec {
  def: string;
  x: number;
  y: number;
  rot: number;
  valid: boolean;
}

export interface ModuleGhost {
  set(g: ModuleGhostSpec | null): void;
}

const GHOST_ALPHA = 0.55;
const BAD_TINT = 0xff5a5a;
const AMBER = 0xf0b13a;
const DASH = 10;

/** A dashed diamond outline (debug/overlay drawing: the access tile marker), centred on the origin. */
function dashedDiamond(): Graphics {
  const g = new Graphics();
  const pts: [number, number][] = [[0, -TILE_H / 2], [TILE_W / 2, 0], [0, TILE_H / 2], [-TILE_W / 2, 0]];
  for (let i = 0; i < 4; i++) {
    const [ax, ay] = pts[i] as [number, number];
    const [bx, by] = pts[(i + 1) % 4] as [number, number];
    const len = Math.hypot(bx - ax, by - ay);
    for (let d = 0; d < len; d += DASH * 2) {
      const t0 = d / len;
      const t1 = Math.min(len, d + DASH) / len;
      g.moveTo(ax + (bx - ax) * t0, ay + (by - ay) * t0).lineTo(ax + (bx - ax) * t1, ay + (by - ay) * t1);
    }
  }
  g.stroke({ width: 3, color: AMBER, alpha: 0.95 });
  return g;
}

/**
 * The placement ghost: the module's real art (the build catalog's rendered layers, rotation included) at the cursor, see-through,
 * tinted red when it cannot go there, plus the access tile as a dashed amber diamond.
 */
export function createModuleGhost(parent: Container, thumbs: ModuleThumbs, defs: Readonly<Record<string, ModuleDef>>): ModuleGhost {
  const root = new Container();
  root.visible = false;
  const spr = new Sprite();
  spr.alpha = GHOST_ALPHA;
  const access = dashedDiamond();
  root.addChild(spr, access);
  parent.addChild(root);
  return {
    set(g) {
      const def = g && defs[g.def];
      const art = g && def ? thumbs.texture(g.def, g.rot) : null;
      root.visible = !!g && !!def;
      if (!g || !def) return;
      const [w, h] = rotatedSize(def, g.rot);
      spr.visible = !!art;
      if (art) {
        const p = iso(g.x + w - 1, g.y + h - 1);
        spr.texture = art.tex;
        spr.position.set(Math.round(p.x - art.ax), Math.round(p.y - art.ay));
        spr.tint = g.valid ? 0xffffff : BAD_TINT;
      }
      const a = accessTile(def, g.x, g.y, g.rot);
      access.visible = !!a;
      if (a) {
        const p = iso(a.x, a.y);
        access.position.set(p.x, p.y);
      }
    },
  };
}
