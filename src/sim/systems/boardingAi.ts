
import { pickAirlock, startParty } from '../boarding/party';
import { ShipC } from '../combat/components';
import { isAiFaction } from '../combat/factions';
import { ModuleC } from '../modules/components';
import type { Sim } from '../sim';
import { BOARDING_LOAD_TICKS } from '../tuning';
import { BoarderC, EmbarkOrderC, VehicleC, type Boarder } from '../vehicles/components';
import { shipIdOf } from '../regions';
import { hasLeaveFrom } from '../consent/guests';

/**
 * Enemy boarding doctrine (ships whose template has `boarding`; see BoarderC). Deterministic, command-only:
 * idle until `afterTicks` of combat pass or the ship is losing (fewer than half its weapons work, or integrity under
 * `losingBelow`). Then the highest-id crew (up to `party`, always leaving BOARDING_MIN_HOME aboard) are ordered into the
 * stowed shuttle; when they are aboard (or BOARDING_LOAD_TICKS pass) the shuttle is sent to dock at the first free,
 * working airlock of the first live player ship; once docked everyone disembarks into that ship, pilot last.
 * A shuttle that is shot down ends the attempt ('done'); one whose dock failed tries another airlock.
 * A neutral ship's party that was let in (a 'visit' consent grant from it on the player's ship, scene/visit.ts) is started by that and runs the same way
 * outside combat.
 */
export function boardingAiSystem(sim: Sim): void {
  for (const id of sim.world.query(BoarderC, ShipC)) {
    const b = sim.world.get(id, BoarderC) as Boarder;
    const ship = sim.world.get(id, ShipC)!;
    if (b.state === 'done' || (!isAiFaction(ship.faction) && !hasLeaveFrom(sim, id)) || ship.state !== 'active') continue;
    const v = b.vehicle ? sim.world.get(b.vehicle, VehicleC) : undefined;
    if (b.state === 'idle') {
      if (!sim.sector.inCombat) continue;
      b.timer++;
      if (b.timer >= b.afterTicks || losing(sim, id, ship.integrity, b.losingBelow)) startParty(sim, id, b);
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

function losing(sim: Sim, shipId: number, integrity: number, below: number): boolean {
  let total = 0;
  let working = 0;
  for (const mid of sim.world.query(ModuleC)) {
    const m = sim.world.get(mid, ModuleC);
    if (!m || shipIdOf(sim, m) !== shipId || !sim.content.modules[m.def]?.weapon) continue;
    total++;
    if (m.hp > 0) working++;
  }
  return integrity < below || (total > 0 && working * 2 < total);
}

