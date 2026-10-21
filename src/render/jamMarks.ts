import { Graphics } from 'pixi.js';
import type { Grid } from '../sim/grid';
import { DoorJam, Struct } from '../sim/structure';
import type { Atlas } from './assets/loader';
import { depthKey, iso } from './iso';
import type { Layers } from './layers';
import { regionTiles } from './regionTiles';
import { addStatic } from './sprites';
import type { Sprite } from 'pixi.js';

/**
 * Jammed-door markers: `tile.door.jammed` where the art exists, else a procedural chevron on the door (PLACEHOLDER until
 * real art lands): red for a door jammed shut, amber for one jammed open. Rebuilt when the `jam` field changes.
 */
export interface JamMarks {
  update(): void;
  dispose(): void;
}

const RED = 0xff4d4d;
const AMBER = 0xf5a623;
/** Height of the chevrons above the door's floor centre, art px (about mid-door). */
const LIFT = 26;

export function createJamMarks(grid: Grid, atlas: Atlas, L: Layers): JamMarks {
  const tiles = regionTiles(grid);
  let owned: (Sprite | Graphics)[] = [];
  let rev = -1;
  let tick = 0;

  function clear(): void {
    for (const o of owned) o.destroy();
    owned = [];
  }

  function chevrons(color: number): Graphics {
    const g = new Graphics();
    for (const dy of [0, 7]) g.poly([-9, -4 + dy, 0, 3 + dy, 9, -4 + dy, 9, -8 + dy, 0, -1 + dy, -9, -8 + dy]).fill({ color }).stroke({ color: 0x20080a, width: 1 });
    return g;
  }

  function rebuild(): void {
    clear();
    if (!grid.has('jam')) return;
    const art = atlas.stat('tile.door.jammed');
    for (let y = 0; y < tiles.height; y++)
      for (let x = 0; x < tiles.width; x++) {
        const j = tiles.get('jam', x, y);
        if (j === DoorJam.None || tiles.get('struct', x, y) !== Struct.Door) continue;
        if (art) {
          owned.push(...addStatic(L, art, x, y, depthKey(x, y) + 0.02));
          continue;
        }
        const g = chevrons(j === DoorJam.Shut ? RED : AMBER);
        const p = iso(x, y);
        g.position.set(p.x, p.y - LIFT);
        g.zIndex = depthKey(x, y) + 0.02;
        L.sorted.addChild(g);
        owned.push(g);
      }
  }

  return {
    update() {
      const r = grid.has('jam') ? grid.revision('jam') + grid.revision('struct') * 1e6 : -2;
      if (r !== rev) {
        rev = r;
        rebuild();
      }
      if (owned.length && ++tick % 3 === 0) {
        const a = 0.75 + 0.25 * Math.sin(performance.now() / 260);
        for (const o of owned) o.alpha = a;
      }
    },
    dispose: clear,
  };
}
