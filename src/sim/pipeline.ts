import type { Sim } from './sim';
import { airlockSystem } from './systems/airlock';
import { suitsSystem } from './systems/suits';
import { evaFloatSystem } from './systems/evaFloat';
import { alertsSystem } from './systems/alerts';
import { atmosphereSystem } from './systems/atmosphere';
import { autoJobsSystem } from './systems/autojobs';
import { carrySystem } from './systems/carry';
import { combatStateSystem } from './systems/combatState';
import { craftJobsSystem } from './systems/craftJobs';
import { decideSystem } from './systems/decide';
import { deploySystem } from './systems/deploy';
import { doorsSystem } from './systems/doors';
import { draftedSystem } from './systems/drafted';
import { crewCombatSystem } from './systems/crewCombat';
import { equipSystem } from './systems/equip';
import { enemyAiSystem } from './systems/enemyAi';
import { firingSystem } from './systems/firing';
import { helmSystem } from './systems/helm';
import { impactSystem } from './systems/impacts';
import { ionSystem } from './systems/ion';
import { pointDefenceSystem } from './systems/pointDefence';
import { projectileSystem } from './systems/projectiles';
import { shieldSystem } from './systems/shields';
import { shipStateSystem } from './systems/shipState';
import { targetingSystem } from './systems/targeting';
import { weaponChargeSystem } from './systems/weaponCharge';
import { fireSystem } from './systems/fire';
import { haulCleanupSystem } from './systems/haulCleanup';
import { haulJobsSystem } from './systems/haulJobs';
import { itemFireSystem } from './systems/itemFire';
import { lightingSystem } from './systems/lighting';
import { modulesSystem } from './systems/modules';
import { movementSystem } from './systems/movement';
import { needsSystem } from './systems/needs';
import { moodSystem } from './systems/mood';
import { operateJobsSystem } from './systems/operateJobs';
import { powerSystem } from './systems/power';
import { roomsSystem } from './systems/rooms';
import { smokeSystem } from './systems/smoke';
import { supplyJobsSystem } from './systems/supplyJobs';
import { temperatureSystem } from './systems/temperature';
import { turretSystem } from './systems/turrets';
import { vitalsSystem } from './systems/vitals';
import { robotsSystem } from './systems/robots';
import { fabricatorSystem } from './systems/fabricators';
import { robotBaySystem } from './systems/robotBays';
import { workSystem } from './systems/work';
import { vehicleSystem } from './systems/vehicles';
import { containerDriftSystem } from './systems/containers';
import { boardingAiSystem } from './systems/boardingAi';
import { captureSystem } from './systems/capture';
import { cargoJobsSystem } from './systems/cargoJobs';
import { storySystem } from './systems/story';
import { tradeSystem } from './systems/trade';

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
  // Robot control after power: AI cores are live only while powered this tick; stuns run out.
  robotsSystem,
  // Fabricators after robot control (same live-core rule); new robots act from the next systems on.
  fabricatorSystem,
  // Robot bays charge and repair the robots settled in their cradles (power is fresh; needs drains later this tick).
  robotBaySystem,
  // Module effects (life support o2/co2, reactor heat) write into the gas and temperature fields.
  modulesSystem,
  // Doors before atmosphere: crew-opened doors let gas through this very tick.
  doorsSystem,
  // Airlock doors and chamber air, right after the doors system (which skips them) and before diffusion.
  airlockSystem,
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
  // Suit air drains on the final environment; vitals then sees which tanks ran dry.
  suitsSystem,
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
  // Shuttle cargo hauls before the floor planner, so salvage on a prize goes to the shuttle, not nowhere.
  cargoJobsSystem,
  haulJobsSystem,
  // Needs before decisions, so a crew member who just got tired sleeps this tick.
  needsSystem,
  // Mood reads the fresh needs and room conditions; the stat resolver uses it for work speed from the next tick.
  moodSystem,
  // Decide before drafted/movement: new paths are walked the same tick.
  // Weapon fetching before decide: crew on an equip order must not be handed a job this tick.
  equipSystem,
  decideSystem,
  draftedSystem,
  // Crew combat after decisions: it overrides paths of crew who fight or flee, before movement walks them.
  crewCombatSystem,
  // Movement before carry (carried crew copy their carrier's fresh position) and work.
  movementSystem,
  // Suited crew drifting between a hovering shuttle and a hull land or climb aboard.
  evaFloatSystem,
  carrySystem,
  // Vehicles after crew movement: embarking crew board on arrival, shuttles fly before this tick's shots are aimed.
  vehicleSystem,
  // Detached containers drift on their own velocity (inert bodies; nothing else moves them).
  containerDriftSystem,
  // Trade deliveries read this tick's arrivals and issue next tick's flight orders; crew then haul the cargo.
  tradeSystem,
  // Work last: completed jobs change the grid, which rooms picks up next tick.
  workSystem,
  // --- Combat (see each system's notes). State first: it decides whether consoles are needed next tick.
  combatStateSystem,
  // Ion timers expire before anything asks whether a module is disabled.
  ionSystem,
  // Roof parts fold out or away on this tick's combat state and power, before anything checks them.
  deploySystem,
  // Shields and helm settle this tick's layers, evasion and FTL charge before shots resolve.
  shieldSystem,
  helmSystem,
  // The enemy AI issues commands (applied next tick), then targets are validated.
  enemyAiSystem,
  // The boarding doctrine issues vehicle commands (applied next tick).
  boardingAiSystem,
  targetingSystem,
  // Charge, then fire: a weapon that reaches full charge fires the same tick.
  weaponChargeSystem,
  // Turrets track their targets before firing, so shots leave along the aim.
  turretSystem,
  firingSystem,
  // Flight, then point defence gets its roll on shots in range, then arrivals resolve (evasion, shields, effects).
  projectileSystem,
  pointDefenceSystem,
  impactSystem,
  // Ship state: it reads the damage done this tick.
  shipStateSystem,
  // Capture last: it reads this tick's crew states (downed, surrendered, positions) and may end combat for the next.
  captureSystem,
  // Events last: periodic draws, due chains and lapsing notices read the finished tick. Reads no grid state.
  storySystem,
];
