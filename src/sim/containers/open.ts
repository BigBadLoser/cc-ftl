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
 * a seat of deck exactly under its footprint (a one-piece wreck named "Container <id>", nothing visible beyond the box) and a salvage order for its scrap type and the hull is placed on it. From there
 * everything is the general machinery: the salvage planner posts a module-deconstruction job on the box, an EVA crew member goes out (shuttle and away
 * site as for any wreck) and works at it for the def's cut time (`buildWork` x the deconstruction share, at the crew member's construction skill), and
 * only when the job finishes does the module come off and its stock spill onto the deck (`removeModule`), where the staging and shuttle loading fetch it.
 */

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
 * Mark container `id` for opening (see above). Returns the wreck's ship id, or null (nothing changes) when it may not be opened or the seat would overlap a ship or rock. The box keeps its stock, faction, rotation and hit points; it stays a sealed container until the cutting job is done.
 *
 * KNOWN LIMITATION (issue #522, "Crew work at off-grid bodies"): jobs and EVA only work on a ship grid, so a loose box gets a
 * minimal "seat" ship whose tiles are never drawn (`ShipC.unseen`: the scene draws the box only). The real fix is #522; drop the seat then.
 */
export function markForOpening(sim: Sim, id: number): number | null {
  if (openRefusal(sim, id)) return null;
  const c = sim.world.get(id, ContainerC);
  const b = sim.world.get(id, BodyC);
  const def = c && sim.content.modules[c.def];
  if (!c || !b || !def?.scrap) return null;
  const [w, h] = rotatedSize(def, c.rot);
  // The seat stands exactly under the box (its tile footprint, one tile of footing round it): the gap rule's 'tooClose' is waived, overlap still refuses.
  const at = { x: Math.round(b.x - w / 2) - 1, y: Math.round(b.y - h / 2) - 1 };
  if (placementGapError(sim, { ...at, w: w + 2, h: h + 2 }, { crowd: true })) return null;
  growSector(sim, at.x, at.y, w + 2, h + 2); // the sector grows to hold the seat, as it does for any structure
  // The seat is exactly the box's footprint in deck tiles under it (the art covers them), set in one tile of open space: that ring is the crew's footing, as
  // round any hull (a landing needs open space inside the ship's own bounds), and the goods spill onto the footprint when the box comes off. Nothing shows
  // beyond the box.
  const rows = Array.from({ length: h + 2 }, (_, j) => Array.from({ length: w + 2 }, (_, i) => (i === 0 || j === 0 || i === w + 1 || j === h + 1 ? '.' : '_')).join(''));
  const clamp = c.rot % 2 === 0 ? 'n' : 'w';
  const ship = stampShip(sim, {
    name: `Container ${id}`, faction: 'neutral', rows,
    modules: [{ def: c.def, x: 1, y: 1, rot: c.rot, clamp, stock: (sim.world.get(id, StorageC)?.stacks ?? []).map((s) => ({ ...s })) }],
  }, { x: at.x, y: at.y, state: 'wreck', crowd: true });
  const box = sim.world.query(ModuleC).find((m) => shipIdOf(sim, sim.world.get(m, ModuleC)) === ship);
  const kept = box === undefined ? undefined : sim.world.get(box, ContainerC);
  const mod = box === undefined ? undefined : sim.world.get(box, ModuleC);
  if (kept && mod) {
    kept.seed = c.seed ?? id;
    mod.hp = Math.min(mod.hp, Math.max(1, c.hp));
    kept.hp = mod.hp;
  }
  const s = sim.world.get(ship, ShipC);
  if (s) s.unseen = true;
  if (s && c.faction) s.gen = { faction: c.faction, seed: id, depth: 0 };
  sim.world.destroyEntity(id);
  placeSalvageOrder(sim, ship, [def.scrap, 'hull']); // the seat comes down with the box, so nothing is left lying in the node
  sim.events.emit({ type: 'container.marked', container: id, ship });
  return ship;
}
