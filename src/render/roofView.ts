import { Sprite, type Filter } from 'pixi.js';
import type { World } from '../sim/ecs';
import type { Grid } from '../sim/grid';
import { ModuleC } from '../sim/modules/components';
import { footprintTiles, rotatedSize } from '../sim/modules/footprint';
import type { ModuleDef } from '../sim/registry';
import { Struct } from '../sim/structure';
import { resolveArt } from './assets/fallback';
import type { Atlas } from './assets/loader';
import { depthKey, iso } from './iso';
import type { Layers } from './layers';
import { createGhostFilter, setGhostZoom } from './ghost';
import { ROOF_H } from './heights';
import { mulColor } from './lightTint';

export { ROOF_H };
const FIRE_TINT = 0xff9a60;

/** Roof part ids with a stand-in for their `.active` variant (the others fall back to the plain id). */
const FALLBACK_ACTIVE = new Set(['roof.ai_core']);

export interface RoofView {
  update(): void;
  setVisible(visible: boolean): void;
  dispose(): void;
}

/** A roof part (shield generator, AI core): one sprite per footprint tile for stand-ins, else one at the front tile. */
interface PartSprite {
  spr: Sprite;
  ghost: Filter;
}

interface Piece {
  spr: Sprite;
  extra: Sprite | null;
  idx: number;
  tint: number;
}

/**
 * The roof of a ship (enemy ships in the main view and the combat overlay): the generic roof tile over every interior
 * tile, with the roof parts of shield generators and the AI core (`ModuleDef.roofAsset`, `.active` while powered) in
 * place of the tiles above them, so they can be told apart and targeted. Roof parts sit on the roof plane (`ROOF_H`).
 * On a cutaway ship (not roofed) the generic roof is hidden and the parts stay as ghosts (faint, with a light outline).
 * Rebuilt when the structure or the module layout changes; tiles on fire glow.
 */
export function createRoofView(grid: Grid, atlas: Atlas, L: Layers, world: World, defs: Readonly<Record<string, ModuleDef>>): RoofView {
  let pieces: Piece[] = [];
  let key = '';
  let visible = true;
  let fireRev = -1;
  let partKey = '';
  let partSprites: PartSprite[] = [];

  function clearParts(): void {
    for (const p of partSprites) p.spr.destroy();
    partSprites = [];
  }

  /** Roof parts of the powered/unpowered modules, rebuilt only when the module set or a power state changes. */
  function rebuildParts(): void {
    clearParts();
    for (const id of world.query(ModuleC)) {
      const m = world.get(id, ModuleC);
      const def = m && defs[m.def];
      if (!m || !def?.roofAsset || m.gridId !== grid.id) continue;
      const on = m.powered && m.enabled && m.hp > 0;
      const chain = on ? [`${def.roofAsset}.active`, def.roofAsset] : [def.roofAsset];
      const art = resolveArt(atlas, chain, on && FALLBACK_ACTIVE.has(def.roofAsset) ? chain[0] : def.roofAsset);
      if (!art) continue;
      const [w, h] = rotatedSize(def, m.rot);
      const spots = art.fallback && art.perTile ? footprintTiles(def, m.x, m.y, m.rot) : [{ x: m.x + w - 1, y: m.y + h - 1 }];
      for (const t of spots) {
        const p = iso(t.x, t.y);
        const spr = new Sprite(art.s.tex);
        spr.position.set(Math.round(p.x - art.s.ax), Math.round(p.y - art.s.ay - (art.fallback ? art.lift || ROOF_H : ROOF_H)));
        spr.tint = art.tint;
        spr.zIndex = depthKey(t.x, t.y) + 0.92;
        const ghost = createGhostFilter();
        spr.filters = visible ? [] : [ghost];
        L.sorted.addChild(spr);
        partSprites.push({ spr, ghost });
      }
    }
  }

  function clear(): void {
    clearParts();
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
      if (mod && defs[world.get(mod, ModuleC)?.def ?? '']?.roofAsset) continue;
      const art = resolveArt(atlas, ['roof.generic']);
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
      let pk = '';
      for (const id of world.query(ModuleC)) {
        const m = world.get(id, ModuleC);
        if (m && m.gridId === grid.id && defs[m.def]?.roofAsset) pk += `${id}:${m.x},${m.y},${m.rot}:${m.powered && m.enabled && m.hp > 0 ? 1 : 0};`;
      }
      if (pk !== partKey) {
        partKey = pk;
        rebuildParts();
      }
      for (const p of partSprites) setGhostZoom(p.ghost, L.scale);
      const fr = grid.revision('fire');
      if (fr === fireRev) return;
      fireRev = fr;
      const fire = grid.raw('fire');
      for (const p of pieces) p.spr.tint = (fire[p.idx] as number) > 0 ? mulColor(p.tint, FIRE_TINT) : p.tint;
    },
    setVisible(v) {
      visible = v;
      for (const p of partSprites) p.spr.filters = v ? [] : [p.ghost];
      for (const p of pieces) p.spr.visible = p.extra ? (p.extra.visible = v) : v;
    },
    dispose: clear,
  };
}
