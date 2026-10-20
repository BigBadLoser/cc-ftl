import { gridOfShip, shipOf } from '../combat/ships';
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
import { CoreLinkC } from '../robots/components';
import { aiCores, isCoreLive } from '../robots/core';
import { gridIdOf } from '../regions';

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
      const here = shipOf(sim, gridIdOf(sim, pos));
      if (gridIdOf(sim, pos) === ship.gridId || (here && here.faction !== ship.faction)) out.push(id);
      continue;
    }
    const aboard = sim.world.get(id, AboardC);
    const v = aboard && sim.world.get(aboard.vehicle, VehicleC);
    if (v && gridOfShip(sim, v.homeShip) === ship.gridId) out.push(id);
  }
  return out;
}

/** True when every crew member of the ship is downed, surrendered, dead or an inert robot (vacuously so with no crew). */
export function allSubdued(sim: Sim, ship: Ship): boolean {
  return shipCrew(sim, ship).every((c) => isSubdued(sim, c));
}

/**
 * An AI-run ship: rogue, or crewed by core-linked robots. Its AI cores are its will and double as bridges, so it is
 * taken by downing its cores (destroyed, unpowered, ion-disabled or hacked) and holding a bridge, crew or no crew.
 */
export function isAiRun(sim: Sim, ship: Ship): boolean {
  return ship.faction === 'rogue' || shipCrew(sim, ship).some((c) => sim.world.has(c, CoreLinkC));
}

/** True when the ship is ready to be taken: crew all subdued and, for an AI-run ship, no live AI core. */
export function captureReady(sim: Sim, ship: Ship): boolean {
  if (!allSubdued(sim, ship)) return false;
  return !isAiRun(sim, ship) || !aiCores(sim, ship.gridId).some((id) => isCoreLive(sim, id));
}

/** A ship's bridge modules: ModuleDef.bridge, any helm console, and on AI-run ships its AI cores. */
function bridges(sim: Sim, ship: Ship): { id: number; x: number; y: number; holdSec: number; radius: number }[] {
  const out = [];
  const gridId = ship.gridId;
  const aiRun = isAiRun(sim, ship);
  for (const id of sim.world.query(ModuleC)) {
    const m = sim.world.get(id, ModuleC);
    const def = m && gridIdOf(sim, m) === gridId ? sim.content.modules[m.def] : undefined;
    if (!m || !def || (!def.bridge && def.console !== 'helm' && !(aiRun && def.aiCore))) continue;
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
  const list = bridges(sim, ship);
  if (list.length === 0) return null;
  for (const id of sim.world.query(CrewC, PositionC)) {
    const pos = sim.world.get(id, PositionC);
    if (!pos || gridIdOf(sim, pos) !== ship.gridId || sim.world.get(id, AllegianceC)?.faction !== attacker || !isCombatReady(sim, id)) continue;
    for (const b of list) {
      if (Math.max(Math.abs(pos.x - b.x), Math.abs(pos.y - b.y)) <= b.radius) return Math.round(b.holdSec * TICK_HZ);
    }
  }
  return null;
}
