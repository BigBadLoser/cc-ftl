import { homeShip } from '../combat/ships';
import { AssignmentC, CrewC, DeadC, DraftedC, JobC, NeedsC, PositionC, PrioritiesC } from '../crew/components';
import { isIncapacitated } from '../crew/helpers';
import { vehicleSuits } from '../eva/shuttle';
import { needsAir } from '../eva/suit';
import { AllegianceC } from '../fight/components';
import { isOffDuty } from '../fight/relations';
import { ferryFree } from '../ferry/pick';
import { shipGrid, shipIdOf } from '../regions';
import { Struct } from '../structure';
import type { Sim } from '../sim';
import { SALVAGE_TEAM, SALVAGE_TEAM_GO, SALVAGE_TEAM_HUNGER, SALVAGE_TEAM_REST } from '../tuning';
import { AboardC, EmbarkOrderC, VehicleC } from '../vehicles/components';
import { vehicleDefOf } from '../vehicles/lifecycle';
import { boardingTile } from '../vehicles/geometry';
import { SalvageCrewC, SalvageTripC } from './components';

/** The shuttle running a salvage shift on this wreck, or 0. */
export function tripFor(sim: Sim, ship: number): number {
  return sim.world.query(SalvageTripC).find((id) => sim.world.get(id, SalvageTripC)?.ship === ship) ?? 0;
}

/** True while a salvage team is at the wreck or on its way back from it (the shuttle has not left its side yet). */
export function teamAt(sim: Sim, ship: number): boolean {
  const id = tripFor(sim, ship);
  const p = id ? sim.world.get(id, SalvageTripC)?.phase : undefined;
  return p === 'fly' || p === 'work' || p === 'recall';
}

/** True while a living crew member of the player's side stands on the ship (the wreck must not go while anyone is on it). */
export function playerCrewOn(sim: Sim, ship: number): boolean {
  for (const id of sim.world.query(CrewC, PositionC)) {
    if (!sim.world.has(id, DeadC) && sim.world.get(id, AllegianceC)?.faction === 'player' && shipIdOf(sim, sim.world.get(id, PositionC)) === ship) return true;
  }
  return false;
}

/**
 * A shuttle that can carry a salvage team: free for a run (ferry rules), has suits (EVA), and sits in a bay on the home ship (the team's
 * ship: a shuttle parked at a claimed base cannot be reached by its crew), so the team can walk to it and climb in.
 */
function teamShuttle(sim: Sim, id: number): boolean {
  const v = sim.world.get(id, VehicleC);
  if (!v || v.state !== 'stowed' || !vehicleDefOf(sim, v)?.eva || vehicleSuits(sim, v) <= 0 || !ferryFree(sim, id)) return false;
  const at = boardingTile(sim, id);
  return !!at && at.shipId === homeShip(sim);
}

/** The lowest-id shuttle free for a salvage team, or 0. */
export function pickTeamShuttle(sim: Sim): number {
  return [...sim.world.query(VehicleC)].sort((a, b) => a - b).find((id) => teamShuttle(sim, id)) ?? 0;
}

/** True if a crew member is rested and fed enough to start a shift (the shift ends at lower levels; see `needsHome`). */
function rested(sim: Sim, id: number): boolean {
  const n = sim.world.get(id, NeedsC);
  return !!n && n.rest >= SALVAGE_TEAM_GO && (n.hunger ?? 100) >= SALVAGE_TEAM_GO;
}

/** True if a team member should come home: tired or hungry (well before they would drop everything to sleep or eat). */
export function needsHome(sim: Sim, id: number): boolean {
  const n = sim.world.get(id, NeedsC);
  return !!n && (n.rest < SALVAGE_TEAM_REST || (n.hunger ?? 100) < SALVAGE_TEAM_HUNGER);
}

/**
 * The crew to send: player crew on the home ship who breathe (suits), are free (not drafted, aboard, off duty or at a console), have
 * construction or hauling switched on and are rested. Best construction priority first (then hauling), then the lowest id. At most SALVAGE_TEAM, the shuttle's suits
 * and seats, and half of the able crew aboard (at least one), so the ship is never emptied. The team must cover both kinds of work (one
 * member with both on, or a builder and a hauler); when no such team can be made it is empty (the order shows 'noCrew').
 */
export function pickTeam(sim: Sim, vehicle: number): number[] {
  const home = boardingTile(sim, vehicle)?.shipId ?? 0; // the crew who can walk to its bay
  const v = sim.world.get(vehicle, VehicleC);
  const def = v && vehicleDefOf(sim, v);
  if (!home || !v || !def) return [];
  let able = 0;
  const free: { id: number; prio: number; build: boolean; haul: boolean }[] = [];
  for (const id of [...sim.world.query(CrewC, PositionC, PrioritiesC, NeedsC)].sort((a, b) => a - b)) {
    if (sim.world.has(id, DeadC) || isIncapacitated(sim, id) || sim.world.get(id, AllegianceC)?.faction !== 'player') continue;
    if (shipIdOf(sim, sim.world.get(id, PositionC)) !== home) continue;
    able++;
    if (sim.world.has(id, DraftedC) || sim.world.has(id, AboardC) || sim.world.has(id, EmbarkOrderC) || sim.world.has(id, SalvageCrewC)) continue;
    if (!needsAir(sim, id) || isOffDuty(sim, id) || !rested(sim, id)) continue;
    const job = sim.world.get(sim.world.get(id, AssignmentC)?.jobId ?? 0, JobC);
    if (job?.kind === 'operate') continue; // on duty at a console
    // Stripping is construction work and carrying the loot is hauling: crew with either switched on can go, builders first.
    const p = sim.world.get(id, PrioritiesC);
    const prio = (p?.construction || 9) * 10 + (p?.hauling || 9);
    if (p && (p.construction > 0 || p.hauling > 0)) free.push({ id, prio, build: p.construction > 0, haul: p.hauling > 0 });
  }
  const n = Math.min(SALVAGE_TEAM, vehicleSuits(sim, v), def.capacity + 1, Math.max(1, Math.floor(able / 2)));
  free.sort((a, b) => a.prio - b.prio || a.id - b.id);
  // The team must both strip and carry: one member with both on, else the best builder and the best hauler as a pair; then the best of the rest.
  const both = free.find((c) => c.build && c.haul);
  const core = both ? [both] : [free.find((c) => c.build), free.find((c) => c.haul)];
  if (core.some((c) => !c) || core.length > n) return [];
  const team = core as typeof free;
  for (const c of free) if (team.length < n && !team.includes(c)) team.push(c);
  return team.sort((a, b) => a.prio - b.prio || a.id - b.id).map((c) => c.id);
}

/** The bounds (sector tiles) of what still stands of a ship: its tiles that are not open space. Null when nothing is left. */
export function liveBox(sim: Sim, ship: number): { x: number; y: number; w: number; h: number } | null {
  const grid = shipGrid(sim, ship);
  if (!grid) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let y = grid.y0; y < grid.y0 + grid.height; y++) {
    for (let x = grid.x0; x < grid.x0 + grid.width; x++) {
      if (grid.get('ship', x, y) !== ship || grid.get('struct', x, y) === Struct.Space) continue;
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
  }
  return x1 < x0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}
