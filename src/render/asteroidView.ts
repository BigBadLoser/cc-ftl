import { Container, type Sprite } from 'pixi.js';
import { AsteroidC, type Asteroid } from '../sim/asteroids/components';
import type { World } from '../sim/ecs';
import { CHUNK_SIZE } from '../sim/grid';
import { ROCK_TOP_Z } from '../sim/mining/geometry';
import type { SectorGrid } from '../sim/sectorGrid';
import { Struct } from '../sim/structure';
import type { Atlas } from './assets/loader';
import { depthKey } from './iso';
import type { Layers } from './layers';
import { addStatic } from './sprites';
import { tileHash } from './tiles';

/**
 * Asteroid rock from the `rock` sprite family (tools/blender/sprites/rock.py). Neighbour masks are N 1, E 2, S 4, W 8.
 *  - Rock mass `rock.mass.m<mask>[.c<cuts>].v<0-3>`: mask = the rock neighbours; cuts mark inner corners (the diagonal is not
 *    rock while both sides beside it are): SE 1, SW 2, NE 4 (a NW cut sits behind the rock's own top and is never drawn).
 *    Ore tiles use `rock.ore.<iron|ice|rare>.<rich|thin>.m<mask>[.c<cuts>]` instead (one variant).
 *  - Ground `rock.ground.m<mask>[.c<cuts>].v<n>`: mask = the solid neighbours (rock or ground), cuts SE 1, SW 2, NE 4, NW 8; the
 *    interior (m15, no cuts) has 8 variants, edges 3. Under every rock tile goes `rock.ground.<...>.under`, the asteroid's
 *    worn edge and under-lip, which the mass stands back on.
 * Ground and the under-lips go in the floor layer back to front; mass sorts with everything else at its tile's depth. Variants
 * come from a hash of the tile. Rebuilt when the chunks' struct or ore revisions change, or when art arrives (`rebuild`).
 */
export interface AsteroidView {
  update(sector: SectorGrid | null): void;
  /** Build again from the atlas now (new sheets arrived, or the art streamer is marking the sheets in use). */
  rebuild(): void;
  dispose(): void;
}

/** Height of a rock-mass block in tiles of height (the art's ZM). */
export const ROCK_MASS_Z = ROCK_TOP_Z;
/** Mass sits a hair behind other things on its diagonal. */
export const MASS_DZ = -0.1;

const ORE_KIND: Record<string, string> = { 'ore.iron': 'iron', 'ore.ice': 'ice', 'ore.rare': 'rare' };

/** Sum of the struct, ore and ore-amount chunk revisions under the asteroid's bbox (padded by one): a change detector. */
function revision(sector: SectorGrid, a: Asteroid): number {
  let rev = 0;
  for (let cy = Math.floor((a.y - 1) / CHUNK_SIZE); cy <= Math.floor((a.y + a.height) / CHUNK_SIZE); cy++) {
    for (let cx = Math.floor((a.x - 1) / CHUNK_SIZE); cx <= Math.floor((a.x + a.width) / CHUNK_SIZE); cx++) {
      rev += sector.chunkRevision('struct', cx, cy) + sector.chunkRevision('ore', cx, cy) + sector.chunkRevision('oreAmt', cx, cy);
    }
  }
  return rev;
}

export const cuts = (c: number) => (c ? `.c${c}` : '');

/** Inner-corner cut bits: the diagonal is not `solid` while both neighbours beside it are. */
export function cutBits(solid: (dx: number, dy: number) => boolean, nw: boolean): number {
  const n = solid(0, -1), e = solid(1, 0), s = solid(0, 1), w = solid(-1, 0);
  return (s && e && !solid(1, 1) ? 1 : 0) | (s && w && !solid(-1, 1) ? 2 : 0) | (n && e && !solid(1, -1) ? 4 : 0) | (nw && n && w && !solid(-1, -1) ? 8 : 0);
}
export const maskOf = (solid: (dx: number, dy: number) => boolean): number =>
  (solid(0, -1) ? 1 : 0) | (solid(1, 0) ? 2 : 0) | (solid(0, 1) ? 4 : 0) | (solid(-1, 0) ? 8 : 0);

