import { Graphics, type Container } from 'pixi.js';
import { AsteroidC, type Asteroid } from '../sim/asteroids/components';
import type { World } from '../sim/ecs';
import { CHUNK_SIZE } from '../sim/grid';
import type { SectorGrid } from '../sim/sectorGrid';
import { Struct } from '../sim/structure';
import { iso, TILE_H, TILE_W } from './iso';

/**
 * PLACEHOLDER asteroid drawing (procedural, allowed while asteroid art is pending; final art comes from the sprite pipeline):
 * each rock tile is a flat diamond, lit on the faces towards the top-left, with a darker rim on edges that face open space
 * towards the camera so the rock reads as a slab. Ore tiles take their ore colour, the hollowable core a darker purple-grey.
 * Every size is derived from TILE_W / TILE_H. One Graphics per asteroid, rebuilt when its chunks' struct or ore revisions change.
 */
export interface AsteroidView {
  update(sector: SectorGrid | null): void;
  dispose(): void;
}

const ROCK = 0x68625c;
const CORE = 0x4a4060;
/** Rim (slab side) height as a fraction of the tile height. */
const RIM = 0.35;

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
  const hw = TILE_W / 2, hh = TILE_H / 2, rim = TILE_H * RIM;
  const rock = (x: number, y: number) => {
    const k = sector.get('struct', x, y);
    return k === Struct.Rock || k === Struct.CoreRock;
  };
  // back to front (x + y ascending), so a nearer tile's rim covers the one behind it
  for (let d = 0; d <= a.width + a.height - 2; d++) {
    for (let lx = Math.max(0, d - a.height + 1); lx <= Math.min(a.width - 1, d); lx++) {
      const x = a.x + lx, y = a.y + d - lx;
      if (!rock(x, y)) continue;
      const kind = sector.get('struct', x, y);
      const ore = sector.get('ore', x, y);
      const base = ore ? oreColor(ore) : kind === Struct.CoreRock ? CORE : ROCK;
      const c = iso(x, y);
      const lit = !rock(x - 1, y) || !rock(x, y - 1) ? 1.2 : 1;
      if (!rock(x, y + 1)) g.poly([c.x - hw, c.y, c.x, c.y + hh, c.x, c.y + hh + rim, c.x - hw, c.y + rim]).fill(shade(base, 0.55));
      if (!rock(x + 1, y)) g.poly([c.x, c.y + hh, c.x + hw, c.y, c.x + hw, c.y + rim, c.x, c.y + hh + rim]).fill(shade(base, 0.4));
      g.poly([c.x, c.y - hh, c.x + hw, c.y, c.x, c.y + hh, c.x - hw, c.y]).fill(shade(base, lit));
    }
  }
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
