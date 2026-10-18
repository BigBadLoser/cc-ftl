import type { Sprite } from "pixi.js";
import type { Atlas, StaticSprite } from "./assets/loader";
import type { Grid } from "../sim/grid";
import { ModuleC } from "../sim/modules/components";
import { hullRow } from "../sim/modules/footprint";
import { Struct, STRUCT_MAX_HP } from "../sim/structure";
import { depthKey } from "./iso";
import type { Layers } from "./layers";
import { lightTint, mulColor, pulsePhase } from "./lightTint";
import { createMarkers, type Markers } from "./markers";
import { createOverlay, type Overlay, type OverlayWorld } from "./overlay";
import { addStatic } from "./sprites";
import { floorChain, ghostVerts, replacesFloor, wallPieces, type CutawayMode } from "./tiles";

export type { CutawayMode };

export interface GridView extends Markers {
  readonly grid: Grid;
  update(): void;
  /** Wall view mode; `ghosts` false (roofed ships) draws the near hull as solid full-height plating. */
  setCutaway(mode: CutawayMode, ghosts?: boolean): void;
  setOverlay(field: string | null): void;
  dispose(): void;
}

export interface GridViewHost {
  /** True when the ship has no running power source (emergency lighting). */
  emergency(): boolean;
  overlayWorld: OverlayWorld;
}

/** Air thinner than this (kPa) is vacuum and gets a cold cast. */
const VACUUM_O2 = 5;

interface Door {
  /** Display objects as returned by addStatic: sprite, glow, halo. */
  objs: Sprite[];
  closed: StaticSprite;
  open: StaticSprite;
  idx: number;
}
interface Tinted {
  spr: Sprite;
  idx: number;
  wall: boolean;
  /** Walls and doors darken as their integrity drops. */
  solid: boolean;
}

/** Multiply tint of a damaged wall: dark and slightly warm toward 0 integrity. */
function damageTint(hp: number): number {
  const r = Math.min(1, hp / STRUCT_MAX_HP);
  if (r > 0.85) return 0xffffff;
  const f = 0.5 + 0.5 * (r / 0.85);
  const c = (v: number) => Math.round(255 * Math.min(1, v));
  return (c(f) << 16) | (c(f * 0.88) << 8) | c(f * 0.82);
}

/** Floors, walls, hull and doors of one grid, rebuilt whenever the struct revision or the cutaway mode changes. */
export function createGridView(grid: Grid, atlas: Atlas, L: Layers, host: GridViewHost): GridView {
  const markers = createMarkers(L.ui);
  const overlay: Overlay = createOverlay(grid, L.decal, host.overlayWorld);
  let owned: Sprite[] = [];
  let tinted: Tinted[] = [];
  let doors: Door[] = [];
  let mode: CutawayMode = "auto";
  let ghosts = true;
  let builtMode = "";
  let rev = -1;
  let modRev = -1;
  let tintKey = "";
  let doorKey = -1;

  const kindAt = (x: number, y: number): number =>
    grid.inBounds(x, y) ? grid.get("struct", x, y) : Struct.Space;

  function clear(): void {
    for (const s of owned) s.destroy();
    owned = [];
    tinted = [];
    doors = [];
  }

  /** Tile indices of engine hull sections: the engine's own hull art replaces the wall there. */
  function engineHull(): Set<number> {
    const out = new Set<number>();
    const { world, modules } = host.overlayWorld;
    for (const id of world.query(ModuleC)) {
      const m = world.get(id, ModuleC);
      const def = m && modules[m.def];
      if (!m || !def?.hullEdge || m.gridId !== grid.id) continue;
      for (const t of hullRow(def, m.x, m.y, m.rot)) out.add(t.y * grid.width + t.x);
    }
    return out;
  }

  function rebuild(): void {
    clear();
    const replaced = engineHull();
    for (let y = 0; y < grid.height; y++)
      for (let x = 0; x < grid.width; x++) {
        const k = kindAt(x, y);
        if (k === Struct.Space) continue;
        const idx = y * grid.width + x;
        // A near-hull ghost replaces the floor plate under it (not under an engine: its bulkhead stands on the deck).
        const f = ghosts && replacesFloor(kindAt, x, y, mode) && !replaced.has(idx) ? undefined : atlas.firstOf(floorChain(x, y));
        if (f) {
          const made = addStatic(L, f, x, y, 0, L.floor);
          owned.push(...made);
          tinted.push({ spr: made[0] as Sprite, idx, wall: false, solid: false });
        }
        if (k === Struct.Floor || replaced.has(idx)) continue;
        for (const piece of wallPieces(kindAt, x, y, k, mode, ghosts)) {
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
            if (open) doors.push({ objs: made, closed: s, open, idx });
          }
          tinted.push({ spr: made[0] as Sprite, idx, wall: !isDoor, solid: true });
        }
      }
    if (ghosts) {
      const vert = atlas.stat("tile.hull.ghost.vert");
      if (vert) for (const t of ghostVerts(kindAt, grid.width, grid.height)) owned.push(...addStatic(L, vert, t.x, t.y, depthKey(t.x, t.y) + 0.001, L.sorted));
    }
    builtMode = `${mode}|${ghosts}`;
    doorKey = -1;
    tintKey = "";
  }

  function updateDoors(): void {
    const r = grid.revision("door");
    if (r === doorKey) return;
    doorKey = r;
    const door = grid.raw("door");
    for (const d of doors) {
      const s = (door[d.idx] as number) > 128 ? d.open : d.closed;
      const [spr, glow, halo] = d.objs;
      if (spr) spr.texture = s.tex;
      if (glow && s.glow) glow.texture = s.glow;
      if (halo && s.glow) halo.texture = s.glow;
    }
  }

  function updateTints(): void {
    const emergency = host.emergency();
    const pulse = emergency ? pulsePhase(performance.now()) : -1;
    const key = `${grid.revision("light")}|${grid.revision("o2")}|${grid.revision("hp")}|${pulse}`;
    if (key === tintKey) return;
    tintKey = key;
    const light = grid.raw("light");
    const o2 = grid.raw("o2");
    const hp = grid.raw("hp");
    const { width, height } = grid;
    const wallLight = (idx: number): number => {
      const x = idx % width;
      const y = (idx - x) / width;
      let best = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < width && ny < height) best = Math.max(best, light[ny * width + nx] as number);
        }
      return best;
    };
    for (const t of tinted) {
      const lv = t.wall ? wallLight(t.idx) : (light[t.idx] as number);
      const lit = lightTint(lv, !t.wall && (o2[t.idx] as number) < VACUUM_O2, pulse);
      t.spr.tint = t.solid ? mulColor(lit, damageTint(hp[t.idx] as number)) : lit;
    }
  }

  return {
    ...markers,
    grid,
    update() {
      const r = grid.revision("struct");
      const mr = grid.revision("module");
      if (r !== rev || mr !== modRev || builtMode !== `${mode}|${ghosts}`) {
        rebuild();
        rev = r;
        modRev = mr;
      }
      updateDoors();
      updateTints();
      overlay.update();
    },
    setCutaway(m, g = true) {
      mode = m;
      ghosts = g;
    },
    setOverlay: (f) => overlay.setField(f),
    dispose() {
      clear();
      for (const layer of [L.decal, L.ui])
        for (const c of layer.removeChildren()) c.destroy({ children: true });
    },
  };
}
