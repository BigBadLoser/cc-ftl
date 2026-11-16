import { stampShip } from '../combat/ships';
import { BodyC } from '../body';
import { StorageC } from '../items/components';
import { spillItems } from '../items/stacks';
import { rotatedSize } from '../modules/footprint';
import { placementGapError } from '../regions';
import type { Sim } from '../sim';
import { ContainerC } from './components';

/** Search outward (tiles) for a spot the gap rule allows when the box floats too near a ship or rock: the deck settles at the nearest one. */
const SETTLE_MAX = 24;

/** Where a w x h deck can stand: where the box floated, else the nearest legal spot within SETTLE_MAX tiles (rings of 8 directions, nearest first). */
function deckSpot(sim: Sim, x: number, y: number, w: number, h: number): { x: number; y: number } | null {
  for (let r = 0; r <= SETTLE_MAX; r += 2) {
    for (let k = 0; k < (r === 0 ? 1 : 8); k++) {
      const a = (k * Math.PI) / 4;
      const at = { x: Math.round(x + Math.cos(a) * r), y: Math.round(y + Math.sin(a) * r) };
      if (at.x >= 0 && at.y >= 0 && placementGapError(sim, { ...at, w, h }) === null) return at;
    }
  }
  return null;
}

/**
 * Cut a drifting container open: the box becomes a small open deck (a one-piece derelict of floor tiles under its footprint, named "Opened container") with
 * its stock lying on it as loose stacks, and the container entity is gone. From there it is an ordinary wreck: a salvage order opens an away site on it,
 * crew in suits stage the goods and the shuttle loads them (`away/haul.ts`, `items/staging.ts`), so nothing here moves goods anywhere. Returns the deck's
 * ship id, or null (nothing changes) when `id` is no drifting container or the deck would not fit where it floats.
 */
export function openContainer(sim: Sim, id: number): number | null {
  const c = sim.world.get(id, ContainerC);
  const b = sim.world.get(id, BodyC);
  const def = c && sim.content.modules[c.def];
  if (!c || !b || !def?.container || c.state !== 'drifting') return null;
  const [w, h] = rotatedSize(def, c.rot);
  const x = Math.round(b.x - w / 2);
  const y = Math.round(b.y - h / 2);
  const at = deckSpot(sim, x, y, w, h);
  if (!at) return null;
  const ship = stampShip(sim, { name: 'Opened container', rows: Array.from({ length: h }, () => '_'.repeat(w)), faction: 'neutral' }, { x: at.x, y: at.y, state: 'wreck' });
  for (const s of sim.world.get(id, StorageC)?.stacks ?? []) spillItems(sim, ship, at.x + (w >> 1), at.y + (h >> 1), s.item, s.count);
  sim.world.destroyEntity(id);
  sim.events.emit({ type: 'container.opened', container: id, ship });
  return ship;
}
