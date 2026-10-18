import { shipOf } from '../combat/ships';
import type { Faction, Ship } from '../combat/components';
import { CrewC, PositionC } from '../crew/components';
import { AllegianceC } from '../fight/components';
import { isCombatReady, isSubdued } from '../fight/relations';
import { ModuleC } from '../modules/components';
import { accessTile } from '../modules/footprint';
import type { Sim } from '../sim';
import { CAPTURE_BRIDGE_RADIUS, CAPTURE_HOLD_SEC } from '../tuning';
import { TICK_HZ } from '../time';
import { AboardC, VehicleC } from '../vehicles/components';

/**
 * The crew of a ship: everyone with the ship's allegiance who stands on its grid or rides one of its shuttles, plus
 * its boarders away on a ship of another faction. (A second ship of the same faction does not count.)
 */
export function shipCrew(sim: Sim, ship: Ship): number[] {
  const out: number[] = [];
  for (const id of sim.world.query(CrewC, AllegianceC)) {
    if (sim.world.get(id, AllegianceC)?.faction !== ship.faction) continue;
    const pos = sim.world.get(id, PositionC);
    if (pos) {
      const here = shipOf(sim, pos.gridId);
      if (pos.gridId === ship.gridId || (here && here.faction !== ship.faction)) out.push(id);
      continue;
    }
    const aboard = sim.world.get(id, AboardC);
    const v = aboard && sim.world.get(aboard.vehicle, VehicleC);
    if (v && v.homeGrid === ship.gridId) out.push(id);
  }
  return out;
}

/** True when every crew member of the ship is downed, surrendered or dead. */
export function allSubdued(sim: Sim, ship: Ship): boolean {
  return shipCrew(sim, ship).every((c) => isSubdued(sim, c));
}

/** A ship's bridge modules: ModuleDef.bridge, or any helm console. */
function bridges(sim: Sim, gridId: number): { id: number; x: number; y: number; holdSec: number; radius: number }[] {
  const out = [];
  for (const id of sim.world.query(ModuleC)) {
    const m = sim.world.get(id, ModuleC);
    const def = m && m.gridId === gridId ? sim.content.modules[m.def] : undefined;
    if (!m || !def || (!def.bridge && def.console !== 'helm')) continue;
    const at = accessTile(def, m.x, m.y, m.rot) ?? { x: m.x, y: m.y };
    out.push({ id, x: at.x, y: at.y, holdSec: def.bridge?.holdSec ?? CAPTURE_HOLD_SEC, radius: def.bridge?.radius ?? CAPTURE_BRIDGE_RADIUS });
  }
  return out;
}

/**
 * Does `attacker` hold this ship's bridge now? True when a combat-ready crew member of that side is on the ship's grid
 * within a bridge's radius of its access tile (this includes the one operating it). Returns the ticks the hold takes,
 * or null. "Unopposed" is enforced by the caller: capture needs the whole crew subdued first.
 */
export function bridgeHoldTicks(sim: Sim, ship: Ship, attacker: Faction): number | null {
  const list = bridges(sim, ship.gridId);
  if (list.length === 0) return null;
  for (const id of sim.world.query(CrewC, PositionC)) {
    const pos = sim.world.get(id, PositionC);
    if (!pos || pos.gridId !== ship.gridId || sim.world.get(id, AllegianceC)?.faction !== attacker || !isCombatReady(sim, id)) continue;
    for (const b of list) {
      if (Math.max(Math.abs(pos.x - b.x), Math.abs(pos.y - b.y)) <= b.radius) return Math.round(b.holdSec * TICK_HZ);
    }
  }
  return null;
}
