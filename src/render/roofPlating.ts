import { Sprite, type Container } from 'pixi.js';
import { resolveArt } from './assets/fallback';
import type { Atlas, StaticSprite } from './assets/loader';
import { depthKey, iso } from './iso';
import type { Layers } from './layers';
import { createLiveryMesh } from './livery';
import type { KindAt } from './tiles';
import { cutHides, cutSuffix, liveryPlan, motifColours, roofCovers, roofCut, roofGradient, roofTile, type RoofCut } from './roofArt';

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
  /** Bow motifs (chevrons, registry block) at the -x end instead of +x. */
  bowWest?: boolean;
}

const SIDES = [['n', 0, -1], ['w', -1, 0], ['s', 0, 1], ['e', 1, 0]] as const;
const grey = (k: number): number => {
  const v = Math.max(0, Math.min(255, Math.round(255 * k)));
  return (v << 16) | (v << 8) | v;
};

/** The plating's shading tint at tile (x, y) of a W x H region (the battle damage over it takes the same). */
export const roofTint = (x: number, y: number, W: number, H: number): number => grey(roofGradient(x, y, W, H));

/** True when the manifest has the production roof plating (the roof family). */
export const hasRoofArt = (atlas: Atlas): boolean => !!atlas.stat('roof.c0b.00');

/** The plating's base sprite of roof tile (x, y) (its module-rule plate, cut where the hull is), with its colour family. */
export function roofBase(atlas: Atlas, kindAt: KindAt, x: number, y: number): { base: StaticSprite; col: 'o' | 'b'; cut: RoofCut } | undefined {
  const { id, col } = roofTile(x, y);
  const cut = roofCut(kindAt, x, y);
  const sfx = cutSuffix(cut);
  const plain = id.replace(/\.(inset|patch)$/, '');
  const base = atlas.stat(id + sfx) ?? atlas.stat(plain + sfx) ?? atlas.stat(id) ?? atlas.stat(plain);
  return base && { base, col, cut };
}

/** Livery masks per roof tile (`x,y` -> masks); empty without the roof family or a livery. */
export type RoofPlan = ReadonlyMap<string, readonly { mask: string; motif: string }[]>;

/**
 * The livery plan of a whole region: motifs are laid out over the ship's full plates, so it is computed once per region
 * (per struct revision) and each chunk view takes its tiles' share of it.
 */
export function roofPlan(kindAt: KindAt, W: number, H: number, atlas: Atlas, livery: Livery | null): RoofPlan {
  const real = hasRoofArt(atlas);
  // Livery paints the full plates only (a mask would overhang a cut plate).
  return real && livery ? liveryPlan(W, H, (x, y) => roofCovers(kindAt, x, y) && !roofCut(kindAt, x, y), livery.scheme, livery.seed, (m) => !!atlas.stat(`roof.lv.${m}`), !!livery.bowWest) : new Map();
}

/** Tiles of a rectangle, [x0, x1) x [y0, y1) in region-local tiles. */
export interface TileRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * The roof plating over every roofed tile of `rect` (`roofCovers`; `skip` drops tiles under stand-in roof parts) of a
 * W x H region whose tiles `kindAt` reads (Space outside it): the module-rule base sprite (roofArt.roofTile), the ship's
 * livery masks (`plan`) recoloured by the livery shader, and an edge overlay on each open side, at roof depth
 * (+0.9 .. +0.91). Without the roof family it falls back to the stand-in plate.
 */
export function buildRoofPlating(kindAt: KindAt, W: number, H: number, atlas: Atlas, L: Layers, livery: Livery | null, plan: RoofPlan, skip: (x: number, y: number) => boolean, rect: TileRect = { x0: 0, y0: 0, x1: W, y1: H }): RoofPiece[] {
  const roofed = (x: number, y: number): boolean => roofCovers(kindAt, x, y);
  const real = hasRoofArt(atlas);
  const out: RoofPiece[] = [];
  const place = <T extends Container>(o: T, z: number): T => {
    o.zIndex = z;
    L.sorted.addChild(o);
    return o;
  };
  for (let y = Math.max(0, rect.y0); y < Math.min(H, rect.y1); y++)
    for (let x = Math.max(0, rect.x0); x < Math.min(W, rect.x1); x++) {
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
      const found = roofBase(atlas, kindAt, x, y);
      if (!found) continue;
      const { base, col, cut } = found;
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
        if (roofed(x + dx, y + dy) || cutHides(cut, side)) continue;
        // An open N / W girder on a cut tile is clipped at the cut like the plate.
        const clip = cut === '' || cut === 'c' ? '' : (side === 'n' && cut.endsWith('e')) || (side === 'w' && cut.endsWith('s')) ? '.cut' : '';
        const e = atlas.stat(`roof.edge.${side}.${col}${clip}`) ?? atlas.stat(`roof.edge.${side}.${col}`);
        if (e) objs.push(sprite(e, 0.908));
      }
      out.push({ objs, tinted: objs, idx, tint: roofTint(x, y, W, H) });
    }
  return out;
}
