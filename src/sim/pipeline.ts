import type { Sim } from './sim';
import { alertsSystem } from './systems/alerts';
import { atmosphereSystem } from './systems/atmosphere';
import { autoJobsSystem } from './systems/autojobs';
import { carrySystem } from './systems/carry';
import { combatStateSystem } from './systems/combatState';
import { craftJobsSystem } from './systems/craftJobs';
import { decideSystem } from './systems/decide';
import { doorsSystem } from './systems/doors';
import { draftedSystem } from './systems/drafted';
import { fireSystem } from './systems/fire';
import { haulCleanupSystem } from './systems/haulCleanup';
import { haulJobsSystem } from './systems/haulJobs';
import { itemFireSystem } from './systems/itemFire';
import { lightingSystem } from './systems/lighting';
import { modulesSystem } from './systems/modules';
import { movementSystem } from './systems/movement';
import { needsSystem } from './systems/needs';
import { operateJobsSystem } from './systems/operateJobs';
import { powerSystem } from './systems/power';
import { roomsSystem } from './systems/rooms';
import { smokeSystem } from './systems/smoke';
import { supplyJobsSystem } from './systems/supplyJobs';
import { temperatureSystem } from './systems/temperature';
import { vitalsSystem } from './systems/vitals';
import { workSystem } from './systems/work';

/** One step of the tick. Reads and writes world components and grid fields only. */
export type System = (sim: Sim) => void;

/**
 * The ordered tick pipeline. RULE: systems never import or call each other. They interact only
 * through components and grid fields, so the order of this list is the only coupling between
 * them. Add a system by writing it in its own file and listing it here.
 */
export const pipeline: readonly System[] = [
  // Rooms first: later systems (wander, life support, lighting) read fresh room ids after last tick's builds.
  roomsSystem,
  // Power before modules: modules only act when the power system marked them powered this tick.
  powerSystem,
  // Module effects (life support o2/co2, reactor heat) write into the gas and temperature fields.
  modulesSystem,
  // Doors before atmosphere: crew-opened doors let gas through this very tick.
  doorsSystem,
  // Gas diffusion runs on the doors and module output of this tick.
  atmosphereSystem,
  // Fire reads the settled air (O2) and writes its o2/co2/smoke/heat back for next tick.
  fireSystem,
  // Loose item stacks burn on the fire's final intensity for this tick.
  itemFireSystem,
  // Temperature after the heat sources (reactor, fire) so their heat spreads immediately.
  temperatureSystem,
  // Smoke after fire has added to it.
  smokeSystem,
  // Lighting after power (lights need it) and doors (doorways borrow light).
  lightingSystem,
  // Alerts watch the finished environment; events only, nothing reads them.
  alertsSystem,
  // Vitals after the environment is final: breathing, harm, downing, bleeding, dying.
  vitalsSystem,
  // Auto jobs after vitals, so a crew member who just went down gets a rescue job this tick.
  autoJobsSystem,
  // Console operating jobs (combat): after vitals so downed operators are already released.
  operateJobsSystem,
  // Economy planners, in dependency order: drop dead hauls (frees reservations), open craft jobs,
  // then supply (jobs get first claim on stock), then clear the floor with what is left unclaimed.
  haulCleanupSystem,
  craftJobsSystem,
  supplyJobsSystem,
  haulJobsSystem,
  // Needs before decisions, so a crew member who just got tired sleeps this tick.
  needsSystem,
  // Decide before drafted/movement: new paths are walked the same tick.
  decideSystem,
  draftedSystem,
  // Movement before carry (carried crew copy their carrier's fresh position) and work.
  movementSystem,
  carrySystem,
  // Work last: completed jobs change the grid, which rooms picks up next tick.
  workSystem,
  // --- Combat (see each system's notes). State first: it decides whether consoles are needed next tick.
  combatStateSystem,
];
