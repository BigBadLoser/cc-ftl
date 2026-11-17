import { Struct, playerShipId, shipGrid, type Command, type Sim } from '../../../sim';
import { definePreset } from '../types';

/** Thin air on one side of the first vented-door candidate, and its vent opened. */
function ventCommands(sim: Sim): Command[] {
  const ship = playerShipId(sim);
  const grid = shipGrid(sim, ship);
  if (!grid) return [];
  const floor = (x: number, y: number): boolean => grid.inBounds(x, y) && grid.get('struct', x, y) === Struct.Floor;
  for (let y = grid.y0; y < grid.y0 + grid.height; y++) {
    for (let x = grid.x0; x < grid.x0 + grid.width; x++) {
      if (grid.get('struct', x, y) !== Struct.Door || grid.get('module', x, y) !== 0) continue; // an airlock's door has no vent
      const dir = floor(x - 1, y) && floor(x + 1, y) ? [1, 0] : floor(x, y - 1) && floor(x, y + 1) ? [0, 1] : null;
      if (!dir) continue;
      return [
        ...[1, 2, 3].map((k): Command => ({ type: 'debug.setField', ship, x: x - dir[0]! * k, y: y - dir[1]! * k, field: 'o2', value: 14 })),
        { type: 'door.vent', ship, x, y, open: true },
      ];
    }
  }
  return [];
}

/**
 * `?scenario=vents`: the first door of the player's ship that has floor on two opposite sides gets its vent opened, with thin air (14 kPa O2) on one side, so
 * pressure evens out through the shut door. Select the door to see the toggle in its inspector.
 */
export default definePreset({
  doc: 'A vented door with thin air on one side.',
  spec: () => ({ steps: [{ cmds: (ctx) => ventCommands(ctx.sim) }], ui: { speed: 1 } }),
});
