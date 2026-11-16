import { stampShip } from '../combat/ships';
import { ShipC } from '../combat/components';
import { BodyC } from '../body';
import { StorageC } from '../items/components';
import { ModuleC } from '../modules/components';
import { rotatedSize } from '../modules/footprint';
import { growSector } from '../galaxy/populateSpawn';
import { placementGapError, shipIdOf } from '../regions';
import { placeSalvageOrder } from '../salvage/handlers';
import type { Sim } from '../sim';
import { ContainerC } from './components';

/**
 * Opening a lost container is salvage work, not a switch. `container.open` (the player's order) marks the drifting box for cutting: the box is seated on
 * a small wreck frame (a bed of beams, a ring of deck and a ring of open space, named "Container <id>") and a salvage order for its scrap type is placed on that wreck. From there
 * everything is the general machinery: the salvage planner posts a module-deconstruction job on the box, an EVA crew member goes out (shuttle and away
 * site as for any wreck) and works at it for the def's cut time (`buildWork` x the deconstruction share, at the crew member's construction skill), and
 * only when the job finishes does the module come off and its stock spill onto the deck (`removeModule`), where the staging and shuttle loading fetch it.
 */

/** Search outward (tiles) for a spot the gap rule allows when the box floats too near a ship or rock: the frame settles at the nearest one. */
const SETTLE_MAX = 48;

/** Where a w x h frame can stand: where the box floated, else the nearest legal spot within SETTLE_MAX tiles (rings of 16 directions, nearest first). */
function frameSpot(sim: Sim, x: number, y: number, w: number, h: number): { x: number; y: number } | null {
  for (let r = 0; r <= SETTLE_MAX; r += 2) {
    for (let k = 0; k < (r === 0 ? 1 : 16); k++) {
      const a = (k * Math.PI) / 8;
      const at = { x: Math.max(0, Math.round(x + Math.cos(a) * r)), y: Math.max(0, Math.round(y + Math.sin(a) * r)) };
      if (placementGapError(sim, { ...at, w, h }) === null) return at;
    }
  }
  return null;
}

/** The one rule for whether a container may be marked for opening: a drifting container body whose def can be cut (has a scrap type). Returns the reason it may not, or null. */
export function openRefusal(sim: Sim, id: number): string | null {
  const c = sim.world.get(id, ContainerC);
  const def = c && sim.content.modules[c.def];
  return c && c.state === 'drifting' && sim.world.has(id, BodyC) && def?.container && def.scrap ? null : 'notDriftingContainer';
}

/** The drifting container whose footprint covers sector point (x, y), or null: what a click on loose cargo means. */
export function containerAt(sim: Sim, x: number, y: number): number | null {
  for (const id of sim.world.query(ContainerC, BodyC)) {
    const c = sim.world.get(id, ContainerC);
    const b = sim.world.get(id, BodyC);
    const def = c && sim.content.modules[c.def];
    if (!c || !b || !def || openRefusal(sim, id)) continue;
    const [w, h] = rotatedSize(def, c.rot);
    if (Math.abs(x - b.x) <= w / 2 && Math.abs(y - b.y) <= h / 2) return id;
  }
  return null;
}

/**
 * Mark container `id` for opening (see above). Returns the wreck's ship id, or null (nothing changes) when it may not be opened or no room is found for
 * the frame. The box keeps its stock, faction, rotation and hit points; it stays a sealed container until the cutting job is done.
 */
export function markForOpening(sim: Sim, id: number): number | null {
  if (openRefusal(sim, id)) return null;
  const c = sim.world.get(id, ContainerC);
  const b = sim.world.get(id, BodyC);
  const def = c && sim.content.modules[c.def];
  if (!c || !b || !def?.scrap) return null;
  const [w, h] = rotatedSize(def, c.rot);
  const at = frameSpot(sim, Math.round(b.x - w / 2) - 2, Math.round(b.y - h / 2) - 2, w + 4, h + 4);
  if (!at) return null;
  // From the inside out: a bed of beams the box sits on (not drawn under a container), a ring of deck its goods spill onto and the crew work from, and a
  // ring of open space, the suited crew's footing at the hull as round any ship (a landing needs open space touching the hull).
  const ring = (i: number, j: number): number => Math.min(i, j, w + 3 - i, h + 3 - j);
  const rows = Array.from({ length: h + 4 }, (_, j) => Array.from({ length: w + 4 }, (_, i) => ['.', '_'][ring(i, j)] ?? '=').join(''));
  const clamp = c.rot % 2 === 0 ? 'n' : 'w';
  growSector(sim, at.x, at.y, w + 4, h + 4); // the sector grows to hold the frame, as it does for any structure
  const ship = stampShip(sim, {
    name: `Container ${id}`, faction: 'neutral', rows,
    modules: [{ def: c.def, x: 2, y: 2, rot: c.rot, clamp, stock: (sim.world.get(id, StorageC)?.stacks ?? []).map((s) => ({ ...s })) }],
  }, { x: at.x, y: at.y, state: 'wreck' });
  const box = sim.world.query(ModuleC).find((m) => shipIdOf(sim, sim.world.get(m, ModuleC)) === ship);
  const kept = box === undefined ? undefined : sim.world.get(box, ContainerC);
  const mod = box === undefined ? undefined : sim.world.get(box, ModuleC);
  if (kept && mod) {
    kept.seed = c.seed ?? id;
    mod.hp = Math.min(mod.hp, Math.max(1, c.hp));
    kept.hp = mod.hp;
  }
  const s = sim.world.get(ship, ShipC);
  if (s && c.faction) s.gen = { faction: c.faction, seed: id, depth: 0 };
  sim.world.destroyEntity(id);
  placeSalvageOrder(sim, ship, [def.scrap]);
  sim.events.emit({ type: 'container.marked', container: id, ship });
  return ship;
}
