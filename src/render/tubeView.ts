import type { Sprite } from 'pixi.js';
import type { Grid } from '../sim/grid';
import { Struct } from '../sim/structure';
import { tubeRuns, type TubeRun } from '../sim/tube';
import type { Atlas } from './assets/loader';
import { depthKey } from './iso';
import type { Layers } from './layers';
import { addStatic } from './sprites';
import { tubePieces } from './tubeArt';

export interface TubeView {
  update(): void;
  dispose(): void;
}

export interface TubeViewHost {
  roofed(): boolean;
  /** The grid's light tint of a region-local tile (gridView.tintAt), and its change key. */
  tintAt(x: number, y: number, wall: boolean): number;
  tintKey(): string;
}

interface Placed {
  spr: Sprite;
  x: number;
  y: number;
  /** Lit as a wall (the brightest light round it) or as its tile's floor (the glass). */
  wall: boolean;
  /** Not tinted (a glow). */
  fixed?: boolean;
}

/**
 * A prefab base's tubes (#508): the sprites of each run (tubeArt.ts) in the sorted layer, region-local. Rebuilt when the art, the
 * structure, the doors at the tubes' ends or the roof change; tinted by the grid's light like its tiles.
 */
export function createTubeView(grid: Grid, atlas: Atlas, L: Layers, host: TubeViewHost): TubeView {
  let placed: Placed[] = [];
  let sig = '';
  let tintSig = '';
  let runs: TubeRun[] = [];
  let runsRev = -1;

  function clear(): void {
    for (const p of placed) p.spr.destroy();
    placed = [];
  }

  return {
    update() {
      if (!grid.has('tube')) return;
      const roofed = host.roofed();
      // (the tube layer moves only with the structure: writeStruct clears it, stamping writes both)
      if (grid.revision('struct') !== runsRev) {
        runsRev = grid.revision('struct');
        runs = tubeRuns(grid);
      }
      // A hatch stands open with its door, and once the door is gone (breached: no longer a door tile) the passage shows open.
      const open = (t: { x: number; y: number }) => grid.inBounds(t.x, t.y) && (grid.get('struct', t.x, t.y) !== Struct.Door || grid.get('door', t.x, t.y) > 128);
      const next = `${atlas.generation}|${grid.revision('struct')}|${roofed}|${runs.map((r) => `${open(r.far) ? 1 : 0}${open(r.near) ? 1 : 0}`).join('')}`;
      if (next !== sig) {
        sig = next;
        tintSig = '';
        clear();
        for (const r of runs)
          for (const p of tubePieces(r, { roofed, farOpen: open(r.far), nearOpen: open(r.near) })) {
            const s = atlas.stat(p.id);
            if (!s) continue;
            const lx = p.x - grid.x0, ly = p.y - grid.y0, z = depthKey(lx, ly) + p.dz;
            const wall = !p.id.startsWith(`tube.${r.axis}.`);
            // (a glow and its halo keep their own colour: only the sprite takes the light)
            const [spr, ...glow] = addStatic(L, s, lx, ly, z, L.sorted) as [Sprite, ...Sprite[]];
            placed.push({ spr, x: lx, y: ly, wall }, ...glow.map((g) => ({ spr: g, x: lx, y: ly, wall, fixed: true })));
          }
      }
      const tk = host.tintKey();
      if (tk === tintSig) return;
      tintSig = tk;
      for (const p of placed) {
        if (p.fixed) continue;
        p.spr.tint = host.tintAt(p.x, p.y, p.wall);
      }
    },
    dispose: clear,
  };
}
