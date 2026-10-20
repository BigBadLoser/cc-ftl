import type { Grid } from '../grid';
import { ModuleC } from '../modules/components';
import { regions } from '../regions';
import type { Sim } from '../sim';
import { Struct } from '../structure';
import { LIGHT_FALLOFF } from '../tuning';

/**
 * The light field is recomputed every tick from powered light modules. A light only reaches
 * tiles of its own room within its radius (walls and closed doors stop it); level falls off
 * linearly with distance. Door tiles (room 0) take the brightest light of their neighbours.
 */
export function lightingSystem(sim: Sim): void {
  for (const { grid } of regions(sim)) {
    if (!grid.has('light') || !grid.has('room')) continue;
    const { width, height } = grid;
    const next = new Uint8Array(width * height);
    const room = grid.load('room');
    for (const id of sim.world.query(ModuleC)) {
      const m = sim.world.get(id, ModuleC);
      const light = m && sim.content.modules[m.def]?.light;
      if (!m || !light || m.gridId !== grid.id || !m.powered || m.hp <= 0) continue;
      // Index the loaded window from its top-left: (mx, my) is the module's tile relative to (x0, y0).
      const mx = m.x - grid.x0, my = m.y - grid.y0;
      const home = room[my * width + mx] as number;
      if (home === 0) continue;
      const r = Math.ceil(light.radius);
      for (let y = Math.max(0, my - r); y <= Math.min(height - 1, my + r); y++) {
        for (let x = Math.max(0, mx - r); x <= Math.min(width - 1, mx + r); x++) {
          const i = y * width + x;
          if (room[i] !== home) continue;
          const d = Math.hypot(x - mx, y - my);
          if (d > light.radius) continue;
          const v = Math.round(light.level * (1 - (LIGHT_FALLOFF * d) / light.radius));
          if (v > (next[i] as number)) next[i] = v;
        }
      }
    }
    spillThroughDoors(grid, next);
    const light = grid.load('light');
    for (let i = 0; i < next.length; i++) {
      if (light[i] !== next[i]) {
        const x = i % width;
        grid.set('light', grid.x0 + x, grid.y0 + (i - x) / width, next[i] as number);
      }
    }
  }
}

/** Open doorways borrow the brightest adjacent room tile, so crew crossing a door are not blacked out. */
function spillThroughDoors(grid: Grid, next: Uint8Array): void {
  const { width, height } = grid;
  const struct = grid.load('struct');
  const door = grid.load('door');
  for (let i = 0; i < next.length; i++) {
    if (struct[i] !== Struct.Door || (door[i] as number) === 0) continue;
    const x = i % width;
    const y = (i - x) / width;
    let best = 0;
    if (x > 0) best = Math.max(best, next[i - 1] as number);
    if (x < width - 1) best = Math.max(best, next[i + 1] as number);
    if (y > 0) best = Math.max(best, next[i - width] as number);
    if (y < height - 1) best = Math.max(best, next[i + width] as number);
    next[i] = best;
  }
}
