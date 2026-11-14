import { ModuleC, type Sim } from '../sim';
import { fullSlabs, slabDraining, slabInfo, slabPlace } from '../sim/stasis/query';
import { RESERVE_TICKS } from '../sim/stasis/tuning';
import { TICK_HZ } from '../sim/time';
import { playerShips } from '../sim/story/world';
import type { UiSubject } from '../ui/api';
import { tileAt } from './subjects';

/**
 * The urgent stasis alert (state, not events): while any full slab on the player's ships runs on its reserve (an unpowered or wrecked wheel,
 * or lying on the floor), how many and the time the first one has left; the jump target is that slab. Null when none is draining.
 */
export function stasisFailing(sim: Sim): { text: string; subject: UiSubject | null } | null {
  const ships = playerShips(sim);
  let n = 0;
  let worst: { left: number; subject: UiSubject | null } | null = null;
  for (const id of fullSlabs(sim)) {
    const place = slabPlace(sim, id);
    if (!place || !ships.has(place.ship) || !slabDraining(sim, id)) continue;
    n++;
    const left = (slabInfo(sim, id)?.reserve ?? 0) * RESERVE_TICKS / TICK_HZ;
    const tile = place.kind === 'floor' ? place.tiles[0] : null;
    const subject = tile ? tileAt(tile.x, tile.y) : place.kind === 'wheel' ? wheelTile(sim, place.wheel) : null;
    if (!worst || left < worst.left) worst = { left, subject };
  }
  if (!worst) return null;
  const sec = Math.ceil(worst.left);
  const clock = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  return { text: `Stasis failing: ${n === 1 ? 'a prisoner thaws' : `${n} prisoners thaw`} in ${clock}`, subject: worst.subject };
}

function wheelTile(sim: Sim, wheel: number): UiSubject | null {
  const m = sim.world.get(wheel, ModuleC);
  return m ? tileAt(m.x, m.y) : null;
}
