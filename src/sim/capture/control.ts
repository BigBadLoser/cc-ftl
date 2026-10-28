
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
import { shipIdOf } from '../regions';
import { neverSurrenders } from '../combat/factions';
import { shipById } from '../combat/ships';
import { ShipC } from '../combat/components';

/**
 * The crew of a ship: everyone with the ship's allegiance who stands on its grid or rides one of its shuttles, plus
 * its boarders away on a ship of another faction. (A second ship of the same faction does not count.)
 */
export function shipCrew(sim: Sim, shipId: number): number[] {
  const ship = sim.world.get(shipId, ShipC) as Ship;
  const out: number[] = [];
  for (const id of sim.world.query(CrewC, AllegianceC)) {
    if (sim.world.get(id, AllegianceC)?.faction !== ship.faction) continue;
    const pos = sim.world.get(id, PositionC);
    if (pos) {
      const here = shipById(sim, shipIdOf(sim, pos));
      if (shipIdOf(sim, pos) === shipId || (here && here.faction !== ship.faction)) out.push(id);
      continue;
    }
    const aboard = sim.world.get(id, AboardC);
    const v = aboard && sim.world.get(aboard.vehicle, VehicleC);
    if (v && v.homeShip === shipId) out.push(id);
  }
  return out;
}

/** True when every crew member of the ship is downed, surrendered, dead or an inert robot (vacuously so with no crew). */
export function allSubdued(sim: Sim, shipId: number): boolean {
  return shipCrew(sim, shipId).every((c) => isSubdued(sim, c));
}

/**
 * An AI-run ship: rogue, or crewed by core-linked robots. Its AI cores are its will and double as bridges, so it is
 * taken by downing its cores (destroyed, unpowered, ion-disabled or hacked) and holding a bridge, crew or no crew.
 */
export function isAiRun(sim: Sim, shipId: number): boolean {
  return sim.world.get(shipId, ShipC)?.faction === 'rogue' || shipCrew(sim, shipId).some((c) => sim.world.has(c, CoreLinkC));
}

/** True when the ship is ready to be taken: crew all subdued and, for an AI-run ship, no live AI core. */
export function captureReady(sim: Sim, shipId: number): boolean {
  if (neverSurrenders(sim, shipId)) return false;
  if (!allSubdued(sim, shipId)) return false;
  return !isAiRun(sim, shipId) || !aiCores(sim, shipId).some((id) => isCoreLive(sim, id));
}

/** A ship's bridge modules: ModuleDef.bridge, any helm console, and on AI-run ships its AI cores. */
function bridges(sim: Sim, shipId: number): { id: number; x: number; y: number; holdSec: number; radius: number }[] {
  const out = [];
  const aiRun = isAiRun(sim, shipId);
  for (const id of sim.world.query(ModuleC)) {
    const m = sim.world.get(id, ModuleC);
    const def = m && shipIdOf(sim, m) === shipId ? sim.content.modules[m.def] : undefined;
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
export function bridgeHoldTicks(sim: Sim, shipId: number, attacker: Faction): number | null {
  const list = bridges(sim, shipId);
  if (list.length === 0) return null;
  for (const id of sim.world.query(CrewC, PositionC)) {
    const pos = sim.world.get(id, PositionC);
    if (!pos || shipIdOf(sim, pos) !== shipId || sim.world.get(id, AllegianceC)?.faction !== attacker || !isCombatReady(sim, id)) continue;
    for (const b of list) {
      if (Math.max(Math.abs(pos.x - b.x), Math.abs(pos.y - b.y)) <= b.radius) return Math.round(b.holdSec * TICK_HZ);
    }
  }
  return null;
}
