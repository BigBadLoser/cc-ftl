import { Sprite, type Filter } from 'pixi.js';
import type { World } from '../sim/ecs';
import { CHUNK_SIZE, type Grid } from '../sim/grid';
import { ModuleC } from '../sim/modules/components';
import { footprintTiles, rotatedSize } from '../sim/modules/footprint';
import type { ModuleDef } from '../sim/registry';
import { buildRoofPlating, hasRoofArt, roofPlan, type Livery, type RoofPiece, type RoofPlan } from './roofPlating';
import { createChunkViews, regionTiles, type ChunkRef } from './regionTiles';
import { resolveArt } from './assets/fallback';
import type { Atlas } from './assets/loader';
import { DEPLOY_FRAMES, RISE_PX, deployId, deployStage } from './deployArt';
import { depthKey, iso } from './iso';
import type { Layers } from './layers';
import { createGhostFilter, setGhostZoom } from './ghost';
import { ROOF_H } from './heights';
import { mulColor } from './lightTint';
import { DAMAGED_BELOW } from './moduleArt';

export { ROOF_H };
const FIRE_TINT = 0xff9a60;

/** Roof part ids with a stand-in for their `.active` variant (the others fall back to the plain id). */
const FALLBACK_ACTIVE = new Set(['roof.ai_core']);

/** Roof damage suffixes to try first for a part (`destroyed` at 0 hp; `damaged` / `damaged.flicker` once deployed under half hp). */
export function roofWear(hp: number, maxHp: number, out: boolean, on: boolean): string[] {
  if (hp <= 0) return ['destroyed'];
  if (out && hp < maxHp * DAMAGED_BELOW) return on ? ['damaged'] : ['damaged.flicker', 'damaged'];
  return [];
}

export interface RoofView {
  update(): void;
  setVisible(visible: boolean): void;
  dispose(): void;
}

