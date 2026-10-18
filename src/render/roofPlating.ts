import { Sprite, type Container } from 'pixi.js';
import type { Grid } from '../sim/grid';
import { Struct } from '../sim/structure';
import { resolveArt } from './assets/fallback';
import type { Atlas } from './assets/loader';
import { depthKey, iso } from './iso';
import type { Layers } from './layers';
import { createLiveryMesh } from './livery';
import { liveryPlan, motifColours, roofGradient, roofTile } from './roofArt';

/** One roof tile's display objects (base, livery, edges), tinted together. */
export interface RoofPiece {
  objs: Container[];
  /** The objects the light and fire tint applies to (not a stand-in's additive pass). */
  tinted: Container[];
  idx: number;
  /** Base multiply tint (the ship-wide gradient, or a stand-in's tint). */
  tint: number;
}

export interface Livery {
  scheme: string;
  seed: number;
}

const SIDES = [['n', 0, -1], ['w', -1, 0], ['s', 0, 1], ['e', 1, 0]] as const;
const grey = (k: number): number => {
  const v = Math.max(0, Math.min(255, Math.round(255 * k)));
  return (v << 16) | (v << 8) | v;
};

/** True when the manifest has the production roof plating (the roof family). */
export const hasRoofArt = (atlas: Atlas): boolean => !!atlas.stat('roof.c0b.00');

/**
 * The roof plating over every roofed tile (floor and door tiles; `skip` drops tiles under stand-in roof parts):
 * the module-rule base sprite (roofArt.roofTile), the ship's livery masks recoloured by the livery shader, and an edge
 * overlay on each open side, at roof depth (+0.9 .. +0.91). Without the roof family it falls back to the stand-in plate.
 */
export function buildRoofPlating(grid: Grid, atlas: Atlas, L: Layers, livery: Livery | null, skip: (x: number, y: number) => boolean): RoofPiece[] {
  const struct = grid.raw('struct');
  const { width: W, height: H } = grid;
  const roofed = (x: number, y: number): boolean => {
    if (x < 0 || y < 0 || x >= W || y >= H) return false;
    const k = struct[y * W + x];
    return k === Struct.Floor || k === Struct.Door;
  };
  const real = hasRoofArt(atlas);
  const plan = real && livery ? liveryPlan(W, H, roofed, livery.scheme, livery.seed, (m) => !!atlas.stat(`roof.lv.${m}`)) : new Map();
  const out: RoofPiece[] = [];
  const place = <T extends Container>(o: T, z: number): T => {
    o.zIndex = z;
    L.sorted.addChild(o);
    return o;
  };
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!roofed(x, y) || skip(x, y)) continue;
      const p = iso(x, y);
      const z = depthKey(x, y);
      const idx = y * W + x;
      if (!real) {
        const art = resolveArt(atlas, ['roof.generic']);
        if (!art) continue;
        const mk = (): Sprite => {
          const s = new Sprite(art.s.tex);
          s.position.set(Math.round(p.x - art.s.ax), Math.round(p.y - art.s.ay - art.lift));
          return s;
        };
        const objs: Container[] = [place(mk(), z + 0.9)];
        const tinted = [...objs];
        if (art.add !== undefined) {
          const extra = place(mk(), z + 0.91);
          extra.blendMode = 'add';
          extra.tint = art.add;
          objs.push(extra);
        }
        out.push({ objs, tinted, idx, tint: art.tint });
        continue;
      }
      const { id, col } = roofTile(x, y);
      const base = atlas.stat(id) ?? atlas.stat(id.replace(/\.(inset|patch)$/, ''));
      if (!base) continue;
      const sprite = (s: typeof base, dz: number): Sprite => {
        const o = new Sprite(s.tex);
        o.position.set(Math.round(p.x - s.ax), Math.round(p.y - s.ay));
        return place(o, z + dz);
      };
      const objs: Container[] = [sprite(base, 0.9)];
      (plan.get(`${x},${y}`) ?? []).forEach((q: { mask: string; motif: string }, k: number) => {
        const mask = atlas.stat(`roof.lv.${q.mask}`);
        if (!mask || !livery) return;
        const [P, S] = motifColours(livery.scheme, q.motif);
        objs.push(place(createLiveryMesh(mask, base, col, P, S, p.x, p.y), z + 0.902 + k * 0.0005));
      });
      for (const [side, dx, dy] of SIDES) {
        if (roofed(x + dx, y + dy)) continue;
        const e = atlas.stat(`roof.edge.${side}.${col}`);
        if (e) objs.push(sprite(e, 0.908));
      }
      out.push({ objs, tinted: objs, idx, tint: grey(roofGradient(x, y, W, H)) });
    }
  return out;
}
