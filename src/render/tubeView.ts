import type { Sprite } from 'pixi.js';
import type { Grid } from '../sim/grid';
import { Struct } from '../sim/structure';
import { tubeRuns, type TubeRun } from '../sim/tube';
import type { Atlas } from './assets/loader';
import { HullSprite } from './hullPaint';
import { depthKey, iso } from './iso';
import type { Layers } from './layers';
import { mulColor } from './lightTint';
import { addStatic } from './sprites';
import { doorShownOpen, type WallLevel } from './tiles';
import { tubePieces } from './tubeArt';
import type { HullPaint } from './hullArt';

export interface TubeView {
  update(): void;
  dispose(): void;
}

export interface TubeViewHost {
  roofed(): boolean;
  level(): WallLevel;
  hullPaint(): HullPaint;
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
  paint?: number;
  /** Not tinted (a glow). */
  fixed?: boolean;
}

/**
 * A prefab base's tubes (#508): the sprites of each run (tubeArt.ts) in the sorted layer, region-local. Rebuilt when the art, the
 * structure, the doors at the tubes' ends, the roof or the wall view level change; tinted by the grid's light like its tiles.
 */
export function createTubeView(grid: Grid, atlas: Atlas, L: Layers, host: TubeViewHost): TubeView {
  let placed: Placed[] = [];
  let sig = '';
  let tintSig = '';
  let runs: TubeRun[] = [];
  let runsRev = '';

  function clear(): void {
    for (const p of placed) p.spr.destroy();
    placed = [];
  }

  return {
    update() {
      if (!grid.has('tube')) {
        if (placed.length) clear();
        sig = runsRev = '';
        return;
      }
      const roofed = host.roofed(), level = host.level(), paint = host.hullPaint();
      // (the runs read the tube layer and the structure: their floor and end doors)
      const rev = `${grid.revision('struct')}|${grid.revision('tube')}`;
      if (rev !== runsRev) {
        runsRev = rev;
        runs = tubeRuns(grid);
      }
      // A hatch stands open with its door, and once the door is gone (breached: no longer a door tile) the passage shows open.
      const open = (t: { x: number; y: number }) => grid.inBounds(t.x, t.y) && (grid.get('struct', t.x, t.y) !== Struct.Door || doorShownOpen(grid.get('door', t.x, t.y)));
      const next = `${atlas.generation}|${runsRev}|${roofed}|${level}|${paint.armour}/${paint.deco}|${runs.map((r) => `${open(r.far) ? 1 : 0}${open(r.near) ? 1 : 0}`).join('')}`;
      if (next !== sig) {
        sig = next;
        tintSig = '';
        clear();
        for (const r of runs)
          for (const p of tubePieces(r, { level, roofed, farOpen: open(r.far), nearOpen: open(r.near) })) {
            const s = atlas.stat(p.id);
            if (!s) continue;
            const lx = p.x - grid.x0, ly = p.y - grid.y0, z = depthKey(lx, ly) + p.dz;
            const wall = !p.id.startsWith(`tube.${r.axis}.`);
            if (p.paint) {
              const at = iso(lx, ly), spr = new HullSprite(s.tex);
              spr.position.set(Math.round(at.x - s.ax), Math.round(at.y - s.ay));
              spr.zIndex = z;
              L.sorted.addChild(spr);
              placed.push({ spr, x: lx, y: ly, wall, paint: p.paint === 'armour' ? paint.armour : paint.deco });
            } else {
              // (a glow and its halo keep their own colour: only the sprite takes the light)
              const [spr, ...glow] = addStatic(L, s, lx, ly, z, L.sorted) as [Sprite, ...Sprite[]];
              placed.push({ spr, x: lx, y: ly, wall }, ...glow.map((g) => ({ spr: g, x: lx, y: ly, wall, fixed: true })));
            }
          }
      }
      const tk = host.tintKey();
      if (tk === tintSig) return;
      tintSig = tk;
      for (const p of placed) {
        if (p.fixed) continue;
        const lit = host.tintAt(p.x, p.y, p.wall);
        p.spr.tint = p.paint === undefined ? lit : mulColor(lit, p.paint);
      }
    },
    dispose: clear,
  };
}
