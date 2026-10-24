import { Container, type Sprite } from "pixi.js";
import type { Atlas, StaticSprite } from "./assets/loader";
import { CHUNK_SIZE, type Grid } from "../sim/grid";
import { ModuleC } from "../sim/modules/components";
import { hullRow } from "../sim/modules/footprint";
import { airlockDoorTiles } from "./airlockArt";
import { Struct, STRUCT_MAX_HP } from "../sim/structure";
import { depthKey } from "./iso";
import type { Layers } from "./layers";
import { lightTint, mulColor, pulsePhase } from "./lightTint";
import { createMarkers, type Markers } from "./markers";
import { createOverlay, type Overlay, type OverlayWorld } from "./overlay";
import { addStatic } from "./sprites";
import { haloTex } from "./haloTex";
import { beamIds, DEFAULT_BEAM_LOOK, type BeamLook } from "./beamArt";
import { createChunkViews, regionTiles, type ChunkRef } from "./regionTiles";
import { artKind, floorChain, ghostVertsIn, HULL_RAY, replacesFloor, wallPieces, type CutawayMode } from "./tiles";

export type { CutawayMode };

export interface GridView extends Markers {
  readonly grid: Grid;
  update(): void;
  /** Wall view mode; `ghosts` false (roofed ships) draws the near hull as solid full-height plating. */
  setCutaway(mode: CutawayMode, ghosts?: boolean): void;
  setOverlay(field: string | null): void;
  /** The tile sprites' light tint of tile (x, y) (region-local), for dressing drawn over it: same path as the tiles. `wall` = wall-like (lit by the brightest neighbour). */
  tintAt(x: number, y: number, wall: boolean): number;
  /** Changes whenever `tintAt` results may change (light, air, emergency pulse). */
  tintKey(): string;
  dispose(): void;
}

export interface GridViewHost {
  /** True when the ship has no running power source (emergency lighting). */
  emergency(): boolean;
  overlayWorld: OverlayWorld;
  /** Beam look of this ship (by faction); default civil. */
  beamLook?(): BeamLook;
}

/** Air thinner than this (kPa) is vacuum and gets a cold cast. */
const VACUUM_O2 = 5;
/** How far a wall inside a thick block looks for light (tiles; a wall with a floor tile round it uses only its 3x3). */
const WALL_LIGHT_REACH = 6;

interface Door {
  /** Display objects as returned by addStatic: sprite, glow, halo. */
  objs: Sprite[];
  closed: StaticSprite;
  open: StaticSprite;
  /** Index inside the chunk's arrays. */
  ci: number;
}
interface Tinted {
  spr: Sprite;
  /** Local tile, and its index inside the chunk's arrays. */
  x: number;
  y: number;
  ci: number;
  wall: boolean;
  /** Walls and doors darken as their integrity drops. */
  solid: boolean;
}

/** The tile sprites of one sector chunk of the region. */
interface TileChunk {
  c: ChunkRef;
  /** The chunk's floor plates (a container in the floor layer, so plates keep chunk order across rebuilds). */
  floor: Container;
  owned: Sprite[];
  tinted: Tinted[];
  doors: Door[];
  doorKey: number;
  tintKey: string;
}

/** Multiply tint of a damaged wall: dark and slightly warm toward 0 integrity. */
function damageTint(hp: number): number {
  const r = Math.min(1, hp / STRUCT_MAX_HP);
  if (r > 0.85) return 0xffffff;
  const f = 0.5 + 0.5 * (r / 0.85);
  const c = (v: number) => Math.round(255 * Math.min(1, v));
  return (c(f) << 16) | (c(f * 0.88) << 8) | c(f * 0.82);
}

/**
 * Floors, walls, hull and doors of one region, as one view per sector chunk (step 5b): a chunk is rebuilt when its own
 * struct changes or the two-tile strip around it does (a tile's sprites look up to two tiles away; `RegionTiles.key`),
 * when the engine / airlock hull tiles near it change, or when the cutaway mode does. Doors and tints update per chunk on their own revisions.
 */
