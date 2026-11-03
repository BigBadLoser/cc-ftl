import { CrewC, DeadC, JobC, PositionC, PrioritiesC, type Job, type WorkCategory } from '../crew/components';
import { isEmergency } from '../ai/emergency';
import { isSettled } from '../crew/helpers';
import { vehicleSuits } from '../eva/shuttle';
import { needsAir } from '../eva/suit';
import { destroyJob } from '../items/stacks';
import { isTileWalkable } from '../modules/walk';
import { shipGrid } from '../regions';
import type { Sim } from '../sim';
import { VehicleC, type Vehicle } from '../vehicles/components';
import { boardingTile } from '../vehicles/geometry';
import { boardCrew, occupants, unboardCrew, vehicleDefOf } from '../vehicles/lifecycle';
import { shipIdOf } from '../regions';
import { AwayC } from './components';
import { allocateSeats, siteDemand } from './seats';

/**
 * Passages (docs/DESIGN.md "Who goes: passage jobs", #286 slice 2a): while the shuttle serving a site is at home it offers one `passage`
 * job per free seat at its boarding tile, each in a work category of the site's demand (`allocateSeats`). Crew take them like any job, at
 * their priority for that category, so the priority grid decides who goes. The holder walks to the tile and waits there; the site's run
 * boards them (`boardPassengers`), and they are of the party (`AwayC`) from then on.
 */

/** The passage jobs a shuttle offers, ascending id. */
export function passagesOf(sim: Sim, vehicle: number): number[] {
  return sim.world.query(JobC).filter((j) => {
    const job = sim.world.get(j, JobC);
    return job?.kind === 'passage' && job.target === vehicle;
  }).sort((a, b) => a - b);
}

/** Seats a passenger can still take (the pilot's seat counts: the shuttle flies itself). */
export function freeSeats(sim: Sim, v: Vehicle): number {
  return Math.max(0, (vehicleDefOf(sim, v)?.capacity ?? 0) + 1 - occupants(v).length);
}

/**
 * Suits the shuttle still has for new passengers: its stock less those its passengers who breathe will wear going out (all aboard but those
 * going home). Seats beyond these are `airless` passages.
 */
export function freeSuits(sim: Sim, v: Vehicle): number {
  const out = occupants(v).filter((c) => needsAir(sim, c) && !sim.world.get(c, AwayC)?.home).length;
  return Math.max(0, vehicleSuits(sim, v) - out);
}

/** Withdraw every passage of the shuttle (a walker on the way is called off). */
export function dropPassages(sim: Sim, vehicle: number): void {
  for (const j of passagesOf(sim, vehicle)) destroyJob(sim, j);
}

/**
 * Keep the passages in step with the free seats and the site's demand: the passages already taken stand, the open ones are posted again
 * when the categories wanted change. None while `want` is false (the site wants nobody now).
 */
export function postPassages(sim: Sim, vehicle: number, site: number, want: boolean): void {
  const v = sim.world.get(vehicle, VehicleC);
  const at = boardingTile(sim, vehicle);
  const all = passagesOf(sim, vehicle);
  const taken = all.filter((j) => (sim.world.get(j, JobC) as Job).reservedBy !== 0);
  const open = all.filter((j) => !taken.includes(j));
  // The first seats are suited ones, as far as suits go (anyone may take them); the rest are for crew who do not breathe. Each kind is split
  // by the demand on its own, so every category in demand gets a suited seat before any gets a second (a breather can take it).
  const seats = want && v && at ? Math.max(0, freeSeats(sim, v) - taken.length) : 0;
  const suited = v ? Math.min(seats, Math.max(0, freeSuits(sim, v) - taken.filter((j) => !(sim.world.get(j, JobC) as Job).airless).length)) : 0;
  const demand = seats > 0 ? siteDemand(sim, site) : {};
  const cats = seats > 0 ? [...allocateSeats(demand, suited), ...allocateSeats(demand, seats - suited)] : [];
  const airless = (i: number): boolean => i >= suited;
  const same = open.length === cats.length && open.every((j, i) => {
    const job = sim.world.get(j, JobC) as Job;
    return !!at && job.category === cats[i] && !!job.airless === airless(i) && job.x === at.x && job.y === at.y;
  });
  if (same) return;
  for (const j of open) destroyJob(sim, j);
  if (!at) return;
  cats.forEach((category, i) => {
    const id = sim.world.createEntity();
    sim.world.add(id, JobC, {
      category, kind: 'passage', x: at.x, y: at.y, struct: 0, work: 1, progress: 0, reservedBy: 0, target: vehicle, site, ...(airless(i) ? { airless: true as const } : {}),
    });
  });
}

/** Board the passage holders who stand on the boarding tile: they climb in and are of the party. */
export function boardPassengers(sim: Sim, vehicle: number, site: number): void {
  const at = boardingTile(sim, vehicle);
  const v = sim.world.get(vehicle, VehicleC);
  if (!at || !v) return;
  for (const j of passagesOf(sim, vehicle)) {
    const job = sim.world.get(j, JobC) as Job;
    const c = job.reservedBy;
    const pos = c ? sim.world.get(c, PositionC) : undefined;
    if (!pos || !isSettled(pos) || pos.x !== at.x || pos.y !== at.y || shipIdOf(sim, pos) !== at.shipId || sim.world.has(c, DeadC)) continue;
    if (occupants(v).length >= (vehicleDefOf(sim, v)?.capacity ?? 0) + 1) break;
    const cat: WorkCategory = job.category;
    sim.world.destroyEntity(j); // taken: the job is spent (boardCrew ends the holder's task)
    boardCrew(sim, c, vehicle);
    sim.world.add(c, AwayC, { site, vehicle, cat });
  }
}

/**
 * Let everyone aboard out at the boarding tile (back from the site, or a passenger stepping out again). `who` picks them; they leave the
 * party. False when the tile cannot be stood on (nobody gets out).
 */
export function letOut(sim: Sim, vehicle: number, who: (c: number) => boolean = () => true): boolean {
  const v = sim.world.get(vehicle, VehicleC);
  const at = boardingTile(sim, vehicle);
  const grid = at && shipGrid(sim, at.shipId);
  if (!v || !at || !grid || !isTileWalkable(sim, grid, at.x, at.y)) return false;
  for (const c of occupants(v)) {
    if (!who(c)) continue;
    unboardCrew(sim, c, vehicle, at);
    sim.world.remove(c, AwayC);
  }
  return true;
}

/**
 * True if a passenger waiting at home should step out again: an emergency (fire, breach, rescue) is open on the ship they boarded at, in a
 * category they rank above the one their passage was for.
 */
export function calledBack(sim: Sim, crew: number, ship: number): boolean {
  const away = sim.world.get(crew, AwayC);
  const prio = sim.world.get(crew, PrioritiesC);
  if (!away || !prio || !sim.world.has(crew, CrewC)) return false;
  const mine = prio[away.cat] || 5;
  for (const id of sim.world.query(JobC)) {
    const j = sim.world.get(id, JobC) as Job;
    if (j.reservedBy !== 0 || !isEmergency(j) || shipIdOf(sim, j) !== ship) continue;
    const level = prio[j.category];
    if (level >= 1 && level < mine) return true;
  }
  return false;
}
