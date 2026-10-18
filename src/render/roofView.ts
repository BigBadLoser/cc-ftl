import { Sprite, type Filter } from 'pixi.js';
import type { World } from '../sim/ecs';
import type { Grid } from '../sim/grid';
import { ModuleC } from '../sim/modules/components';
import { footprintTiles, hullRow, hullSide, rotatedSize } from '../sim/modules/footprint';
import type { ModuleDef } from '../sim/registry';
import { buildRoofPlating, hasRoofArt, type Livery, type RoofPiece } from './roofPlating';
import { resolveArt } from './assets/fallback';
import type { Atlas } from './assets/loader';
import { DEPLOY_FRAMES, RISE_PX, deployId, deployStage } from './deployArt';
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


/**
 * The roof of a ship (enemy ships in the main view and the combat overlay): the plating (roofPlating: module rule,
 * livery, edges) over every interior tile, with the roof parts of shield generators and the AI core
 * (`ModuleDef.roofAsset`, `.active` while powered, deploy frames) on top, so they can be told apart and targeted.
 * On a cutaway ship (not roofed) the generic roof is hidden and the parts stay as ghosts (faint, with a light outline).
 * Rebuilt when the structure or the module layout changes; tiles on fire glow.
 */
export function createRoofView(grid: Grid, atlas: Atlas, L: Layers, world: World, defs: Readonly<Record<string, ModuleDef>>, livery: Livery | null = null): RoofView {
  let pieces: RoofPiece[] = [];
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
      const stage = def.deploySec === undefined ? DEPLOY_FRAMES : deployStage(world, id);
      if (stage < 0 && !visible) continue; // stowed on the player's cutaway ship: nothing, no ghost
      const out = stage >= DEPLOY_FRAMES;
      // A non-square part has its own art for odd rotations (`<id>.r1.*`, anchored like the rotated module).
      const bases = def.footprint[0] !== def.footprint[1] && m.rot % 2 === 1 ? [`${def.roofAsset}.r1`, def.roofAsset] : [def.roofAsset];
      const chain = bases.flatMap((b) => (!out ? [deployId(b, stage)] : on ? [`${b}.active`, b] : [b]));
      const key = !out ? deployId(def.roofAsset, stage) : on && FALLBACK_ACTIVE.has(def.roofAsset) ? `${def.roofAsset}.active` : def.roofAsset;
      const art = resolveArt(atlas, chain, key);
      if (!art) continue;
      const [w, h] = rotatedSize(def, m.rot);
      const spots = art.fallback && art.perTile ? footprintTiles(def, m.x, m.y, m.rot) : [{ x: m.x + w - 1, y: m.y + h - 1 }];
      for (const t of spots) {
        const p = iso(t.x, t.y);
        const spr = new Sprite(art.s.tex);
        // Real roof parts are modelled on the roof plane (anchored at floor level); stand-ins are lifted to it.
        spr.position.set(Math.round(p.x - art.s.ax), Math.round(p.y - art.s.ay - (art.fallback ? art.lift || ROOF_H : 0) + (1 - art.rise) * RISE_PX));
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
    for (const p of pieces) for (const o of p.objs) o.destroy();
    pieces = [];
  }

  /** Tile indices of engine hull rows and the side they face (the roof slab ends at their bulkheads' outer face). */
  function engineHullTiles(): Map<number, 'n' | 'e' | 's' | 'w'> {
    const out = new Map<number, 'n' | 'e' | 's' | 'w'>();
    for (const id of world.query(ModuleC)) {
      const m = world.get(id, ModuleC);
      const def = m && defs[m.def];
      const side = m && def ? hullSide(def, m.rot) : null;
      if (m && def && side && m.gridId === grid.id) for (const t of hullRow(def, m.x, m.y, m.rot)) out.set(t.y * grid.width + t.x, side);
    }
    return out;
  }

  function rebuild(): void {
    clear();
    // Stand-in roof parts replace the plates above their module; real parts sit on the plating.
    const real = hasRoofArt(atlas);
    pieces = buildRoofPlating(grid, atlas, L, livery, (x, y) => {
      if (real) return false;
      const mod = grid.get('module', x, y);
      return !!(mod && defs[world.get(mod, ModuleC)?.def ?? '']?.roofAsset);
    }, engineHullTiles());
    for (const p of pieces) for (const o of p.objs) o.visible = visible;
    for (const p of pieces) for (const o of p.tinted) (o as Sprite).tint = p.tint;
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
        if (m && m.gridId === grid.id && defs[m.def]?.roofAsset) pk += `${id}:${m.x},${m.y},${m.rot}:${m.powered && m.enabled && m.hp > 0 ? 1 : 0}:${defs[m.def]?.deploySec === undefined ? '' : deployStage(world, id)};`;
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
      for (const p of pieces) for (const o of p.tinted) (o as Sprite).tint = (fire[p.idx] as number) > 0 ? mulColor(p.tint, FIRE_TINT) : p.tint;
    },
    setVisible(v) {
      visible = v;
      partKey = ''; // stowed parts appear on roofed ships only: rebuild
      for (const p of partSprites) p.spr.filters = v ? [] : [p.ghost];
      for (const p of pieces) for (const o of p.objs) o.visible = v;
    },
    dispose: clear,
  };
}
