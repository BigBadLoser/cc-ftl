import { CrewC, DeadC, PositionC } from '../crew/components';
import type { Sim } from '../sim';
import { Struct } from '../structure';
import { DOOR_CLOSE_PER_TICK } from '../tuning';

/**
 * Doors open fully while a living crew member is in the doorway or stepping into it, then close
 * at DOOR_CLOSE_PER_TICK (the auto-close timer). Gas flow scales with openness, so a door that is
 * still swinging shut still leaks. Non-door tiles are kept at 0 (a door that was deconstructed).
 */
export function doorsSystem(sim: Sim): void {
  for (const grid of sim.grids.values()) {
    if (!grid.has('door') || !grid.has('struct')) continue;
    const { width } = grid;
    const struct = grid.raw('struct');
    const door = grid.raw('door');
    const used = new Set<number>();
    for (const id of sim.world.query(CrewC, PositionC)) {
      const p = sim.world.get(id, PositionC);
      if (!p || p.gridId !== grid.id || sim.world.has(id, DeadC)) continue;
      used.add(p.y * width + p.x);
      used.add(p.toY * width + p.toX);
    }
    for (let i = 0; i < struct.length; i++) {
      const cur = door[i] as number;
      let next = cur;
      if (struct[i] !== Struct.Door) next = 0;
      else if (used.has(i)) next = 255;
      else if (cur > 0) next = Math.max(0, cur - DOOR_CLOSE_PER_TICK);
      if (next !== cur) {
        const x = i % width;
        grid.set('door', x, (i - x) / width, next);
      }
    }
  }
}
