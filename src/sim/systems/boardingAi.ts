import { ShipC } from '../combat/components';
import { DeadC, PositionC } from '../crew/components';
import { isIncapacitated } from '../crew/helpers';
import { ModuleC } from '../modules/components';
import { airlockWorking } from '../portals/airlock';
import { AirlockC } from '../portals/components';
import type { Sim } from '../sim';
import { BOARDING_LOAD_TICKS, BOARDING_MIN_HOME } from '../tuning';
import { BoarderC, EmbarkOrderC, VehicleC, type Boarder } from '../vehicles/components';
import { dockError } from '../vehicles/handlers';
import { vehicleDefOf } from '../vehicles/lifecycle';

/**
 * Enemy boarding doctrine (ships whose template has `boarding`; see BoarderC). Deterministic, command-only:
 * idle until `afterTicks` of combat pass or the ship is losing (fewer than half its weapons work, or integrity under
 * `losingBelow`). Then the highest-id crew (up to `party`, always leaving BOARDING_MIN_HOME aboard) are ordered into the
 * stowed shuttle; when they are aboard (or BOARDING_LOAD_TICKS pass) the shuttle is sent to dock at the first free,
 * working airlock of the first live player ship; once docked everyone disembarks into that ship, pilot last.
 * A shuttle that is shot down ends the attempt ('done'); one whose dock failed tries another airlock.
 */
export function boardingAiSystem(sim: Sim): void {
  for (const id of sim.world.query(BoarderC, ShipC)) {
    const b = sim.world.get(id, BoarderC) as Boarder;
    const ship = sim.world.get(id, ShipC)!;
    if (b.state === 'done' || ship.faction !== 'hostile' || ship.state !== 'active') continue;
    const v = b.vehicle ? sim.world.get(b.vehicle, VehicleC) : undefined;
    if (b.state === 'idle') {
      if (!sim.sector.inCombat) continue;
      b.timer++;
      if (b.timer >= b.afterTicks || losing(sim, ship.gridId, ship.integrity, b.losingBelow)) start(sim, ship.gridId, b);
    } else if (!v) {
      b.state = 'done';
    } else if (b.state === 'loading') {
      b.timer++;
      const waiting = b.crew.filter((c) => sim.world.has(c, EmbarkOrderC));
      if (waiting.length > 0 && b.timer < BOARDING_LOAD_TICKS) continue;
      for (const c of waiting) sim.world.remove(c, EmbarkOrderC);
      const airlock = pickAirlock(sim, b.vehicle);
      if (!v.pilot || !airlock) b.state = 'done';
      else {
        sim.enqueue({ type: 'vehicle.dock', vehicle: b.vehicle, airlock });
        b.state = 'sent';
      }
    } else if (b.state === 'sent') {
      if (v.state === 'docked') {
        sim.enqueue({ type: 'vehicle.disembark', vehicle: b.vehicle });
        if (v.pilot) sim.enqueue({ type: 'vehicle.disembark', vehicle: b.vehicle, crew: v.pilot });
        b.state = 'landed';
      } else if (v.state === 'flying' && !v.dest) {
        const airlock = pickAirlock(sim, b.vehicle);
        if (airlock) sim.enqueue({ type: 'vehicle.dock', vehicle: b.vehicle, airlock });
        else b.state = 'done';
      }
    } else {
      b.state = 'done';
    }
  }
}

function losing(sim: Sim, gridId: number, integrity: number, below: number): boolean {
  let total = 0;
  let working = 0;
  for (const mid of sim.world.query(ModuleC)) {
    const m = sim.world.get(mid, ModuleC);
    if (!m || m.gridId !== gridId || !sim.content.modules[m.def]?.weapon) continue;
    total++;
    if (m.hp > 0) working++;
  }
  return integrity < below || (total > 0 && working * 2 < total);
}

/** The first free working airlock of the first live player ship, or 0. */
function pickAirlock(sim: Sim, vehicle: number): number {
  for (const sid of sim.world.query(ShipC)) {
    const s = sim.world.get(sid, ShipC);
    if (s?.faction !== 'player' || (s.state !== 'active' && s.state !== 'disabled')) continue;
    for (const mid of sim.world.query(AirlockC)) {
      if (sim.world.get(mid, ModuleC)?.gridId === s.gridId && airlockWorking(sim, mid) && !dockError(sim, vehicle, mid)) return mid;
    }
  }
  return 0;
}

function start(sim: Sim, gridId: number, b: Boarder): void {
  let vehicle = 0;
  for (const vid of sim.world.query(VehicleC)) {
    const v = sim.world.get(vid, VehicleC);
    if (v?.homeGrid === gridId && v.state === 'stowed') {
      vehicle = vid;
      break;
    }
  }
  const v = vehicle ? sim.world.get(vehicle, VehicleC) : undefined;
  if (!v || !pickAirlock(sim, vehicle)) return; // nothing to fly or nowhere to land yet: try again next tick
  const able = sim.world.query(PositionC).filter((c) =>
    sim.world.get(c, PositionC)?.gridId === gridId && !sim.world.has(c, DeadC) && !isIncapacitated(sim, c));
  const n = Math.min(b.party, (vehicleDefOf(sim, v)?.capacity ?? 0) + 1, able.length - BOARDING_MIN_HOME);
  if (n < 1) {
    b.state = 'done';
    return;
  }
  b.crew = able.slice(-n);
  b.vehicle = vehicle;
  b.timer = 0;
  b.state = 'loading';
  for (const crew of b.crew) sim.enqueue({ type: 'vehicle.embark', crew, vehicle });
}
