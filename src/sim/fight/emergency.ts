import { CrewC, DraftedC, JobC, PathC, PositionC } from '../crew/components';
import { clearPath, isIncapacitated, origin, releaseAssignment } from '../crew/helpers';
import { findPath } from '../crew/pathfind';
import { factionsHostile } from '../combat/factions';
import { shipById } from '../combat/ships';
import { StorageC } from '../items/components';
import { spillItems } from '../items/stacks';
import { storageAdd, storageCount, storageSpace } from '../items/storage';
import { ModuleC } from '../modules/components';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { EMERGENCY_STAND_DOWN_SEC } from '../tuning';
import { atStorage, orderEquip } from './equip';
import { AllegianceC, EmergencyArmC, EquipC, EquipOrderC, StowOrderC } from './components';
import { onRescue } from './rescue';
import { isCombatReady } from './relations';

/** Ids of the player's ships with a hostile crew member (boarder, alien) aboard who is still in the fight. */
function shipsWithIntruders(sim: Sim): Set<number> {
  const out = new Set<number>();
  for (const id of sim.world.query(AllegianceC, PositionC)) {
    const faction = sim.world.get(id, AllegianceC)?.faction;
    if (!factionsHostile(faction, 'player') || !isCombatReady(sim, id)) continue;
    const shipId = shipIdOf(sim, sim.world.get(id, PositionC));
    if (shipById(sim, shipId)?.faction === 'player') out.add(shipId);
  }
  return out;
}

/** True while a rescue job on the ship still waits for someone to take it. */
function rescuePending(sim: Sim, shipId: number): boolean {
  return sim.world.query(JobC).some((j) => {
    const job = sim.world.get(j, JobC);
    return job?.kind === 'rescue' && job.reservedBy === 0 && shipIdOf(sim, job) === shipId;
  });
}

/** Stock of `item` on the ship, less what crew already on their way to the locker will take. */
function freeStock(sim: Sim, shipId: number, item: string): number {
  let n = 0;
  for (const s of sim.world.query(StorageC, ModuleC)) {
    const m = sim.world.get(s, ModuleC);
    if (m && m.hp > 0 && shipIdOf(sim, m) === shipId) n += storageCount(sim, s, item);
  }
  for (const c of sim.world.query(EquipOrderC, PositionC)) {
    if (sim.world.get(c, EquipOrderC)?.item === item && shipIdOf(sim, sim.world.get(c, PositionC)) === shipId) n--;
  }
  return n;
}

/**
 * Emergency arming. While hostile intruders are aboard a player ship, unarmed, undrafted, able player crew whose role has an
 * `emergencyLoadout` fetch the best weapon the ship's storage holds, one crew member per weapon, until the stock runs out
 * (the rest keep hiding). Who goes first: everyone but pilots, in id order; pilots only get what is left. Left out entirely:
 * gunners (their own `playerLoadout` already arms them), the sleeping, the downed or carried, anyone on a rescue job, and
 * a medic while a rescue is still waiting for someone to take it. Once the ship has been clear for EMERGENCY_STAND_DOWN_SEC,
 * emergency-armed crew walk the weapon back to storage (the drop on the floor if every locker is full) and return to work.
 */
export function emergencyArming(sim: Sim): void {
  if (sim.tick % 10 !== 0) return;
  const threatened = shipsWithIntruders(sim);
  standDown(sim, threatened);
  if (threatened.size === 0) return;
  const candidates: { id: number; ship: number; pilot: boolean; items: string[] }[] = [];
  for (const id of sim.world.query(CrewC, PositionC)) {
    const crew = sim.world.get(id, CrewC);
    const role = crew && sim.content.roles[crew.role];
    const items = role?.emergencyLoadout;
    if (!crew || !items || role.playerLoadout || sim.world.get(id, AllegianceC)?.faction !== 'player') continue;
    const ship = shipIdOf(sim, sim.world.get(id, PositionC));
    if (!threatened.has(ship) || !isCombatReady(sim, id) || isIncapacitated(sim, id) || crew.activity === 'sleeping') continue;
    if (sim.world.get(id, EquipC)?.weapon || sim.world.has(id, EquipOrderC) || sim.world.has(id, DraftedC) || onRescue(sim, id)) continue;
    if (crew.role === 'role.medic' && rescuePending(sim, ship)) continue;
    candidates.push({ id, ship, pilot: crew.role === 'role.pilot', items });
  }
  candidates.sort((a, b) => Number(a.pilot) - Number(b.pilot) || a.id - b.id);
  for (const c of candidates) {
    for (const item of c.items) {
      if (freeStock(sim, c.ship, item) <= 0 || orderEquip(sim, c.id, item) !== null) continue;
      sim.world.add(c.id, EmergencyArmC, { item, quietSince: -1 });
      clearPath(sim, c.id); // drop the flee path: the equip order walks them to the locker
      break;
    }
  }
}

