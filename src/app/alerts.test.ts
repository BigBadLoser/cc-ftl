import { describe, expect, it } from 'vitest';
import { CrewC, PositionC, ShipC, newGame, type Sim } from '../sim';
import { content } from '../content';
import { shipGrid } from '../sim/regions';
import { Struct } from '../sim/structure';
import type { UiAlert } from '../ui/api';
import { createAlerts } from './alerts';

function current(a: ReturnType<typeof createAlerts>): UiAlert[] {
  let out: UiAlert[] = [];
  a.list.subscribe((v) => (out = v))();
  return out;
}

/** A new game with a derelict and one of the player's crew standing on it. */
function awayTeam(): { sim: Sim; crew: number } {
  const sim = newGame(1, content);
  sim.enqueue({ type: 'debug.spawnDerelict', faction: 'faction.civilian', seed: 4, depth: 2, cx: 130, cy: 70, intensity: 0.6, cause: 'decay' });
  sim.step();
  const wreck = sim.world.query(ShipC).find((i) => sim.world.get(i, ShipC)?.faction === 'neutral') as number;
  const g = shipGrid(sim, wreck)!;
  let tile = { x: 0, y: 0 };
  for (let y = g.y0; y < g.y0 + g.height && !tile.x; y++) for (let x = g.x0; x < g.x0 + g.width; x++) if (g.get('struct', x, y) === Struct.Floor) { tile = { x, y }; break; }
  const crew = sim.world.query(CrewC)[0] as number;
  const pos = sim.world.get(crew, PositionC)!;
  pos.x = pos.toX = tile.x;
  pos.y = pos.toY = tile.y;
  return { sim, crew };
}

describe('alerts', () => {
  it('raise "is down" for a player crew member down away from the home ship (a derelict)', () => {
    const { sim, crew } = awayTeam();
    const alerts = createAlerts(sim);
    alerts.onEvents([{ type: 'crew.downed', crew }]);
    const list = current(alerts);
    expect(list.map((a) => a.kind)).toEqual(['crew.downed']);
    expect(list[0]?.text).toContain('is down');
  });
});
