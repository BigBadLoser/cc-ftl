import { BodyC } from '../body';
import { truceHolds } from '../blackmarket/truce';
import { DroneC } from '../drones/components';
import type { Sim } from '../sim';
import { VEHICLE_PD_FLOOR, VEHICLE_PD_RANGE } from '../tuning';
import { VehicleC } from '../vehicles/components';
import { dockPoint } from '../vehicles/geometry';
import { damageVehicle, vehicleDefOf } from '../vehicles/lifecycle';
import { ProjectileC, ShipC, type Faction, type Target } from './components';
import { isDormant } from './dormant';
import { factionsHostile, rogueAlly } from './factions';
import { shipById } from './ships';

/**
 * Who a ship's defences may shoot (point defence, defence drones): only what is already hostile, so defending never provokes anyone
 * (combat/provoke.ts). Shared by the point-defence system and the drones' `intercept` job.
 */

/** The centre of a ship's rectangle in sector tiles. */
export function shipCentre(sim: Sim, ship: number): { x: number; y: number } | null {
  const s = shipById(sim, ship);
  return s ? { x: s.x + s.width / 2, y: s.y + s.height / 2 } : null;
}

/**
 * True if `ship` and a thing of `faction` (fielded by `homeShip`) are at war: different sides, neither neutral, hostile by the faction rule
 * (the Rogue AI never fights its machine allies). Never during a black-market truce.
 */
export function atWarWith(sim: Sim, ship: number, faction: Faction | undefined, homeShip: number): boolean {
  const mine = shipById(sim, ship)?.faction;
  if (!mine || !faction || mine === 'neutral' || faction === 'neutral' || !factionsHostile(mine, faction) || truceHolds(sim)) return false;
  if (mine === 'rogue' && rogueAlly(sim, homeShip)) return false;
  if (faction === 'rogue' && rogueAlly(sim, ship)) return false;
  return true;
}

/** True while some ship at war with `ship` is in play (active or disabled, awake): its defences have something to defend against. */
export function underThreat(sim: Sim, ship: number): boolean {
  for (const id of sim.world.query(ShipC)) {
    const s = sim.world.get(id, ShipC);
    if (!s || id === ship || (s.state !== 'active' && s.state !== 'disabled') || isDormant(s)) continue;
    if (atWarWith(sim, ship, s.faction, id)) return true;
  }
  return false;
}

/** The ship whose defences cover a shot's target: the ship itself, or a shuttle's home ship while the shuttle is within VEHICLE_PD_RANGE of it. */
export function defenderOf(sim: Sim, t: Target): number {
  if (!t.vehicle) return t.ship;
  const v = sim.world.get(t.vehicle, VehicleC);
  const b = sim.world.get(t.vehicle, BodyC);
  const c = v && shipCentre(sim, v.homeShip);
  if (!v || !b || !c || Math.hypot(b.x - c.x, b.y - c.y) > VEHICLE_PD_RANGE) return 0;
  return v.homeShip;
}

/** Interceptable shots in flight that `ship` defends against (aimed at it, or at its shuttles nearby), ascending ids. */
export function incomingShots(sim: Sim, ship: number): number[] {
  return sim.world.query(ProjectileC).filter((id) => {
    const p = sim.world.get(id, ProjectileC);
    return !!p && !!sim.content.weapons?.[p.weapon]?.interceptable && defenderOf(sim, p.target) === ship;
  });
}

/**
 * True if a shuttle is a threat `ship` may shoot: at war with it, and docked at the ship or flying within `range` tiles of (x, y) (the
 * defender's own position: its ship's centre for point defence, the drone for a drone).
 */
export function shuttleThreat(sim: Sim, ship: number, vid: number, x: number, y: number, range: number): boolean {
  const v = sim.world.get(vid, VehicleC);
  const b = sim.world.get(vid, BodyC);
  if (!v || !b || v.state === 'stowed' || !atWarWith(sim, ship, shipById(sim, v.homeShip)?.faction, v.homeShip)) return false;
  if (v.state === 'docked') return dockPoint(sim, v.dock)?.shipId === ship;
  return Math.hypot(b.x - x, b.y - y) <= range;
}

/** Point defence and drones only chip a shuttle: never below VEHICLE_PD_FLOOR of its max hp. */
export function chipShuttle(sim: Sim, vid: number, damage: number): void {
  const v = sim.world.get(vid, VehicleC);
  if (!v) return;
  const floor = Math.ceil((vehicleDefOf(sim, v)?.maxHp ?? 0) * VEHICLE_PD_FLOOR);
  damageVehicle(sim, vid, Math.max(0, Math.min(damage, v.hp - floor)), 'pointDefence');
}

/** Enemy drones out in space within `range` tiles of (x, y) that `ship` may shoot, nearest first. Ship guns never track a drone. */
export function droneThreats(sim: Sim, ship: number, x: number, y: number, range: number): number[] {
  const out: { id: number; d: number }[] = [];
  for (const id of sim.world.query(DroneC, BodyC)) {
    const d = sim.world.get(id, DroneC);
    const b = sim.world.get(id, BodyC);
    if (!d || !b || d.hp <= 0 || !d.space || d.ship === ship || !atWarWith(sim, ship, shipById(sim, d.ship)?.faction, d.ship)) continue;
    const dist = Math.hypot(b.x - x, b.y - y);
    if (dist <= range) out.push({ id, d: dist });
  }
  return out.sort((a, b) => a.d - b.d || a.id - b.id).map((o) => o.id);
}
