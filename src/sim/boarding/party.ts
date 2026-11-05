import { markRaiders } from '../capture/coreRaid';
import { ShipC } from '../combat/components';
import { DeadC, PositionC } from '../crew/components';
import { isIncapacitated } from '../crew/helpers';
import { EquipC } from '../fight/components';
import { ModuleC } from '../modules/components';
import { AirlockC, airlockWorking } from '../modules/airlock';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { BOARDING_MIN_HOME } from '../tuning';
import { VehicleC, type Boarder } from '../vehicles/components';
import { dockError } from '../vehicles/handlers';
import { vehicleDefOf } from '../vehicles/lifecycle';

/** The first free working airlock of the first live player ship, or 0. */
export function pickAirlock(sim: Sim, vehicle: number): number {
  for (const sid of sim.world.query(ShipC)) {
    const s = sim.world.get(sid, ShipC);
    if (s?.faction !== 'player' || (s.state !== 'active' && s.state !== 'disabled')) continue;
    for (const mid of sim.world.query(AirlockC)) {
      if (shipIdOf(sim, sim.world.get(mid, ModuleC)) === sid && airlockWorking(sim, mid) && !dockError(sim, vehicle, mid)) return mid;
    }
  }
  return 0;
}

/**
 * Send a ship's boarding party: the highest-id crew (up to `party`, always leaving BOARDING_MIN_HOME aboard) go to its stowed shuttle (`vehicle.embark`),
 * and `boardingAiSystem` flies it from there. False when there is no shuttle or no airlock to land at yet (the caller tries again); a ship with too few
 * crew to send anyone is finished ('done').
 */
export function startParty(sim: Sim, shipId: number, b: Boarder): boolean {
  const weapon = b.weapon;
  let vehicle = 0;
  for (const vid of sim.world.query(VehicleC)) {
    const v = sim.world.get(vid, VehicleC);
    if (v && v.homeShip === shipId && v.state === 'stowed' && sim.content.vehicles?.[v.def]?.class !== 'pod') {
      vehicle = vid;
      break;
    }
  }
  const v = vehicle ? sim.world.get(vehicle, VehicleC) : undefined;
  if (!v || !pickAirlock(sim, vehicle)) return false; // nothing to fly or nowhere to land yet: try again next tick
  const able = sim.world.query(PositionC).filter((c) =>
    shipIdOf(sim, sim.world.get(c, PositionC)) === shipId && !sim.world.has(c, DeadC) && !isIncapacitated(sim, c));
  const n = Math.min(b.party, (vehicleDefOf(sim, v)?.capacity ?? 0) + 1, able.length - BOARDING_MIN_HOME);
  if (n < 1) {
    b.state = 'done';
    return false;
  }
  b.crew = able.slice(-n);
  if (b.coreRaid) markRaiders(sim, b.crew, shipId);
  b.vehicle = vehicle;
  b.timer = 0;
  b.state = 'loading';
  for (const crew of b.crew) {
    if (weapon) sim.world.add(crew, EquipC, { weapon });
    sim.enqueue({ type: 'vehicle.embark', crew, vehicle });
  }
  return true;
}
