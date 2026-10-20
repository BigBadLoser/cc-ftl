import { shipIdOf } from '../regions';
import { CrewC, DeadC, PositionC } from '../crew/components';
import { AirlockC } from '../modules/airlock';
import { regions } from '../regions';
import type { Sim } from '../sim';
import { Struct } from '../structure';
import { DOOR_CLOSE_PER_TICK } from '../tuning';

/**
 * Doors open fully while a living crew member is in the doorway or stepping into it, then close
 * at DOOR_CLOSE_PER_TICK (the auto-close timer). Gas flow scales with openness, so a door that is
 * still swinging shut still leaks. Non-door tiles are kept at 0 (a door that was deconstructed).
 */
export function doorsSystem(sim: Sim): void {
  for (const { grid } of regions(sim)) {
    if (!grid.has('door') || !grid.has('struct')) continue;
    const { width } = grid;
    const struct = grid.load('struct');
    const door = grid.load('door');
    const modules = grid.has('module') ? grid.load('module') : null;
    const used = new Set<number>();
    for (const id of sim.world.query(CrewC, PositionC)) {
      const p = sim.world.get(id, PositionC);
      if (!p || shipIdOf(sim, p) !== grid.id || sim.world.has(id, DeadC)) continue;
      used.add((p.y - grid.y0) * width + (p.x - grid.x0));
      used.add((p.toY - grid.y0) * width + (p.toX - grid.x0));
    }
    for (let i = 0; i < struct.length; i++) {
      const cur = door[i] as number;
      if (struct[i] === Struct.Door && isAirlockDoor(sim, modules, i)) continue; // the airlock system owns these
      let next = cur;
      if (struct[i] !== Struct.Door) next = 0;
      else if (used.has(i)) next = 255;
      else if (cur > 0) next = Math.max(0, cur - DOOR_CLOSE_PER_TICK);
      if (next !== cur) {
        const x = i % width;
        grid.set('door', grid.x0 + x, grid.y0 + (i - x) / width, next);
      }
    }
  }
}

function isAirlockDoor(sim: Sim, modules: Float64Array | null, i: number): boolean {
  if (!modules) return false;
  const id = modules[i] as number;
  return id !== 0 && sim.world.has(id, AirlockC);
}