export function createGridView(grid: Grid, atlas: Atlas, L: Layers, host: GridViewHost): GridView {
  const markers = createMarkers(L.ui);
  const overlay: Overlay = createOverlay(grid, L.decal, host.overlayWorld);
  const tiles = regionTiles(grid);
  const { width, height } = tiles;
  const chunks = createChunkViews<TileChunk>((v) => {
    clearChunk(v);
    v.floor.destroy();
  });
  let mode: CutawayMode = "auto";
  let ghosts = true;
  let modRev = -1;
  /** Region-wide gates for the per-chunk keys: the build inputs, and the door / tint inputs. */
  let builtKey = "";
  let frameKey = "";
  let replaced = new Set<number>();
  let airlocks = new Set<number>();

  const kindAt = tiles.kindAt;
  const wallAt = tiles.wallAt; // rock walls stay RockWall: never hull
  // Beam tiles under a cargo container are its seat, not frame: no beam sprite there, and the frame's beams end at it.
  const boxAt = (x: number, y: number): boolean => {
    const gx = x + grid.x0, gy = y + grid.y0;
    if (!grid.inBounds(gx, gy)) return false;
    const id = grid.get("module", gx, gy);
    const m = id ? host.overlayWorld.world.get(id, ModuleC) : undefined;
    return !!(m && host.overlayWorld.modules[m.def]?.container);
  };
  const frameKindAt = (x: number, y: number): number => (kindAt(x, y) === Struct.Beam && boxAt(x, y) ? Struct.Space : kindAt(x, y));

  function clearChunk(v: TileChunk): void {
    for (const s of v.owned) s.destroy();
    v.owned = [];
    v.tinted = [];
    v.doors = [];
  }

  /** Tile indices of the engine hull rows the bulkhead covers (walls up / roofed: it stands there in place of the hull wall). */
  function engineHull(): Set<number> {
    const out = new Set<number>();
    const { world, modules } = host.overlayWorld;
    for (const id of world.query(ModuleC)) {
      const m = world.get(id, ModuleC);
      const def = m && modules[m.def];
      if (!m || !def?.hullEdge || !grid.inBounds(m.x, m.y)) continue;
      // The bulkhead spans the row's inner tiles; the two end tiles keep their hull wall (the sprite stops inside them).
      const row = hullRow(def, m.x, m.y, m.rot).sort((a, b) => a.x + a.y - (b.x + b.y));
      for (const t of row.slice(1, -1)) out.add((t.y - grid.y0) * width + (t.x - grid.x0)); // region-local index
    }
    return out;
  }

  /** Door tiles of the docking airlocks (outer and inner): the airlock's own sprites (hull block, pod housing) stand there. */
  function airlockHull(): Set<number> {
    const { world, modules } = host.overlayWorld;
    const tiles = airlockDoorTiles(world, modules, (x, y) => grid.inBounds(x, y));
    return new Set(tiles.filter((t) => grid.inBounds(t.x, t.y)).map((t) => (t.y - grid.y0) * width + (t.x - grid.x0))); // region-local index
  }

  /** The engine and airlock hull tiles within two tiles of a chunk (the reach of its wall pieces), as part of its key. */
  function specialsNear(c: ChunkRef): string {
    const r = tiles.chunkRect(c);
    let k = "";
    for (const [tag, set] of [["e", replaced], ["a", airlocks]] as const)
      for (const i of set) {
        const x = i % width;
        const y = (i - x) / width;
        if (x >= r.x0 - 2 && x < r.x1 + 2 && y >= r.y0 - 2 && y < r.y1 + 2) k += `${tag}${i},`;
      }
    return k;
  }

  function buildChunk(c: ChunkRef, old: TileChunk | undefined): TileChunk {
    let v: TileChunk;
    if (old) {
      clearChunk(old);
      v = old;
    } else {
      const floor = new Container();
      L.floor.addChild(floor);
      v = { c, floor, owned: [], tinted: [], doors: [], doorKey: -1, tintKey: "" };
    }
    v.doorKey = -1;
    v.tintKey = "";
    const { owned, tinted, doors } = v;
    const r = tiles.chunkRect(c);
    const gapAt = (x: number, y: number): boolean => mode === "up" && tiles.inside(x, y) && replaced.has(y * width + x);
    const struct = tiles.data("struct", c);
    const x0 = Math.max(0, r.x0), x1 = Math.min(width, r.x1);
    const y0 = Math.max(0, r.y0), y1 = Math.min(height, r.y1);
    if (struct)
      for (let y = y0; y < y1; y++)
        for (let x = x0; x < x1; x++) {
          const ci = (y - r.y0) * CHUNK_SIZE + (x - r.x0);
          const raw = struct[ci] as number;
          const stone = raw === Struct.RockWall;
          const k = artKind(raw);
          if (k === Struct.Space || k === Struct.Rock || k === Struct.Ground) continue; // rock: asteroidView
          if (k === Struct.Beam) {
            if (boxAt(x, y)) continue;
            // Low open truss, the same in every wall view level; sprites sit at the tile's depth, overlays just above.
            const ids = beamIds(frameKindAt, x, y, host.beamLook?.() ?? DEFAULT_BEAM_LOOK);
            ids.forEach((id, i) => {
              const s = atlas.stat(id);
              if (!s) return;
              const made = addStatic(L, s, x, y, depthKey(x, y) + i * 0.001, L.sorted);
              owned.push(...made);
              tinted.push({ spr: made[0] as Sprite, x, y, ci, wall: true, solid: false });
            });
            continue;
          }
          const idx = y * width + x;
          // A near-hull ghost replaces the floor plate under it (not under an engine: its bulkhead stands on the deck).
          // An engine's hull row is the hull wall in cutaway / low (the same ghost as the hull around it); with the walls
          // up or roofed the wall is left out and the engine's bulkhead stands there between the hull runs.
          const engineUp = replaced.has(idx) && mode === "up";
          const f = ghosts && !engineUp && replacesFloor(wallAt, x, y, mode) ? undefined : atlas.firstOf(floorChain(x, y));
          if (f) {
            const made = addStatic(L, f, x, y, 0, v.floor);
            owned.push(...made);
            tinted.push({ spr: made[0] as Sprite, x, y, ci, wall: false, solid: false });
          }
          if (k === Struct.Floor) continue;
          // The engine's hull row (walls up or roofed) is the engine's own bulkhead sprite: no hull wall on it.
          if (gapAt(x, y) || airlocks.has(idx)) continue;
          for (const piece of wallPieces(wallAt, x, y, stone ? Struct.RockWall : k, mode, ghosts, gapAt)) {
            const s = atlas.firstOf(piece.chain);
            if (!s) continue;
            // Roofed (no ghosts): walls and hull sort a little earlier so the roof plate of the tile behind them covers
            // their shared top edge (they all end flush at the roof top).
            const made = addStatic(L, s, x, y, depthKey(x, y) + piece.order * 0.001 - (ghosts ? 0 : 0.15), piece.under ? L.under : L.sorted);
            owned.push(...made);
            const isDoor = k === Struct.Door;
            if (isDoor) {
              const closedId = piece.chain[0] as string;
              const open = atlas.stat(`${closedId}.open`);
              if (open) doors.push({ objs: made, closed: s, open, ci });
            }
            // A door is lit like a wall (the brightest light round it): its own tile is dark while it is closed (light stops at a
            // closed door) and takes its neighbours' light once open, which made the sprite change colour as it swung.
            tinted.push({ spr: made[0] as Sprite, x, y, ci, wall: true, solid: true });
          }
        }
    if (ghosts) {
      const vert = atlas.stat("tile.hull.ghost.vert");
      if (vert) for (const t of ghostVertsIn(wallAt, r.x0, r.y0, r.x1, r.y1)) owned.push(...addStatic(L, vert, t.x, t.y, depthKey(t.x, t.y) + 0.001, L.sorted));
    }
    return v;
  }

  function updateDoors(v: TileChunk): void {
    if (!v.doors.length) return;
    const r = tiles.rev("door", v.c);
    if (r === v.doorKey) return;
    v.doorKey = r;
    const door = tiles.data("door", v.c);
    for (const d of v.doors) {
      const s = ((door?.[d.ci] ?? 0) as number) > 128 ? d.open : d.closed;
      const [spr, glow, halo] = d.objs;
      if (spr) spr.texture = s.tex;
      if (glow && s.glow) glow.texture = s.glow;
      if (halo && s.glow) halo.texture = haloTex(s.glow);
    }
  }

  function updateTints(v: TileChunk, pulse: number): void {
    if (!v.tinted.length) return;
    const key = `${tiles.key("light", v.c, WALL_LIGHT_REACH)}|${tiles.rev("o2", v.c)}|${tiles.rev("hp", v.c)}|${pulse}`;
    if (key === v.tintKey) return;
    v.tintKey = key;
    const light = tiles.data("light", v.c);
    const o2 = tiles.data("o2", v.c);
    const hp = tiles.data("hp", v.c);
    const at = (a: Readonly<ArrayLike<number>> | undefined, i: number): number => (a ? (a[i] as number) : 0);
    const r = tiles.chunkRect(v.c);
    // A wall takes the brightest light round it; inside a thick block (no floor round it) the search widens until it
    // reaches a floor tile, so the block's top is lit as one mass instead of darkening into a pit.
    const floorAt = (x: number, y: number) => tiles.inside(x, y) && kindAt(x, y) === Struct.Floor;
    const wallLight = (x: number, y: number): number => {
      let best = 0;
      for (let rr = 1; rr <= WALL_LIGHT_REACH; rr++) {
        let open = false;
        for (let dy = -rr; dy <= rr; dy++)
          for (let dx = -rr; dx <= rr; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (Math.max(Math.abs(dx), Math.abs(dy)) === rr && floorAt(nx, ny)) open = true;
            if (!tiles.inside(nx, ny)) continue;
            const own = nx >= r.x0 && ny >= r.y0 && nx < r.x1 && ny < r.y1;
            best = Math.max(best, own ? at(light, (ny - r.y0) * CHUNK_SIZE + (nx - r.x0)) : tiles.get("light", nx, ny));
          }
        if (open) break;
      }
      return best;
    };
    for (const t of v.tinted) {
      const lv = t.wall ? wallLight(t.x, t.y) : at(light, t.ci);
      const lit = lightTint(lv, !t.wall && at(o2, t.ci) < VACUUM_O2, pulse);
      const base = t.solid ? mulColor(lit, damageTint(at(hp, t.ci))) : lit;
      t.spr.tint = base;
    }
  }

  const pulseNow = (): number => (host.emergency() ? pulsePhase(performance.now()) : -1);
  const tintAt = (x: number, y: number, wall: boolean): number => {
    let lv = 0;
    if (wall) {
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) if (tiles.inside(x + dx, y + dy)) lv = Math.max(lv, tiles.get("light", x + dx, y + dy));
    } else lv = tiles.get("light", x, y);
    return lightTint(lv, !wall && tiles.get("o2", x, y) < VACUUM_O2, pulseNow());
  };

  // Selection, hover and build previews come in sector tiles; the markers draw region-local.
  const loc = (t: { x: number; y: number }) => ({ x: t.x - grid.x0, y: t.y - grid.y0 });
  return {
    setSelection: (t) => markers.setSelection(t === null ? null : Array.isArray(t) ? t.map(loc) : loc(t as { x: number; y: number })),
    setHover: (t) => markers.setHover(t && loc(t)),
    setPreview: (tiles, valid) => markers.setPreview(tiles.map(loc), valid),
    grid,
    tintAt,
    tintKey: () => `${grid.revision("light")}|${grid.revision("o2")}|${pulseNow()}`,
    update() {
      const mr = grid.revision("module");
      if (mr !== modRev) {
        modRev = mr;
        replaced = engineHull();
        airlocks = airlockHull();
      }
      const look = host.beamLook?.() ?? DEFAULT_BEAM_LOOK;
      const base = `${mode}|${ghosts}|${look}`;
      // Per-chunk keys only when something in the region moved (tiles outside it read as Space, so its revision covers
      // every input). One chunk ring past the region: ghost verts sit a tile outside its -x / -y edges.
      const built = `${base}|${grid.revision("struct")}|${mr}`;
      if (built !== builtKey) {
        builtKey = built;
        chunks.sync(tiles.chunks(1), (c) => `${base}|${tiles.key("struct", c, HULL_RAY)}|${specialsNear(c)}`, buildChunk);
        frameKey = "";
      }
      const pulse = host.emergency() ? pulsePhase(performance.now()) : -1;
      const fk = `${grid.revision("door")}|${grid.revision("light")}|${grid.revision("o2")}|${grid.revision("hp")}|${pulse}`;
      if (fk !== frameKey) {
        frameKey = fk;
        for (const v of chunks.views()) {
          updateDoors(v);
          updateTints(v, pulse);
        }
      }
      overlay.update();
    },
    setCutaway(m, g = true) {
      mode = m;
      ghosts = g;
    },
    setOverlay: (f) => overlay.setField(f),
    dispose() {
      chunks.clear();
      for (const layer of [L.decal, L.ui])
        for (const c of layer.removeChildren()) c.destroy({ children: true });
    },
  };
}
