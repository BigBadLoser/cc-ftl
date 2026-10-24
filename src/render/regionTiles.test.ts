import { describe, expect, it, vi } from 'vitest';
import { Texture, type Container } from 'pixi.js';
import { World } from '../sim/ecs';
import { ShipGrid } from '../sim/shipGrid';
import { newSectorGrid } from '../sim/stamp';
import { Struct } from '../sim/structure';
import type { Atlas, StaticSprite } from './assets/loader';
import { createGridView } from './gridView';
import { createWorldStack } from './worldLayers';
import { createChunkViews, regionTiles, type ChunkRef } from './regionTiles';
import { ghostVerts, ghostVertsIn, HullSide, hullSide, wallPieces } from './tiles';

/** A w x h hull ring with floor inside, stamped at sector (ox, oy), plus a few interior walls and a door. */
function ship(ox: number, oy: number, w = 40, h = 20): ShipGrid {
  const sector = newSectorGrid();
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const edge = x === 0 || y === 0 || x === w - 1 || y === h - 1;
      sector.set('struct', ox + x, oy + y, edge ? Struct.Wall : x === 12 ? (y === 8 ? Struct.Door : Struct.Wall) : Struct.Floor);
    }
  return new ShipGrid(1, sector, ox, oy, w, h);
}

// Markers and the field overlay bake canvas textures (no DOM in tests); the tile sprites are what is under test.
vi.mock('./markers', () => ({ createMarkers: () => ({}) }));
vi.mock('./overlay', () => ({ createOverlay: () => ({ setField() {}, update() {} }) }));
const createLayers = () => createWorldStack().region(false);

const key = (c: ChunkRef) => `${c.cx},${c.cy}`;

