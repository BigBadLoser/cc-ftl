import { AwayC, SiteRunC } from '../away/components';
import { scanPrices } from '../blackmarket/scan';
import { INSPECT_BOARD_SEC, INSPECT_HOME_SEC, INSPECT_STALL_SEC, INSPECT_TURN_SEC } from '../blackmarket/tuning';
import { factionsHostile } from '../combat/factions';
import { shipById } from '../combat/ships';
import { CrewC, DeadC, DownedC, JobC, PositionC } from '../crew/components';
import { SurrenderedC } from '../fight/components';
import { fightInspection, turnPatrol } from './fight';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { PLAN_INTERVAL } from '../tuning';
import { partyJobs, postSearches, spotCheck, tally } from './search';
import { patrolBoards, ranFromInspection } from './patrol';
import { refuseConsequences } from './settle';
import { endInspection, go, leave } from './start';
import { InspectionC, inspections, type Inspection } from './types';

const alive = (sim: Sim, id: number): boolean => sim.world.has(id, CrewC) && !sim.world.has(id, DeadC);

/** True while an inspector stands on the inspected ship. */
const aboard = (sim: Sim, insp: Inspection): boolean =>
  insp.crew.some((id) => alive(sim, id) && sim.world.has(id, PositionC) && shipIdOf(sim, sim.world.get(id, PositionC)!) === insp.ship);

/** True while an inspector still stands and fights on the inspected ship (not downed, surrendered or dead). */
const standing = (sim: Sim, insp: Inspection): boolean =>
  insp.crew.some((id) => alive(sim, id) && !sim.world.has(id, DownedC) && !sim.world.has(id, SurrenderedC) && sim.world.has(id, PositionC)
    && shipIdOf(sim, sim.world.get(id, PositionC)!) === insp.ship);

/**
 * A fight is over for the inspection, or the player left mid-fight: the inspectors on the player's ship stay there as ordinary hostile crew (to be taken
 * prisoner, or fought on after a jump), the rest go with the shuttle.
 */
function release(sim: Sim, vehicle: number, insp: Inspection): void {
  insp.crew = insp.crew.filter((id) => {
    const pos = sim.world.get(id, PositionC);
    const kept = alive(sim, id) && !!pos && shipIdOf(sim, pos) === insp.ship;
    if (kept) sim.world.remove(id, AwayC);
    return !kept;
  });
  endInspection(sim, vehicle);
}

/**
 * The player's ship is leaving the node: an inspection under way ends now; leaving while the inspectors are aboard counts as refusing them, and leaving a
 * patrol whose inspectors are still on the way counts as running from it.
 */
export function abortInspections(sim: Sim): void {
  for (const id of inspections(sim)) {
    const insp = sim.world.get(id, InspectionC)!;
    if (insp.phase === 'search' || insp.phase === 'settle') {
      refuseConsequences(sim, insp);
      sim.events.emit({ type: 'inspect.settled', inspection: id, faction: insp.faction, outcome: 'fled', cost: 0, ...(insp.patrol !== undefined ? { patrol: true as const } : {}) });
    } else if (insp.phase === 'fly' && insp.patrol !== undefined) ranFromInspection(sim, insp.faction, insp.patrol);
    if (insp.phase === 'fight') {
      release(sim, id, insp);
      continue;
    }
    if (insp.turnOnLeave) turnPatrol(sim, id, insp); // a refused (or fled) patrol turns on the player before they get away
    endInspection(sim, id);
  }
}

function step(sim: Sim, id: number, insp: Inspection): void {
  insp.timer++;
  const station = shipById(sim, insp.station);
  const ship = shipById(sim, insp.ship);
  if (insp.phase === 'fight') {
    // Over once nobody of theirs stands aboard (the player's ship lost or left is abortInspections / the checks below).
    if (!ship || ship.faction !== 'player' || sim.sector.state !== 'active' || !standing(sim, insp)) release(sim, id, insp);
    return;
  }
  // The player turned on the ship that sent them (fired on it): its inspectors aboard fight too.
  if (station && insp.phase !== 'leave' && factionsHostile(station.faction, 'player')) return fightInspection(sim, id, insp);
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
          sim.events.emit({ type: 'inspect.settled', inspection: id, faction: insp.faction, outcome: 'clean', cost: 0, ...(insp.patrol !== undefined ? { patrol: true as const } : {}) });
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
    case 'leave': {
      const home = !sim.world.has(id, SiteRunC) || insp.timer > INSPECT_HOME_SEC * TICK_HZ;
      // A refused patrol turns hostile once its people are off the player's ship, or a beat after they set off.
      if (insp.turnOnLeave && (home || !aboard(sim, insp) || insp.timer > INSPECT_TURN_SEC * TICK_HZ)) turnPatrol(sim, id, insp);
      if (home) endInspection(sim, id);
      return;
    }
  }
}

/**
 * Contraband inspections (#138, inspect/types.ts): each inspection's shuttle is flown by its away site's run (away/run.ts); this system moves the
 * inspection along its phases: aboard, search, the wait for an answer (`inspect.settle`), and home.
 */
export function inspectSystem(sim: Sim): void {
  patrolBoards(sim);
  for (const id of inspections(sim)) step(sim, id, sim.world.get(id, InspectionC)!);
}