/** Track the quiet time of emergency-armed crew and send them to put the weapon back once it has been long enough. */
function standDown(sim: Sim, threatened: ReadonlySet<number>): void {
  for (const id of sim.world.query(EmergencyArmC, PositionC)) {
    const mark = sim.world.get(id, EmergencyArmC);
    if (!mark || sim.world.has(id, EquipOrderC)) continue; // still on the way to the locker
    if (sim.world.has(id, DraftedC) || sim.world.get(id, EquipC)?.weapon !== mark.item) {
      sim.world.remove(id, EmergencyArmC); // the player took over, or the weapon is gone: an ordinary fighter now
      sim.world.remove(id, StowOrderC);
      continue;
    }
    if (threatened.has(shipIdOf(sim, sim.world.get(id, PositionC)))) {
      mark.quietSince = -1;
      if (sim.world.has(id, StowOrderC)) {
        sim.world.remove(id, StowOrderC);
        clearPath(sim, id);
      }
      continue;
    }
    if (mark.quietSince < 0) mark.quietSince = sim.tick;
    if (sim.tick - mark.quietSince < EMERGENCY_STAND_DOWN_SEC * TICK_HZ || sim.world.has(id, StowOrderC) || isIncapacitated(sim, id)) continue;
    const storage = nearestRoom(sim, id, mark.item);
    if (storage) {
      releaseAssignment(sim, id);
      sim.world.add(id, StowOrderC, { storage });
    } else {
      // No locker has room: leave the weapon on the floor rather than stay armed for good.
      const pos = sim.world.get(id, PositionC);
      const eq = sim.world.get(id, EquipC);
      if (pos && eq) spillItems(sim, shipIdOf(sim, pos), pos.toX, pos.toY, mark.item, 1);
      if (eq) eq.weapon = null;
      sim.world.remove(id, EmergencyArmC);
    }
  }
}

/** The nearest storage module on the crew member's ship with room for `item`, or 0. */
function nearestRoom(sim: Sim, crew: number, item: string): number {
  const pos = sim.world.get(crew, PositionC);
  if (!pos) return 0;
  let best = 0;
  let bestD = Infinity;
  for (const s of sim.world.query(StorageC, ModuleC)) {
    const m = sim.world.get(s, ModuleC);
    if (!m || m.hp <= 0 || shipIdOf(sim, m) !== shipIdOf(sim, pos) || storageSpace(sim, s, item) < 1) continue;
    const d = Math.max(Math.abs(m.x - pos.x), Math.abs(m.y - pos.y));
    if (d < bestD) {
      best = s;
      bestD = d;
    }
  }
  return best;
}

/** Walk crew with a stow order to their storage and put the emergency weapon back. */
export function stowOrders(sim: Sim): void {
  for (const id of sim.world.query(StowOrderC, PositionC)) {
    const order = sim.world.get(id, StowOrderC);
    const pos = sim.world.get(id, PositionC);
    const path = sim.world.get(id, PathC);
    const eq = sim.world.get(id, EquipC);
    const mark = sim.world.get(id, EmergencyArmC);
    if (!order || !pos || !path) continue;
    if (!eq?.weapon || !mark || isIncapacitated(sim, id)) {
      sim.world.remove(id, StowOrderC);
      continue;
    }
    const settled = pos.toX === pos.x && pos.toY === pos.y;
    if (atStorage(sim, pos, order.storage) && settled) {
      if (storageAdd(sim, order.storage, eq.weapon, 1) < 1) spillItems(sim, shipIdOf(sim, pos), pos.x, pos.y, eq.weapon, 1);
      eq.weapon = null;
      sim.world.remove(id, StowOrderC);
      sim.world.remove(id, EmergencyArmC);
    } else if (path.steps.length === 0 && settled) {
      const m = sim.world.get(order.storage, ModuleC);
      const steps = m && findPath(sim, shipIdOf(sim, pos), origin(pos), { x: m.x, y: m.y, adjacent: true });
      if (steps) path.steps = steps;
      else sim.world.remove(id, StowOrderC);
    }
  }
}
