import { Sprite } from 'pixi.js';
import type { World } from '../sim/ecs';
import type { Grid } from '../sim/grid';
import { ModuleC } from '../sim/modules/components';
import type { ModuleDef } from '../sim/registry';
import { Struct } from '../sim/structure';
import { resolveArt } from './assets/fallback';
import type { Atlas } from './assets/loader';
import { depthKey, iso } from './iso';
import type { Layers } from './layers';
import { mulColor } from './lightTint';

/** Height in art px of a full-height wall: the plane the roof sits on (also used to lift overlay markers). */
export const ROOF_H = 38;
const FIRE_TINT = 0xff9a60;

export interface RoofView {
  update(): void;
  setVisible(visible: boolean): void;
  dispose(): void;
}

interface Piece {
  spr: Sprite;
  extra: Sprite | null;
  idx: number;
  tint: number;
}

/**
 * The roof of a ship (enemy ships in the main view and the combat overlay): the generic roof tile over every interior
 * tile, and the module's own roof tile (`ModuleDef.roofAsset`) above weapons, shield generators and engines so they
 * can be told apart and targeted. Rebuilt when the structure or the module layout changes; tiles on fire glow.
 */
export function createRoofView(grid: Grid, atlas: Atlas, L: Layers, world: World, defs: Readonly<Record<string, ModuleDef>>): RoofView {
  let pieces: Piece[] = [];
  let key = '';
  let visible = true;
  let fireRev = -1;

  function clear(): void {
    for (const p of pieces) {
      p.spr.destroy();
      p.extra?.destroy();
    }
    pieces = [];
  }

  function rebuild(): void {
    clear();
    const struct = grid.raw('struct');
    const w = grid.width;
    for (let i = 0; i < struct.length; i++) {
      const k = struct[i];
      if (k !== Struct.Floor && k !== Struct.Door) continue;
      const x = i % w;
      const y = (i - x) / w;
      const mod = grid.get('module', x, y);
      const roofId = mod ? defs[world.get(mod, ModuleC)?.def ?? '']?.roofAsset : undefined;
      const art = resolveArt(atlas, [roofId ?? 'roof.generic']) ?? resolveArt(atlas, ['roof.generic']);
      if (!art) continue;
      const p = iso(x, y);
      const mk = (): Sprite => {
        const s = new Sprite(art.s.tex);
        s.position.set(Math.round(p.x - art.s.ax), Math.round(p.y - art.s.ay - art.lift));
        s.visible = visible;
        L.sorted.addChild(s);
        return s;
      };
      const spr = mk();
      spr.tint = art.tint;
      spr.zIndex = depthKey(x, y) + 0.9;
      let extra: Sprite | null = null;
      if (art.add !== undefined) {
        extra = mk();
        extra.blendMode = 'add';
        extra.tint = art.add;
        extra.zIndex = depthKey(x, y) + 0.91;
      }
      pieces.push({ spr, extra, idx: i, tint: art.tint });
    }
    fireRev = -1;
  }

  return {
    update() {
      const k = `${grid.revision('struct')}|${grid.revision('module')}`;
      if (k !== key) {
        key = k;
        rebuild();
      }
      const fr = grid.revision('fire');
      if (fr === fireRev) return;
      fireRev = fr;
      const fire = grid.raw('fire');
      for (const p of pieces) p.spr.tint = (fire[p.idx] as number) > 0 ? mulColor(p.tint, FIRE_TINT) : p.tint;
    },
    setVisible(v) {
      visible = v;
      for (const p of pieces) p.spr.visible = p.extra ? (p.extra.visible = v) : v;
    },
    dispose: clear,
  };
}
