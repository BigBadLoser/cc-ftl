import { describe, expect, it } from 'vitest';
import { ShipC, Struct, newGame, type Sim } from '../sim';
import { materialiseFleet } from '../sim/galaxy/fleetShips';
import { isHostileFaction } from '../sim/galaxy/standing';
import { provoke } from '../sim/combat/provoke';
import { shipGrid } from '../sim/regions';
import type { Fleet } from '../sim/galaxy/types';
import { content } from '../content';
import { aimable } from './aiming';

/** A neutral fleet ship made real in the player's node, and one of its hull tiles. */
function neutralShip(): { sim: Sim; ship: number; x: number; y: number } {
  const sim = newGame(24, content);
  const g = sim.galaxy;
  const f = g.fleets.find((x) => x.ships.length > 0 && !isHostileFaction(sim, x.faction)) as Fleet;
  Object.assign(f, { node: g.current, from: g.current, route: [], dwell: 99, synced: g.turn });
  materialiseFleet(sim, f);
  const ship = f.ships[0]?.ship as number;
  const s = sim.world.get(ship, ShipC) as { x: number; y: number; width: number; height: number };
  const grid = shipGrid(sim, ship);
  for (let y = s.y; y < s.y + s.height; y++)
    for (let x = s.x; x < s.x + s.width; x++) if (grid?.inBounds(x, y) && grid.get('struct', x, y) !== Struct.Space) return { sim, ship, x, y };
  throw new Error('no hull tile');
}

describe('aimable', () => {
  it('a ship that is not hostile can be aimed at only at battle stations; once provoked, always', () => {
    const { sim, ship, x, y } = neutralShip();
    expect(sim.world.get(ship, ShipC)?.faction).toBe('neutral');
    expect(aimable(sim, ship, x, y)).toBe(false);
    sim.sector.stations = true;
    expect(aimable(sim, ship, x, y)).toBe(true);
    delete sim.sector.stations;
    provoke(sim, ship, 'fired');
    expect(aimable(sim, ship, x, y)).toBe(true);
  });
});