/** The roof plating of one sector chunk of the region. */
interface RoofChunk {
  c: ChunkRef;
  pieces: RoofPiece[];
  fireKey: number;
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
 * The plating is one view per sector chunk (step 5b), rebuilt when the chunk's struct block, its module tiles or its
 * share of the livery plan change; tiles on fire glow.
 */
export function createRoofView(grid: Grid, atlas: Atlas, L: Layers, world: World, defs: Readonly<Record<string, ModuleDef>>, livery: Livery | null = null): RoofView {
  const tiles = regionTiles(grid);
  const { width: W, height: H } = tiles;
  const chunks = createChunkViews<RoofChunk>((v) => clearChunk(v));
  let plan: RoofPlan = new Map();
  /** The plan's share per chunk (`cx,cy` -> its masks), compared in the chunk keys. */
  let planKeys = new Map<string, string>();
  let planRev = -1;
  /** Region-wide gates for the per-chunk keys (struct and module, fire). */
  let key = '';
  let fireRev = -1;
  let visible = true;
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
      if (!m || !def?.roofAsset || !grid.inBounds(m.x, m.y)) continue;
      const on = m.powered && m.enabled && m.hp > 0;
      const stage = def.deploySec === undefined ? DEPLOY_FRAMES : deployStage(world, id);
      if (stage < 0 && !visible) continue; // stowed on the player's cutaway ship: nothing, no ghost
      const out = stage >= DEPLOY_FRAMES;
      // A non-square part has its own art for odd rotations (`<id>.r1.*`, anchored like the rotated module).
      const bases = def.footprint[0] !== def.footprint[1] && m.rot % 2 === 1 ? [`${def.roofAsset}.r1`, def.roofAsset] : [def.roofAsset];
      // A wreck (0 hp) shows its jammed `.destroyed` roof at any stage; a deployed part under half hp its `.damaged` fault
      // (dark `.damaged.flicker` while unpowered, like the body). Each only if the art has it: the chain falls through.
      const wear = roofWear(m.hp, def.maxHp, out, on);
      const chain = bases.flatMap((b) => [...wear.map((w) => `${b}.${w}`), ...(!out ? [deployId(b, stage)] : on ? [`${b}.active`, b] : [b])]);
      const key = !out ? deployId(def.roofAsset, stage) : on && FALLBACK_ACTIVE.has(def.roofAsset) ? `${def.roofAsset}.active` : def.roofAsset;
      const art = resolveArt(atlas, chain, key);
      if (!art) continue;
      const [w, h] = rotatedSize(def, m.rot);
      // Modules are in sector tiles; roof parts are placed region-local like the plating.
      const lx = m.x - grid.x0, ly = m.y - grid.y0;
      const spots = art.fallback && art.perTile ? footprintTiles(def, lx, ly, m.rot) : [{ x: lx + w - 1, y: ly + h - 1 }];
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

  function clearChunk(v: RoofChunk): void {
    for (const p of v.pieces) for (const o of p.objs) o.destroy();
    v.pieces = [];
  }

  function clear(): void {
    clearParts();
    chunks.clear();
  }

  function replan(): void {
    const r = grid.revision('struct');
    if (r === planRev) return;
    planRev = r;
    plan = roofPlan(tiles.kindAt, W, H, atlas, livery);
    planKeys = new Map();
    for (const [k, masks] of plan) {
      const [x, y] = k.split(',').map(Number) as [number, number];
      const ck = `${Math.floor((tiles.ox + x) / CHUNK_SIZE)},${Math.floor((tiles.oy + y) / CHUNK_SIZE)}`;
      planKeys.set(ck, `${planKeys.get(ck) ?? ''}${k}:${masks.map((m) => `${m.mask}/${m.motif}`).join('+')};`);
    }
  }

  function buildChunk(c: ChunkRef, old: RoofChunk | undefined): RoofChunk {
    const v = old ?? { c, pieces: [], fireKey: -1 };
    clearChunk(v);
    v.fireKey = -1;
    // Stand-in roof parts replace the plates above their module; real parts sit on the plating.
    const real = hasRoofArt(atlas);
    v.pieces = buildRoofPlating(tiles.kindAt, W, H, atlas, L, livery, plan, (x, y) => {
      if (real) return false;
      const mod = tiles.get('module', x, y); // local tile
      return !!(mod && defs[world.get(mod, ModuleC)?.def ?? '']?.roofAsset);
    }, tiles.chunkRect(c));
    for (const p of v.pieces) for (const o of p.objs) o.visible = visible;
    return v;
  }

  function updateFire(v: RoofChunk): void {
    const fr = tiles.rev('fire', v.c);
    if (fr === v.fireKey) return;
    v.fireKey = fr;
    for (const p of v.pieces) {
      const x = p.idx % W;
      const lit = tiles.get('fire', x, (p.idx - x) / W) > 0;
      for (const o of p.tinted) (o as Sprite).tint = lit ? mulColor(p.tint, FIRE_TINT) : p.tint;
    }
  }

  return {
    update() {
      const k = `${grid.revision('struct')}|${grid.revision('module')}`;
      if (k !== key) {
        key = k;
        replan();
        chunks.sync(tiles.chunks(), (c) => `${tiles.key('struct', c)}|${tiles.rev('module', c)}|${planKeys.get(`${c.cx},${c.cy}`) ?? ''}`, buildChunk);
        fireRev = -1;
      }
      let pk = '';
      for (const id of world.query(ModuleC)) {
        const m = world.get(id, ModuleC);
        if (m && grid.inBounds(m.x, m.y) && defs[m.def]?.roofAsset) pk += `${id}:${m.x},${m.y},${m.rot}:${m.powered && m.enabled && m.hp > 0 ? 1 : 0}:${defs[m.def]?.deploySec === undefined ? '' : deployStage(world, id)}:${roofWear(m.hp, defs[m.def]!.maxHp, true, true).join('+')};`;
      }
      if (pk !== partKey) {
        partKey = pk;
        rebuildParts();
      }
      for (const p of partSprites) setGhostZoom(p.ghost, L.scale);
      const fr = grid.revision('fire');
      if (fr !== fireRev) {
        fireRev = fr;
        for (const v of chunks.views()) updateFire(v);
      }
    },
    setVisible(v) {
      visible = v;
      partKey = ''; // stowed parts appear on roofed ships only: rebuild
      for (const p of partSprites) p.spr.filters = v ? [] : [p.ghost];
      for (const c of chunks.views()) for (const p of c.pieces) for (const o of p.objs) o.visible = v;
    },
    dispose: clear,
  };
}