describe('region tiles', () => {
  it('wall art reads a truss tile as outside: a hull wall facing it is near hull, and a wall run ending there gets its end face', () => {
    const g = ship(0, 0, 12, 8);
    // A truss along the whole south side, one tile off the hull (the hull's own south run stays at y = 7).
    for (let x = 1; x < 11; x++) g.set('struct', x, 7, Struct.Beam);
    for (let x = 0; x < 12; x++) g.set('struct', x, 6, Struct.Wall); // the south hull run now at y = 6, facing the truss
    const t = regionTiles(g);
    expect(t.kindAt(5, 7)).toBe(Struct.Beam);
    expect(t.wallAt(5, 7)).toBe(Struct.Space);
    expect(hullSide(t.wallAt, 5, 6)).toBe(HullSide.Near);
    // With the truss read as solid-but-not-space the same wall would be a partition.
    expect(hullSide(t.kindAt, 5, 6)).toBe(HullSide.None);
    // An interior wall butting into that ghost run from the north gets the end face.
    g.set('struct', 5, 5, Struct.Wall);
    g.set('struct', 5, 4, Struct.Wall);
    const u = regionTiles(g);
    const pieces = wallPieces(u.wallAt, 5, 5, Struct.Wall, 'auto').map((p) => p.chain[0]);
    expect(pieces.some((id) => id?.includes('end.s'))).toBe(true);
  });
  it('wallAt keeps a rock wall, kindAt reads it as wall; rock mass is Space for both', () => {
    const g = ship(0, 0, 8, 6);
    g.set('struct', 3, 3, Struct.RockWall);
    g.set('struct', 4, 3, Struct.Rock);
    const t = regionTiles(g);
    expect(t.wallAt(3, 3)).toBe(Struct.RockWall);
    expect(t.kindAt(3, 3)).toBe(Struct.Wall);
    expect(t.wallAt(4, 3)).toBe(Struct.Space);
    expect(t.wallAt(5, 3)).toBe(t.kindAt(5, 3));
  });


  it('reads the window through sector chunks, Space outside it', () => {
    const g = ship(21, -7);
    const t = regionTiles(g);
    for (let y = -2; y < g.height + 2; y++)
      for (let x = -2; x < g.width + 2; x++) expect(t.kindAt(x, y)).toBe(g.inBounds(g.x0 + x, g.y0 + y) ? g.get('struct', g.x0 + x, g.y0 + y) : Struct.Space);
    // Sector x 21..60, y -7..12: chunks 1..3 by -1..0; a pad adds chunks only where it crosses a chunk edge.
    expect(t.chunks().map(key)).toEqual(['1,-1', '2,-1', '3,-1', '1,0', '2,0', '3,0']);
    expect(t.chunks(1).length).toBe(6);
    expect(t.chunks(12).length).toBe(20); // x 9..72 = chunks 0..4, y -19..24 = chunks -2..1
    expect(t.chunkRect({ cx: 1, cy: -1 })).toEqual({ x0: -5, y0: -9, x1: 11, y1: 7 });
  });

  it('scans the non-Space tiles in the row-major order of a dense sweep', () => {
    const g = ship(21, -7);
    const seen: number[] = [];
    regionTiles(g).scan((x, y, i) => {
      expect(i).toBe(y * g.width + x);
      seen.push(i);
    });
    const dense: number[] = [];
    for (let y = 0; y < g.height; y++) for (let x = 0; x < g.width; x++) if (g.get('struct', g.x0 + x, g.y0 + y) !== Struct.Space) dense.push(y * g.width + x);
    expect(seen).toEqual(dense);
  });

  it('a chunk key over the 3 x 3 block changes for a write next door, not two chunks away', () => {
    const g = ship(0, 0, 60, 20);
    const t = regionTiles(g);
    const before = new Map(t.chunks().map((c) => [key(c), t.rev('struct', c, 1)]));
    g.set('struct', 40, 5, Struct.Wall); // chunk (2, 0)
    const changed = t.chunks().filter((c) => t.rev('struct', c, 1) !== before.get(key(c))).map(key);
    expect(changed).toEqual(['1,0', '2,0', '3,0', '1,1', '2,1', '3,1']);
  });

  it('a chunk view key moves for its own tiles and its two-tile margin only', () => {
    const g = ship(0, 0, 60, 40);
    const t = regionTiles(g);
    const keys = () => new Map(t.chunks().map((c) => [key(c), t.key('struct', c)]));
    const moved = (write: () => void) => {
      const before = keys();
      write();
      const after = keys();
      return [...after].filter(([k, v]) => before.get(k) !== v).map(([k]) => k);
    };
    expect(moved(() => g.set('struct', 40, 8, Struct.Wall))).toEqual(['2,0']); // deep inside chunk (2, 0)
    expect(moved(() => g.set('struct', 33, 8, Struct.Wall))).toEqual(['1,0', '2,0']); // 2 tiles from its west edge
    expect(moved(() => g.set('struct', 47, 15, Struct.Wall))).toEqual(['2,0', '3,0', '2,1', '3,1']); // the SE corner
  });

  it('splits the ghost verts exactly between chunks', () => {
    const g = ship(3, 5, 37, 23);
    const t = regionTiles(g);
    g.set('struct', 23, 27, Struct.Floor); // a notch in the near hull (local 20, 22; windows take sector tiles)
    g.set('struct', 23, 26, Struct.Floor);
    const all = ghostVerts(t.kindAt, g.width, g.height).map((v) => `${v.x},${v.y}`).sort();
    const parts = t.chunks(1).flatMap((c) => {
      const r = t.chunkRect(c);
      return ghostVertsIn(t.kindAt, r.x0, r.y0, r.x1, r.y1).map((v) => `${v.x},${v.y}`);
    });
    expect(parts.sort()).toEqual(all);
  });
});

