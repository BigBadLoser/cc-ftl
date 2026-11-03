import { shipById } from '../combat/ships';
import { regionAirlock } from '../ferry/pick';
import { ModuleC } from '../modules/components';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import type { Vehicle } from '../vehicles/components';
import { bayWorking } from '../vehicles/geometry';
import { AwaySiteC, type SiteRun } from './components';

/** Small helpers the site run's phases share (away/run.ts, away/site.ts). */

/** Ticks between repeats of an order the run keeps giving until it is obeyed. */
export const REPEAT = 20;
export const sec = (n: number): number => Math.round(n * TICK_HZ);
export const due = (r: SiteRun): boolean => r.timer % REPEAT === 1;

export function go(r: SiteRun, phase: SiteRun['phase']): void {
  r.phase = phase;
  r.timer = 0;
}

export const hovering = (v: Vehicle, ship: number): boolean => v.state === 'flying' && !v.dest && v.hover === ship;

/** The ship (grid) a docked vehicle is docked at, else 0. */
export const dockedShip = (sim: Sim, v: Vehicle): number => (v.state === 'docked' ? shipIdOf(sim, sim.world.get(v.dock, ModuleC)) : 0);

/** True while the shuttle is at the site: hovering beside it, or docked at one of its airlocks. */
export const atSite = (sim: Sim, v: Vehicle, site: number): boolean => hovering(v, site) || dockedShip(sim, v) === site;

/** True once the shuttle is home: stowed in its bay, or docked at an airlock of its home ship (its bay is gone). */
export const atHome = (sim: Sim, v: Vehicle): boolean => v.state === 'stowed' || dockedShip(sim, v) === v.homeShip;

/** Can the shuttle get into its home ship: it is home, its bay works, or an airlock of the home ship is free (none if the ship is gone). */
export const wayHome = (sim: Sim, id: number, v: Vehicle): boolean =>
  atHome(sim, v) || (!!v.home && bayWorking(sim, v.home)) || regionAirlock(sim, v.homeShip, id) !== 0;

/** True while a fight calls the site's party in: one is on in the node and the site's owner did not ask to carry on through it. */
export const fightCalls = (sim: Sim, site: number): boolean => sim.sector.inCombat && sim.world.get(site, AwaySiteC)?.fight !== 'stay';

/** True while the site still wants workers: open, its ship there, and no fight calling the party in. */
export function wanted(sim: Sim, site: number): boolean {
  return sim.world.get(site, AwaySiteC)?.status === 'open' && !!shipById(sim, site) && !fightCalls(sim, site);
}
