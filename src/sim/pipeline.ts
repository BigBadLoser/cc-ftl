import type { Sim } from './sim';
import { alertsSystem } from './systems/alerts';
import { atmosphereSystem } from './systems/atmosphere';
import { autoJobsSystem } from './systems/autojobs';
import { carrySystem } from './systems/carry';
import { decideSystem } from './systems/decide';
import { doorsSystem } from './systems/doors';
import { draftedSystem } from './systems/drafted';
import { fireSystem } from './systems/fire';
import { lightingSystem } from './systems/lighting';
import { modulesSystem } from './systems/modules';
import { movementSystem } from './systems/movement';
import { needsSystem } from './systems/needs';
import { powerSystem } from './systems/power';
import { roomsSystem } from './systems/rooms';
import { smokeSystem } from './systems/smoke';
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
];
