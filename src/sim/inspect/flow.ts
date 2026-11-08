import { SiteRunC } from '../away/components';
import { scanPrices } from '../blackmarket/scan';
import { INSPECT_BOARD_SEC, INSPECT_HOME_SEC, INSPECT_STALL_SEC } from '../blackmarket/tuning';
import { shipById } from '../combat/ships';
import { CrewC, DeadC, JobC, PositionC } from '../crew/components';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { PLAN_INTERVAL } from '../tuning';
import { partyJobs, postSearches, spotCheck, tally } from './search';
import { refuseConsequences } from './settle';
import { endInspection, go, leave } from './start';
import { InspectionC, inspections, type Inspection } from './types';

const alive = (sim: Sim, id: number): boolean => sim.world.has(id, CrewC) && !sim.world.has(id, DeadC);

/** True while an inspector stands on the inspected ship. */
const aboard = (sim: Sim, insp: Inspection): boolean =>
  insp.crew.some((id) => alive(sim, id) && sim.world.has(id, PositionC) && shipIdOf(sim, sim.world.get(id, PositionC)!) === insp.ship);

/** The player's ship is leaving the node: an inspection under way ends now; leaving while the inspectors are aboard counts as refusing them. */
export function abortInspections(sim: Sim): void {
  for (const id of inspections(sim)) {
    const insp = sim.world.get(id, InspectionC)!;
    if (insp.phase === 'search' || insp.phase === 'settle') {
      refuseConsequences(sim, insp);
      sim.events.emit({ type: 'inspect.settled', inspection: id, faction: insp.faction, outcome: 'fled', cost: 0 });
    }
    endInspection(sim, id);
  }
}

function step(sim: Sim, id: number, insp: Inspection): void {
  insp.timer++;
  const station = shipById(sim, insp.station);
  const ship = shipById(sim, insp.ship);
  if (!station || station.state !== 'active' || !ship || ship.faction !== 'player' || sim.sector.state !== 'active') return endInspection(sim, id);
  if (!insp.crew.some((c) => alive(sim, c))) return endInspection(sim, id);
  if (insp.phase !== 'leave' && sim.sector.inCombat) return leave(sim, id, insp, 'off');
  switch (insp.phase) {
    case 'fly': {
      if (!sim.world.has(id, SiteRunC)) return endInspection(sim, id);
      if (aboard(sim, insp)) {
        go(insp, 'search');
        postSearches(sim, id, insp);
        return;
      }
      if (insp.timer > INSPECT_BOARD_SEC * TICK_HZ) insp.blocked = true; // no way in yet: they wait (the alert) until there is
      return;
    }
    case 'search': {
      const live = insp.jobs.filter((j) => sim.world.has(j, JobC));
      if (live.length < insp.jobs.length) insp.timer = 0; // a search finished: the stall clock starts again
      insp.jobs = live;
      if (sim.tick % PLAN_INTERVAL === 0) spotCheck(sim, id, insp);
      const open = partyJobs(sim, id);
      if (open.length === 0) {
        tally(sim, id, insp);
        if (!insp.found.length) {
          sim.events.emit({ type: 'inspect.settled', inspection: id, faction: insp.faction, outcome: 'clean', cost: 0 });
          return leave(sim, id, insp, 'clean');
        }
        Object.assign(insp, scanPrices(insp.value));
        go(insp, 'settle');
        sim.events.emit({ type: 'inspect.waiting', inspection: id, faction: insp.faction, value: insp.value, fine: insp.fine ?? 0, bribe: insp.bribe ?? 0 });
        return;
      }
      const taken = open.some((j) => (sim.world.get(j, JobC)?.reservedBy ?? 0) !== 0);
      if (taken) insp.timer = 0;
      if (!aboard(sim, insp) || insp.timer > INSPECT_STALL_SEC * TICK_HZ) insp.blocked = true;
      else delete insp.blocked;
      return;
    }
    case 'settle': {
      // The lead waits: the first inspector still alive leads.
      const lead = insp.crew.find((c) => alive(sim, c));
      if (lead !== undefined && insp.crew[0] !== lead) insp.crew = [lead, ...insp.crew.filter((c) => c !== lead)];
      return;
    }
    case 'leave':
      if (!sim.world.has(id, SiteRunC) || insp.timer > INSPECT_HOME_SEC * TICK_HZ) endInspection(sim, id);
      return;
  }
}

/**
 * Contraband inspections (#138, inspect/types.ts): each inspection's shuttle is flown by its away site's run (away/run.ts); this system moves the
 * inspection along its phases: aboard, search, the wait for an answer (`inspect.settle`), and home.
 */
export function inspectSystem(sim: Sim): void {
  for (const id of inspections(sim)) step(sim, id, sim.world.get(id, InspectionC)!);
}
