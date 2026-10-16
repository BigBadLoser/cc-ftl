import type { Sprite } from "pixi.js";
import type { Atlas, StaticSprite } from "./assets/loader";
import type { Grid } from "../sim/grid";
import { Struct } from "../sim/structure";
import { depthKey } from "./iso";
import type { Layers } from "./layers";
import { lightTint, pulsePhase } from "./lightTint";
import { createMarkers, type Markers } from "./markers";
import { createOverlay, type Overlay, type OverlayWorld } from "./overlay";
import { addStatic } from "./sprites";
import { floorChain, wallPieces } from "./tiles";

export interface GridView extends Markers {
  readonly grid: Grid;
  update(): void;
  setGhosts(on: boolean): void;
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
}

/** Floors, walls, hull and doors of one grid, rebuilt whenever the struct revision or the ghost setting changes. */
export function createGridView(grid: Grid, atlas: Atlas, L: Layers, host: GridViewHost): GridView {
  const markers = createMarkers(L.ui);
  const overlay: Overlay = createOverlay(grid, L.decal, host.overlayWorld);
  let owned: Sprite[] = [];
  let tinted: Tinted[] = [];
  let doors: Door[] = [];
  let ghosts = true;
  let builtGhosts: boolean | null = null;
  let rev = -1;
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

  function rebuild(): void {
    clear();
    for (let y = 0; y < grid.height; y++)
      for (let x = 0; x < grid.width; x++) {
        const k = kindAt(x, y);
        if (k === Struct.Space) continue;
        const idx = y * grid.width + x;
        const f = atlas.firstOf(floorChain(x, y));
        if (f) {
          const made = addStatic(L, f, x, y, 0, L.floor);
          owned.push(...made);
          tinted.push({ spr: made[0] as Sprite, idx, wall: false });
        }
        if (k === Struct.Floor) continue;
        for (const piece of wallPieces(kindAt, x, y, k, ghosts)) {
          const s = atlas.firstOf(piece.chain);
          if (!s) continue;
          const made = addStatic(L, s, x, y, depthKey(x, y) + piece.order * 0.001, L.sorted);
          owned.push(...made);
          const isDoor = k === Struct.Door;
          if (isDoor) {
            const closedId = piece.chain[0] as string;
            const open = atlas.stat(`${closedId}.open`);
            if (open) doors.push({ objs: made, closed: s, open, idx });
          }
          tinted.push({ spr: made[0] as Sprite, idx, wall: !isDoor });
        }
      }
    builtGhosts = ghosts;
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
    const key = `${grid.revision("light")}|${grid.revision("o2")}|${pulse}`;
    if (key === tintKey) return;
    tintKey = key;
    const light = grid.raw("light");
    const o2 = grid.raw("o2");
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
      t.spr.tint = lightTint(lv, !t.wall && (o2[t.idx] as number) < VACUUM_O2, pulse);
    }
  }

  return {
    ...markers,
    grid,
    update() {
      const r = grid.revision("struct");
      if (r !== rev || builtGhosts !== ghosts) {
        rebuild();
        rev = r;
      }
      updateDoors();
      updateTints();
      overlay.update();
    },
    setGhosts(on) {
      ghosts = on;
    },
    setOverlay: (f) => overlay.setField(f),
    dispose() {
      clear();
      for (const layer of [L.decal, L.ui])
        for (const c of layer.removeChildren()) c.destroy({ children: true });
    },
  };
}
