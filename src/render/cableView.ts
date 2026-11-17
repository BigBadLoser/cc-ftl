import type { World } from '../sim/ecs';
import type { Grid } from '../sim/grid';
import { isCabled } from '../sim/cable';
import { ModuleC } from '../sim/modules/components';
import { rotatedSize } from '../sim/modules/footprint';
import { groundPort, isGroundMount } from '../sim/modules/groundMount';
import { Struct } from '../sim/structure';
import type { Sprite } from 'pixi.js';
import type { Atlas } from './assets/loader';
import { cableTileId, type CableSide } from './groundCable';
import { depthKey } from './iso';
import type { Layers } from './layers';
import { moduleKey, type ModuleDefs } from './moduleView';
import type { ModuleDef } from '../sim/registry';
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
/**
 * The depth key of a cabled tile (x, y), in grid-local tiles: `depthKey`, except beside a ground piece's +x or +y face, where the tile is in
 * front of the piece (its sprite stands up over the face) and so draws after it, just over the piece's own key. Tiles beside its -x or -y face
 * sort before it already. `pieces` are the ground mounts and pads, in the same tile frame.
 */
export function cableDepth(x: number, y: number, pieces: readonly { def: ModuleDef; x: number; y: number; rot: number }[]): number {
  let d = depthKey(x, y);
  for (const p of pieces) {
    const [w, h] = rotatedSize(p.def, p.rot);
    const x1 = p.x + w, y1 = p.y + h;
    if ((x === x1 && y >= p.y && y < y1) || (y === y1 && x >= p.x && x < x1)) d = Math.max(d, moduleKey(p.def, x1 - 1, y1 - 1) + 0.01);
  }
  return d;
}

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
      const pieces: { def: ModuleDef; x: number; y: number; rot: number }[] = [];
      let powered = false;
      let mounts = 0;
      for (const id of world.query(ModuleC)) {
        const m = world.get(id, ModuleC);
        const def = m && defs[m.def];
        if (!m || !def || !isGroundMount(def) || !grid.inBounds(m.x, m.y)) continue;
        const p = groundPort(def, m);
        ports.set(`${p.cable.x},${p.cable.y}`, `${p.side.x},${p.side.y}`);
        mounts++;
        pieces.push({ def, x: m.x - grid.x0, y: m.y - grid.y0, rot: m.rot });
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
          if (s) sprites.push(...addStatic(L, s, x - grid.x0, y - grid.y0, cableDepth(x - grid.x0, y - grid.y0, pieces), L.sorted));
        }
      }
    },
    dispose: clear,
  };
}