/** Art ids of the rock-mass block at (x, y), best first: `isRock` says which neighbours are rock; `oreId` is `rock.ore.<kind>.<rich|thin>` for an ore tile. */
export function massChain(isRock: (dx: number, dy: number) => boolean, x: number, y: number, oreId?: string): string[] {
  const v = (tileHash(x, y) >>> 8) % 4;
  const m = maskOf(isRock), c = cutBits(isRock, false);
  const mm = `m${m}${cuts(c)}`;
  return [...(oreId ? [`${oreId}.${mm}`] : []), `rock.mass.${mm}.v${v}`, `rock.mass.${mm}.v0`, `rock.mass.m${m}.v0`];
}

interface Built {
  root: Container;
  mass: Sprite[];
  rev: number;
  gen: number;
}

export function createAsteroidView(world: World, atlas: Atlas, L: Layers, ores: Readonly<Record<string, { code: number; amount: readonly [number, number] }>>): AsteroidView {
  const byCode = new Map(Object.entries(ores).map(([id, o]) => [o.code, { kind: ORE_KIND[id] ?? 'iron', mid: (o.amount[0] + o.amount[1]) / 2 }]));
  const views = new Map<number, Built>();
  let last: SectorGrid | null = null;

  function drop(b: Built): void {
    b.root.destroy({ children: true });
    for (const s of b.mass) s.destroy();
  }

  function build(sector: SectorGrid, a: Asteroid, b: Built): void {
    b.root.removeChildren().forEach((c) => c.destroy());
    for (const s of b.mass) s.destroy();
    b.mass.length = 0;
    const kind = (x: number, y: number) => sector.get('struct', x, y);
    for (let d = 0; d <= a.width + a.height - 2; d++) {
      for (let lx = Math.max(0, d - a.height + 1); lx <= Math.min(a.width - 1, d); lx++) {
        const x = a.x + lx, y = a.y + d - lx;
        const k = kind(x, y);
        if (k !== Struct.Rock && k !== Struct.Ground) continue;
        const h = tileHash(x, y) >>> 8;
        const solid = (dx: number, dy: number) => { const n = kind(x + dx, y + dy); return n === Struct.Rock || n === Struct.Ground; };
        const gm = maskOf(solid), gc = cutBits(solid, true);
        const g = `rock.ground.m${gm}${cuts(gc)}`;
        if (k === Struct.Ground) {
          const v = h % (gm === 15 && !gc ? 8 : 3);
          const s = atlas.firstOf([`${g}.v${v}`, `${g}.v0`]);
          if (s) addStatic(L, s, x, y, 0, b.root);
          continue;
        }
        const under = atlas.stat(`${g}.under`);
        if (under) addStatic(L, under, x, y, 0, b.root);
        const ore = sector.get('ore', x, y);
        const def = ore ? byCode.get(ore) : undefined;
        const oreId = def ? `rock.ore.${def.kind}.${sector.get('oreAmt', x, y) >= def.mid ? 'rich' : 'thin'}` : undefined;
        const s = atlas.firstOf(massChain((dx, dy) => kind(x + dx, y + dy) === Struct.Rock, x, y, oreId));
        if (s) b.mass.push(...addStatic(L, s, x, y, depthKey(x, y) + MASS_DZ, L.sorted));
      }
    }
  }

  function sync(sector: SectorGrid, force: boolean): void {
    const live = new Set(world.query(AsteroidC));
    for (const [id, b] of views) {
      if (!live.has(id)) {
        drop(b);
        views.delete(id);
      }
    }
    for (const id of live) {
      const a = world.get(id, AsteroidC) as Asteroid;
      let b = views.get(id);
      if (!b) {
        const root = new Container();
        L.floor.addChild(root);
        views.set(id, (b = { root, mass: [], rev: -1, gen: -1 }));
      }
      const rev = revision(sector, a);
      if (force || rev !== b.rev || b.gen !== atlas.generation) {
        build(sector, a, b);
        b.rev = rev;
        b.gen = atlas.generation;
      }
    }
  }

  return {
    update(sector) {
      last = sector;
      if (!sector) {
        for (const b of views.values()) drop(b);
        views.clear();
        return;
      }
      sync(sector, false);
    },
    rebuild() {
      if (last) sync(last, true);
    },
    dispose() {
      for (const b of views.values()) drop(b);
      views.clear();
    },
  };
}
