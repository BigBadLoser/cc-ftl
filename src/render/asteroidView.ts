import { Graphics, type Container } from 'pixi.js';
import { AsteroidC, type Asteroid } from '../sim/asteroids/components';
import type { World } from '../sim/ecs';
import { CHUNK_SIZE } from '../sim/grid';
import type { SectorGrid } from '../sim/sectorGrid';
import { Struct } from '../sim/structure';
import { Z_PX } from './heights';
import { iso, TILE_H, TILE_W } from './iso';

/**
 * PLACEHOLDER asteroid drawing (procedural, allowed while asteroid art is pending; final art comes from the sprite pipeline).
 * Rock mass is a full-height block (ROCK_MASS_Z tiles of height) with a lit top and two shaded faces where it meets lower
 * tiles; rock ground is a flat, paler diamond with a few crater pits picked by a tile hash. Ore tints the top of either form.
 * Every size derives from TILE_W / TILE_H and Z_PX. One Graphics per asteroid, rebuilt when its chunks' struct or ore
 * revisions change.
 */
export interface AsteroidView {
  update(sector: SectorGrid | null): void;
  dispose(): void;
}

const MASS = 0x5c5854;
const GROUND = 0x968a76;
/** Height of a rock-mass block in tiles of height (taller than a crew member, lower than a wall). */
export const ROCK_MASS_Z = 1.2;
/** Ground slab edge, as a fraction of the tile height (where ground meets space). */
const GROUND_RIM = 0.25;

const tileHash = (x: number, y: number): number => {
  let h = Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
};

function shade(c: number, f: number): number {
  const ch = (s: number) => Math.min(255, Math.round(((c >> s) & 255) * f));
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

/** Sum of the struct and ore chunk revisions under the asteroid's bbox: a change detector (revisions only grow). */
function revision(sector: SectorGrid, a: Asteroid): number {
  let rev = 0;
  for (let cy = Math.floor(a.y / CHUNK_SIZE); cy <= Math.floor((a.y + a.height - 1) / CHUNK_SIZE); cy++) {
    for (let cx = Math.floor(a.x / CHUNK_SIZE); cx <= Math.floor((a.x + a.width - 1) / CHUNK_SIZE); cx++) {
      rev += sector.chunkRevision('struct', cx, cy) + sector.chunkRevision('ore', cx, cy);
    }
  }
  return rev;
}

function draw(g: Graphics, sector: SectorGrid, a: Asteroid, oreColor: (code: number) => number): void {
  g.clear();
  const hw = TILE_W / 2, hh = TILE_H / 2;
  const tall = ROCK_MASS_Z * Z_PX, rim = TILE_H * GROUND_RIM;
  const kind = (x: number, y: number) => sector.get('struct', x, y);
  const mass = (x: number, y: number) => kind(x, y) === Struct.Rock;
  const solidBelow = (x: number, y: number) => kind(x, y) === Struct.Rock || kind(x, y) === Struct.Ground;
  // back to front (x + y ascending), so a nearer block covers the one behind it
  for (let d = 0; d <= a.width + a.height - 2; d++) {
    for (let lx = Math.max(0, d - a.height + 1); lx <= Math.min(a.width - 1, d); lx++) {
      const x = a.x + lx, y = a.y + d - lx;
      const k = kind(x, y);
      if (k !== Struct.Rock && k !== Struct.Ground) continue;
      const ore = sector.get('ore', x, y);
      const c = iso(x, y);
      if (k === Struct.Ground) {
        const base = ore ? mix(oreColor(ore), GROUND, 0.5) : GROUND;
        if (!solidBelow(x, y + 1)) g.poly([c.x - hw, c.y, c.x, c.y + hh, c.x, c.y + hh + rim, c.x - hw, c.y + rim]).fill(shade(GROUND, 0.6));
        if (!solidBelow(x + 1, y)) g.poly([c.x, c.y + hh, c.x + hw, c.y, c.x + hw, c.y + rim, c.x, c.y + hh + rim]).fill(shade(GROUND, 0.45));
        g.poly([c.x, c.y - hh, c.x + hw, c.y, c.x, c.y + hh, c.x - hw, c.y]).fill(base);
        const r = tileHash(x, y);
        if (r < 0.18) {
          // a small crater pit: dark bowl with a lit far lip
          const px = c.x + (tileHash(y, x) - 0.5) * hw * 0.6, py = c.y + (r * 5 - 0.5) * hh * 0.5;
          g.ellipse(px, py, hw * 0.28, hh * 0.28).fill(shade(GROUND, 0.7));
          g.ellipse(px, py + hh * 0.04, hw * 0.2, hh * 0.18).fill(shade(GROUND, 0.55));
        }
        continue;
      }
      const base = ore ? oreColor(ore) : MASS;
      const top = c.y - tall;
      if (!mass(x, y + 1)) g.poly([c.x - hw, top, c.x, top + hh, c.x, c.y + hh, c.x - hw, c.y]).fill(shade(MASS, 0.7));
      if (!mass(x + 1, y)) g.poly([c.x, top + hh, c.x + hw, top, c.x + hw, c.y, c.x, c.y + hh]).fill(shade(MASS, 0.5));
      const lit = !mass(x - 1, y) || !mass(x, y - 1) ? 1.25 : 1;
      g.poly([c.x, top - hh, c.x + hw, top, c.x, top + hh, c.x - hw, top]).fill(shade(base, lit));
    }
  }
}

function mix(a: number, b: number, t: number): number {
  const ch = (s: number) => Math.round(((a >> s) & 255) * t + ((b >> s) & 255) * (1 - t));
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

/** Draws every AsteroidC region into `layer` (a container in the sector frame, art origin = sector tile (0, 0)). */
export function createAsteroidView(world: World, layer: Container, ores: Readonly<Record<string, { code: number; color: number }>>): AsteroidView {
  const colors = new Map(Object.values(ores).map((o) => [o.code, o.color]));
  const oreColor = (code: number) => colors.get(code) ?? 0xffffff;
  const views = new Map<number, { g: Graphics; rev: number }>();
  return {
    update(sector) {
      const live = new Set(sector ? world.query(AsteroidC) : []);
      for (const [id, v] of views) {
        if (!live.has(id)) {
          v.g.destroy();
          views.delete(id);
        }
      }
      if (!sector) return;
      for (const id of live) {
        const a = world.get(id, AsteroidC) as Asteroid;
        let v = views.get(id);
        if (!v) {
          v = { g: new Graphics(), rev: -1 };
          layer.addChild(v.g);
          views.set(id, v);
        }
        const rev = revision(sector, a);
        if (rev !== v.rev) {
          draw(v.g, sector, a, oreColor);
          v.rev = rev;
        }
      }
    },
    dispose() {
      for (const v of views.values()) v.g.destroy();
      views.clear();
    },
  };
}
