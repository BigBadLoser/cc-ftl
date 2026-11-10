import { ALT, BodyC } from '../body';
import { lodgingHere } from '../consent/guests';
import { CrewC, DeadC, DownedC, HealthC } from '../crew/components';
import { rollCrewWith } from '../crew/roll';
import { createCrew } from '../crew/spawn';
import { freeSpot } from '../galaxy/arrivals';
import type { Rng } from '../rng';
import type { Sim } from '../sim';
import { playerShip } from '../trade/player';
import { boardCrew } from '../vehicles/lifecycle';
import { VehicleC } from '../vehicles/components';
import type { SceneFact, ScenePod, ScenePodRecipe, SceneSpec } from './types';

/**
 * A scene's escape pods (DESIGN.md "Medical pod"; vehicles/escape.ts). The patient is rolled with the scene (the scan reads them before anyone drops out);
 * the pod and its person are made real once the player has deployed, so the bleeding starts then, as every scene clock does. From there the sim decides:
 * the pod comes in when called, the person is carried to a bed by the rescue job, the bed stabilises them, or they bleed out.
 */

export const POD_DEF = 'vehicle.escape_pod';

/** One pod of a recipe, rolled from the scene's generator. */
export function buildPod(sim: Sim, r: ScenePodRecipe, rng: Rng): ScenePod {
  const role = r.roles[rng.int(0, r.roles.length - 1)] ?? 'role.engineer';
  const owner = r.owners[rng.int(0, r.owners.length - 1)] ?? 'traders';
  const bleed = rng.int(r.bleed[0], r.bleed[1]);
  const patient = rollCrewWith(rng, role, sim.content, true); // the scene's role is a career hint (docs/TRAITS.md 10.11)
  return { id: sim.galaxy.nextFleet++, owner, patient, bleed, purse: rng.int(r.purse[0], r.purse[1]) };
}

/** Make a pod real beside where the player's ship is: the vehicle adrift, its person aboard, downed and bleeding. False until the player has deployed. */
function spawnPod(sim: Sim, p: ScenePod): boolean {
  if (sim.sector.state !== 'active' || !playerShip(sim) || !sim.content.vehicles?.[POD_DEF]) return false;
  const spot = freeSpot(sim, 4, 4);
  if (!spot) return false;
  const def = sim.content.vehicles[POD_DEF];
  const id = sim.world.createEntity();
  sim.world.add(id, VehicleC, { def: POD_DEF, homeShip: 0, home: 0, state: 'flying', hp: def.maxHp, pilot: 0, passengers: [], dest: null, dock: 0, cargo: [] });
  sim.world.add(id, BodyC, { x: spot.x + 2, y: spot.y + 2, heading: Math.PI / 4, alt: ALT.cruise });
  const crew = createCrew(sim, 0, p.patient.role, { x: spot.x, y: spot.y }, { faction: 'neutral', rolled: p.patient });
  if (!crew) {
    sim.world.destroyEntity(id);
    return false;
  }
  boardCrew(sim, crew, id);
  const hp = sim.world.get(crew, HealthC);
  if (hp) hp.hp = 0;
  sim.world.add(crew, DownedC, { bleed: p.bleed, stabilized: false, bed: 0 });
  (sim.world.get(crew, CrewC) as { activity: string }).activity = 'downed';
  p.vehicle = id;
  p.crew = crew;
  return true;
}

/** Make the scene's pods real (each once). True when one was. */
export function tendPods(sim: Sim, spec: SceneSpec): boolean {
  let changed = false;
  for (const p of spec.pods ?? []) if (p.vehicle === undefined && spawnPod(sim, p)) changed = true;
  return changed;
}

/** The facts true of a pod's patient now: taken aboard as a passenger (`rescued`), or dead (`died`). */
export function podFacts(sim: Sim, p: ScenePod): Set<SceneFact> {
  const out = new Set<SceneFact>();
  if (p.crew === undefined || p.handed) return out;
  if (!sim.world.has(p.crew, CrewC) || sim.world.has(p.crew, DeadC)) return out.add('died');
  if (lodgingHere(sim, p.crew)) out.add('rescued');
  return out;
}

/** True while the pod's patient is still adrift in it, alive (what leaving leaves behind). */
export function podAdrift(sim: Sim, p: ScenePod): boolean {
  const v = p.vehicle === undefined ? undefined : sim.world.get(p.vehicle, VehicleC);
  return !!v && p.crew !== undefined && v.passengers.includes(p.crew) && !sim.world.has(p.crew, DeadC);
}

/**
 * The pod's patient was taken in as a passenger: the event's rules about them go with their grant (scene/carried.ts fires them from there, after the
 * pocket is gone too: back on their feet, or dead aboard), and the pod has nothing more to say about them. Once.
 */
export function handOn(sim: Sim, p: ScenePod, event: string): void {
  if (p.handed || p.crew === undefined) return;
  const g = lodgingHere(sim, p.crew);
  if (g?.by !== 'passage') return;
  g.carry = { event, origin: p.owner, purse: p.purse, fired: [] };
  p.handed = true;
}