describe('chunk views', () => {
  it('builds each chunk once, rebuilds only a changed key (with its old view) and drops chunks that leave', () => {
    const built: string[] = [];
    const dropped: string[] = [];
    const v = createChunkViews<{ id: string; n: number }>((x) => dropped.push(x.id));
    const keys = new Map([['0,0', 'a'], ['1,0', 'a'], ['0,1', 'a']]);
    const want = () => [...keys.keys()].map((k) => ({ cx: Number(k.split(',')[0]), cy: Number(k.split(',')[1]) }));
    const build = (c: ChunkRef, old?: { id: string; n: number }) => {
      built.push(key(c));
      return { id: key(c), n: (old?.n ?? 0) + 1 };
    };
    expect(v.sync(want(), (c) => keys.get(key(c)) as string, build)).toBe(3);
    expect(v.sync(want(), (c) => keys.get(key(c)) as string, build)).toBe(0);
    keys.set('1,0', 'b');
    expect(v.sync(want(), (c) => keys.get(key(c)) as string, build)).toBe(1);
    expect(v.get({ cx: 1, cy: 0 })?.n).toBe(2);
    keys.delete('0,1');
    v.sync(want(), (c) => keys.get(key(c)) as string, build);
    expect(built).toEqual(['0,0', '1,0', '0,1', '1,0']);
    expect(dropped).toEqual(['0,1']);
    expect(v.views().map((x) => x.id)).toEqual(['0,0', '1,0']);
  });
});

describe('grid view per chunk', () => {
  /** An atlas with one texture per id, so sprites can be told apart. */
  function fakeAtlas(): { atlas: Atlas; idOf: Map<Texture, string> } {
    const made = new Map<string, StaticSprite>();
    const idOf = new Map<Texture, string>();
    const stat = (id: string): StaticSprite | undefined => {
      if (id.endsWith('.open') || id === 'tile.hull.ghost.vert') return undefined;
      let s = made.get(id);
      if (!s) {
        const tex = new Texture();
        idOf.set(tex, id);
        s = { tex, glow: null, ax: 32, ay: 16, footprint: [1, 1] };
        made.set(id, s);
      }
      return s;
    };
    const atlas = { stat, firstOf: (ids: readonly string[]) => stat(ids[0] as string), ids: () => [], layer: () => undefined } as unknown as Atlas;
    return { atlas, idOf };
  }
  const host = { emergency: () => false, overlayWorld: { world: new World(), modules: {} } };
  const floors = (L: { floor: Container }) => L.floor.children.flatMap((c) => c.children);
  const shape = (objs: Container[], idOf: Map<Texture, string>) =>
    objs.map((o) => `${idOf.get((o as unknown as { texture: Texture }).texture)}@${o.x},${o.y},${o.zIndex}`).sort();

  it('rebuilds only the chunks around a changed tile, and ends up as a fresh build would', () => {
    const g = ship(5, 3, 60, 20);
    const { atlas, idOf } = fakeAtlas();
    const L = createLayers();
    const view = createGridView(g, atlas, L, host);
    view.update();
    const far = new Set(L.floor.children[0]?.children); // chunk (0, 0): sector x 0..15
    const sortedBefore = new Set(L.sorted.children);
    g.set('struct', 50, 13, Struct.Wall); // local (45, 10): chunk (3, 0)
    view.update();
    // Chunk (0, 0) is three chunks from the write: its plates are the same objects.
    expect(new Set(L.floor.children[0]?.children)).toEqual(far);
    expect([...far].every((s) => !s.destroyed)).toBe(true);
    // Most walls survive; the ones near the write were rebuilt.
    const kept = L.sorted.children.filter((s) => sortedBefore.has(s)).length;
    expect(kept).toBeGreaterThan(0);
    expect(kept).toBeLessThan(L.sorted.children.length);

    const L2 = createLayers();
    const fresh = createGridView(g, atlas, L2, host);
    fresh.update();
    expect(shape(floors(L), idOf)).toEqual(shape(floors(L2), idOf));
    expect(shape(L.sorted.children, idOf)).toEqual(shape(L2.sorted.children, idOf));
    expect(shape(L.under.children, idOf)).toEqual(shape(L2.under.children, idOf));
  });

  it('rebuilds every chunk when the cutaway mode changes', () => {
    const g = ship(0, 0, 40, 20);
    const { atlas } = fakeAtlas();
    const L = createLayers();
    const view = createGridView(g, atlas, L, host);
    view.update();
    const before = new Set(L.sorted.children);
    view.setCutaway('up');
    view.update();
    expect(L.sorted.children.some((s) => before.has(s))).toBe(false);
  });
});
