import type { Sim } from './sim';
import { NOOP_PROBE, type Probe } from './probe';
import { airlockSystem } from './systems/airlock';
import { suitsSystem } from './systems/suits';
import { evaFloatSystem } from './systems/evaFloat';
import { alertsSystem } from './systems/alerts';
import { atmosphereSystem } from './systems/atmosphere';
import { autoJobsSystem } from './systems/autojobs';
import { carrySystem } from './systems/carry';
import { combatStateSystem } from './systems/combatState';
import { outpostSystem } from './systems/outposts';
import { dormancySystem } from './systems/dormancy';
import { stationAlarmSystem } from './systems/stationAlarm';
import { stationDirectorSystem } from './systems/stationDirector';
import { craftJobsSystem } from './systems/craftJobs';
import { researchJobsSystem } from './systems/researchJobs';
import { scheduleSystem } from './ai/schedule';
import { interruptSystem } from './ai/interrupt';
import { deploySystem } from './systems/deploy';
import { doorsSystem } from './systems/doors';
import { draftedSystem } from './systems/drafted';
import { crewCombatSystem } from './systems/crewCombat';
import { equipSystem } from './systems/equip';
import { enemyAiSystem } from './systems/enemyAi';
import { heatSystem } from './systems/heat';
import { heatAiSystem } from './systems/heatAi';
import { firingSystem } from './systems/firing';
import { helmSystem } from './systems/helm';
import { impactSystem } from './systems/impacts';
import { ionSystem } from './systems/ion';
import { pointDefenceSystem } from './systems/pointDefence';
import { projectileSystem } from './systems/projectiles';
import { shieldSystem } from './systems/shields';
import { shipStateSystem } from './systems/shipState';
import { vehicleDefenceSystem } from './systems/vehicleDefence';
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
import { bedOwnersSystem } from './systems/bedOwners';
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
import { workSystem } from './ai/work';
import { vehicleSystem } from './systems/vehicles';
import { miningSystem } from './systems/mining';
import { ferrySystem } from './ferry/flow';
import { logisticsSystem } from './logistics/system';
import { containerDriftSystem } from './systems/containers';
import { boardingAiSystem } from './systems/boardingAi';
import { recallSystem } from './boarding/recall';
import { sabotageResumeSystem } from './boarding/resume';
import { coreRaidSystem } from './capture/coreRaid';
import { captureSystem } from './systems/capture';
import { cargoJobsSystem } from './systems/cargoJobs';
import { galaxySystem } from './systems/galaxy';
import { storySystem } from './systems/story';
import { recruitsSystem } from './systems/recruits';
import { tradeSystem } from './systems/trade';
import { yardSystem } from './yard/flow';
import { eggSacSystem } from './systems/eggSacs';
import { alienSystem } from './systems/aliens';
import { truceSystem } from './systems/truce';

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
  // Sabotage orders a fight paused pick up again once nothing hostile is in sight (after autojobs, which pauses them).
  sabotageResumeSystem,
  // Economy planners, in dependency order: drop dead hauls (frees reservations), open craft jobs,
  // then supply (jobs get first claim on stock), then clear the floor with what is left unclaimed.
  haulCleanupSystem,
  craftJobsSystem,
  // Research jobs next to the craft jobs: the active project is paid from stock, which must happen before supply claims it for builds.
  researchJobsSystem,
  supplyJobsSystem,
  // Shuttle cargo hauls before the floor planner, so salvage on a prize goes to the shuttle, not nowhere.
  cargoJobsSystem,
  haulJobsSystem,
  // Bed ownership (a once-a-second pass) before needs and decisions: a tired crew member walks to the bed they own.
  bedOwnersSystem,
  // Needs before decisions, so a crew member who just got tired sleeps this tick.
  needsSystem,
  // Mood reads the fresh needs and room conditions; the stat resolver uses it for work speed from the next tick.
  moodSystem,
  // Crew decisions (sim/ai: policy.legacy, the legacy picker and the need machines) before drafted/movement: new paths are walked
  // the same tick. Weapon fetching before them: crew on an equip order must not be handed a job this tick.
  equipSystem,
  // The forced-state detector reads this tick's equip orders (Phase 1: it only records `Interrupt`; nothing reads it yet).
  interruptSystem,
  scheduleSystem,
  draftedSystem,
  // Egg sacs before crew combat: a sac disturbed or hurt last tick hatches, and new aliens fight from this tick on.
  eggSacSystem,
  // Crew combat after decisions: it overrides paths of crew who fight or flee, before movement walks them.
  crewCombatSystem,
  // Idle aliens stroll near where they hatched (after combat, which owns them while they hunt or flee).
  alienSystem,
  // Movement before carry (carried crew copy their carrier's fresh position) and work.
  movementSystem,
  // Suited crew drifting between a hovering shuttle and a hull land or climb aboard.
  evaFloatSystem,
  carrySystem,
  // Mining pods steer their outbound legs and cut ore, then hand the leg home to the vehicle system right after.
  miningSystem,
  // Vehicles after crew movement: embarking crew board on arrival, shuttles fly before this tick's shots are aimed.
  vehicleSystem,
  // Detached containers drift on their own velocity (inert bodies; nothing else moves them).
  containerDriftSystem,
  // Trade deliveries read this tick's arrivals and issue next tick's flight orders; crew then haul the cargo.
  tradeSystem,
  // Shipyard orders: the station's shuttle brings its crew to build the paid-for hull (ordinary jobs, done next to the work system below).
  yardSystem,
  // Base-logistics runs: shuttles carry cargo and crew between the home ship and claimed bases (ordinary vehicle commands, next tick).
  ferrySystem,
  // Transfer orders (queue) take free shuttles and pilots and start the runs above; they book trips the ferry flow just settled.
  logisticsSystem,
  // Work last (the executor's work step, sim/ai): completed jobs change the grid, which rooms picks up next tick.
  workSystem,
  // Outposts found or provoked by player presence, before the combat state reads who is a combatant.
  outpostSystem,
  // --- Combat (see each system's notes). Dormant hostiles wake on provocation, then the combat state is decided (it
  // decides whether consoles are needed next tick).
  dormancySystem,
  // Black-market truce: a breach (the player firing on or boarding anyone at a truce node) bans them; everyone turns hostile while it lasts.
  truceSystem,
  // Station alarms: intruders, attacks and hazards make the station's people hostile to the culprits (fight code acts on it).
  stationAlarmSystem,
  // NPC ship directors post jobs for their crew (patrols; withdrawn on alarm) into the shared job system.
  stationDirectorSystem,
  combatStateSystem,
  // Ion timers expire before anything asks whether a module is disabled.
  ionSystem,
  // Roof parts fold out or away on this tick's combat state and power, before anything checks them.
  deploySystem,
  // Shields and helm settle this tick's layers, evasion and FTL charge before shots resolve.
  // Heat before shields: a vent or an overheat started this tick holds the shields down.
  heatSystem,
  shieldSystem,
  helmSystem,
  // The enemy AI issues commands (applied next tick), then targets are validated.
  enemyAiSystem,
  // Heat management by command (the AI's vents and overcharges, the player ship's automatic vent), applied next tick.
  heatAiSystem,
  // The boarding doctrine issues vehicle commands (applied next tick).
  boardingAiSystem,
  // The player's recall of a boarding party (walk to the shuttle, fly home, step out): vehicle commands, applied next tick.
  recallSystem,
  // The player's anti-vehicle weapons pick up a hostile shuttle coming for the ship (the AI does it by command above).
  vehicleDefenceSystem,
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
  // Zealot raiders holding an AI core count towards tearing it out (before capture reads who still stands).
  coreRaidSystem,
  // Capture last: it reads this tick's crew states (downed, surrendered, positions) and may end combat for the next.
  captureSystem,
  // Starmap after ship state (contacts of wrecked or fled ships are dropped) and before events: an arrival spawns its
  // ship for the next tick's systems. Does not run while the sector is deploying (the whole pipeline is skipped then).
  galaxySystem,
  // Crew for hire aboard the node's stations follow the ports' candidates (and the turn the galaxy system just moved on).
  recruitsSystem,
  // Events last: periodic draws, due chains and lapsing notices read the finished tick. Reads no grid state.
  storySystem,
];

/** Probe label of each pipeline entry, in order (`sim/<system>`), built once so running with a probe allocates nothing. */
export const systemLabels: readonly string[] = pipeline.map((system) => `sim/${system.name.replace(/System$/, '')}`);

/** Run every system in order, timing each through `probe` (the no-op costs one empty call per system). */
export function runPipeline(sim: Sim, probe: Probe = NOOP_PROBE): void {
  for (let i = 0; i < pipeline.length; i++) {
    const label = systemLabels[i]!;
    probe.begin(label);
    pipeline[i]!(sim);
    probe.end(label);
  }
}
