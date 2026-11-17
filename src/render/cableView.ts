import type { World } from '../sim/ecs';
import type { Grid } from '../sim/grid';
import { isCabled } from '../sim/cable';
import { ModuleC } from '../sim/modules/components';
import { groundPort, isGroundMount } from '../sim/modules/groundMount';
import { Struct } from '../sim/structure';
import type { Sprite } from 'pixi.js';
import type { Atlas } from './assets/loader';
import { cableTileId, type CableSide } from './groundCable';
import { depthKey } from './iso';
import type { Layers } from './layers';
import type { ModuleDefs } from './moduleView';
import { addStatic } from './sprites';

export interface CableView {
  update(): void;
  dispose(): void;
}

/**
 * Ground power cable tiles (#514), `cable.duct.*` (groundCable.ts), one sprite per cabled tile of the ship's grid. A side counts as 'wall'
 * where the cable plugs into a hull wall or into a ground mount's port (groundMount.ts). Drawn in the sorted layer at the tile's depth
 * (`depthKey`): a solid module sorts at its front tile's depth minus 0.05, so a cable tile at that depth or in front of it draws after the
 * module, one further back before it. Rebuilt when the art, the mounts or their power change.
 */
export function createCableView(grid: Grid, atlas: Atlas, L: Layers, world: World, defs: ModuleDefs): CableView {
  let sprites: Sprite[] = [];
  let sig = '';

  function clear(): void {
    for (const s of sprites) s.destroy();
    sprites = [];
  }

  return {
    update() {
      if (!grid.has('cable')) return;
      // The ground mounts on this grid: their ports and whether any is powered.
      const ports = new Map<string, string>();
      let powered = false;
      let mounts = 0;
      for (const id of world.query(ModuleC)) {
        const m = world.get(id, ModuleC);
        const def = m && defs[m.def];
        if (!m || !def || !isGroundMount(def) || !grid.inBounds(m.x, m.y)) continue;
        const p = groundPort(def, m);
        ports.set(`${p.cable.x},${p.cable.y}`, `${p.side.x},${p.side.y}`);
        mounts++;
        if (m.powered && m.hp > 0) powered = true;
      }
      const next = `${atlas.generation}|${grid.revision('cable')}|${mounts}|${[...ports].map(([k, v]) => `${k}>${v}`).sort().join(';')}|${powered ? 1 : 0}`;
      if (next === sig) return;
      sig = next;
      clear();
      for (let y = grid.y0; y < grid.y0 + grid.height; y++) {
        for (let x = grid.x0; x < grid.x0 + grid.width; x++) {
          if (!isCabled(grid, x, y)) continue;
          const side = (dx: number, dy: number): CableSide => {
            const nx = x + dx, ny = y + dy;
            if (isCabled(grid, nx, ny)) return 'cable';
            if (ports.get(`${x},${y}`) === `${nx},${ny}`) return 'wall';
            return grid.inBounds(nx, ny) && grid.get('struct', nx, ny) === Struct.Wall ? 'wall' : null;
          };
          const s = atlas.stat(cableTileId(side, x, y, powered));
          if (s) sprites.push(...addStatic(L, s, x - grid.x0, y - grid.y0, depthKey(x - grid.x0, y - grid.y0), L.sorted));
        }
      }
    },
    dispose: clear,
  };
}
