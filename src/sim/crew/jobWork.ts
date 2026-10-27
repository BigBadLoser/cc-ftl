import { performCraft } from '../items/craft';
import { performResearch } from '../research/work';
import { performHaul } from '../items/haul';
import { consumeDelivered, needsMaterials } from '../items/materials';
import { evictStack, refundCost, structCostKey } from '../items/stacks';
import { footprintTiles } from '../modules/footprint';
import { ModuleC } from '../modules/components';
import { footprintBlockedByCrew, removeModule, spawnModule } from '../modules/spawn';
import { performSuitJob } from '../eva/jobs';
import { performAssemble } from '../robots/bay';
import { performHack, performMend, performSalvage } from '../robots/jobs';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { DoorJam, Struct, writeStruct } from '../structure';
import { stochasticRound } from '../stochastic';
import { EXTINGUISH_PER_SEC, REPAIR_PER_SEC } from '../tuning';
import { findFreeBed } from './beds';
import { CarriedC, CrewC, DownedC, PositionC, type Crew, type Job, type Position } from './components';
import { isTileOccupied, origin } from './helpers';
import { shipIdOf, shipGrid } from '../regions';
import { finishDig } from '../rock/dig';
import { bumpStat } from '../story/goals';
import { playerShips } from '../story/world';
import { AsteroidC } from '../asteroids/components';
import { spawnVehicle } from '../vehicles/lifecycle';
import { dropPlanTile } from '../yard/trussPlan';

/** 'done': the job is finished and removed. 'working': progressing. 'wait': ready but blocked. */
export type WorkResult = 'done' | 'working' | 'wait';

/** Do one tick of work on a job. `speed` is the crew member's resolved workSpeed. */
export function performJob(sim: Sim, crew: number, job: Job, speed: number): WorkResult {
  if ((job.kind === 'build' || job.kind === 'module' || job.kind === 'assemble') && needsMaterials(job)) return 'wait';
  switch (job.kind) {
    case 'haul': return performHaul(sim, crew, job);
    case 'craft': return performCraft(sim, job, speed);
    case 'research': return performResearch(sim, crew, job, speed);
    case 'build':
    case 'deconstruct': return timed(job, speed, () => finishStruct(sim, job));
    case 'module': return timed(job, speed, () => finishModule(sim, job));
    case 'moduleDecon': return timed(job, speed, () => {
      const m = sim.world.get(job.target ?? 0, ModuleC);
      const cost = m && sim.content.modules[m.def]?.cost;
      removeModule(sim, job.target ?? 0);
      if (m) refundCost(sim, shipIdOf(sim, job), m.x, m.y, cost); // after the tiles are free
      // Taking a module apart on a ship that is not the player's is salvage (the goal chain counts it).
      if (m && !playerShips(sim).has(shipIdOf(sim, job))) bumpStat(sim, 'gathered');
      return 'done';
    });
    case 'extinguish': return extinguish(sim, job, speed);
    case 'repair': return repair(sim, job, speed);
    case 'rescue': return rescue(sim, crew, job);
    case 'operate': return 'working'; // held until the operate-jobs system drops it
    case 'patrol': return timed(job, 1, () => 'done'); // stand watch at the stop, then the director posts the next one
    case 'mend': return performMend(sim, crew, job, speed);
    case 'salvage': return performSalvage(sim, job, speed);
    case 'hack': return performHack(sim, crew, job, speed);
    case 'assemble': return performAssemble(sim, job, speed);
    case 'suitUp':
    case 'suitOff': return performSuitJob(sim, crew, job, speed);
    case 'forceDoor': return timed(job, speed, () => {
      const grid = shipGrid(sim, shipIdOf(sim, job));
      if (grid?.has('jam') && grid.inBounds(job.x, job.y) && grid.get('jam', job.x, job.y) !== DoorJam.None) grid.set('jam', job.x, job.y, DoorJam.None);
      return 'done';
    });
  }
}

/** Accumulate progress; run `finish` when the work is complete. */
function timed(job: Job, speed: number, finish: () => WorkResult): WorkResult {
  job.progress = Math.min(job.work, job.progress + speed);
  return job.progress < job.work ? 'working' : finish();
}

function finishStruct(sim: Sim, job: Job): WorkResult {
  if (job.kind === 'build' && isTileOccupied(sim, shipIdOf(sim, job), job.x, job.y)) return 'wait';
  const grid = shipGrid(sim, shipIdOf(sim, job));
  if (grid?.has('struct') && grid.inBounds(job.x, job.y)) {
    const next = job.kind === 'build' ? job.struct : job.struct === Struct.Space ? Struct.Space : Struct.Floor; // a truss comes down to open space
    const before = grid.get('struct', job.x, job.y);
    if ((before === Struct.Rock || before === Struct.RockWall) && next === Struct.Floor) finishDig(sim, grid, shipIdOf(sim, job), job.x, job.y);
    else writeStruct(grid, job.x, job.y, next);
    // a shipyard tile belongs to the ship even when it is finished before its neighbours (the owner layer is otherwise inherited from them)
    if (job.yard && job.kind === 'build' && grid.get('ship', job.x, job.y) === 0) grid.set('ship', job.x, job.y, shipIdOf(sim, job));
    // built on an asteroid base: the new tile is the base's, not the asteroid's
    const ship = shipIdOf(sim, job);
    if (next !== Struct.Space && grid.get('ship', job.x, job.y) !== ship && sim.world.has(grid.get('ship', job.x, job.y), AsteroidC)) grid.set('ship', job.x, job.y, ship);
    if (job.kind === 'deconstruct' && before === Struct.Beam) dropPlanTile(sim, shipIdOf(sim, job), job.x, job.y); // the tile leaves the hull plan
    if (job.kind === 'deconstruct') {
      const key = structCostKey(before);
      refundCost(sim, shipIdOf(sim, job), job.x, job.y, key ? sim.content.structCosts[key] : undefined);
    }
    if (grid.has('item') && next !== Struct.Floor && next !== Struct.Ground) evictStack(sim, shipIdOf(sim, job), job.x, job.y);
  }
  consumeDelivered(job);
  return 'done';
}

function finishModule(sim: Sim, job: Job): WorkResult {
  const bp = job.module;
  const def = bp && sim.content.modules[bp.def];
  const grid = shipGrid(sim, shipIdOf(sim, job));
  if (!bp || !def || !grid?.has('module')) return 'done';
  if (footprintBlockedByCrew(sim, shipIdOf(sim, job), bp.def, job.x, job.y, bp.rot)) return 'wait';
  const tiles = footprintTiles(def, job.x, job.y, bp.rot);
  const base = (k: number) => k === Struct.Floor || k === Struct.Ground || k === Struct.Rock;
  const free = tiles.every((t) => grid.inBounds(t.x, t.y) && base(grid.get('struct', t.x, t.y)) && grid.get('module', t.x, t.y) === 0);
  if (!free) return 'done'; // a blueprint whose site was spoiled is dropped (delivered materials spill)
  // auto-level: the little rock mass the footprint clips becomes ground (its extra work was added to the job)
  for (const t of tiles) if (grid.get('struct', t.x, t.y) === Struct.Rock) writeStruct(grid, t.x, t.y, Struct.Ground);
  const id = spawnModule(sim, bp.def, job.x, job.y, bp.rot);
  const comes = def.vehicleBay?.builtWith;
  if (comes && sim.content.vehicles?.[comes]) spawnVehicle(sim, comes, id); // the pod bay comes with its pod
  consumeDelivered(job);
  if (grid.has('item')) for (const t of footprintTiles(def, job.x, job.y, bp.rot)) evictStack(sim, shipIdOf(sim, job), t.x, t.y);
  if (playerShips(sim).has(shipIdOf(sim, job))) bumpStat(sim, 'built');
  return 'done';
}

function extinguish(sim: Sim, job: Job, speed: number): WorkResult {
  const grid = shipGrid(sim, shipIdOf(sim, job));
  if (!grid?.has('fire') || !grid.inBounds(job.x, job.y)) return 'done';
  const left = grid.get('fire', job.x, job.y) - stochasticRound(sim, (EXTINGUISH_PER_SEC * speed) / TICK_HZ);
  grid.set('fire', job.x, job.y, Math.max(0, left));
  return left <= 0 ? 'done' : 'working';
}

function repair(sim: Sim, job: Job, speed: number): WorkResult {
  const m = sim.world.get(job.target ?? 0, ModuleC);
  const def = m && sim.content.modules[m.def];
  if (!m || !def) return 'done';
  m.hp = Math.min(def.maxHp, m.hp + (REPAIR_PER_SEC * speed) / TICK_HZ);
  if (m.wrecked && m.hp >= def.maxHp / 2) delete m.wrecked;
  if (m.hp < def.maxHp) return 'working';
  if (playerShips(sim).has(shipIdOf(sim, m))) bumpStat(sim, 'repaired');
  return 'done';
}

/**
 * Two phases, told apart by whether the patient is already carried. Pickup (rescuer next to the
 * patient): reserve a free bed, lift the patient, aim the job at the bed. Delivery (rescuer next to
 * the bed): lay the patient on it and stabilize them. The sim never lets two carriers share a patient.
 */
function rescue(sim: Sim, crew: number, job: Job): WorkResult {
  const patient = job.target ?? 0;
  const downed = sim.world.get(patient, DownedC);
  const patientPos = sim.world.get(patient, PositionC);
  const me = sim.world.get(crew, PositionC);
  if (!downed || !patientPos || !me) return 'done';
  const carried = sim.world.get(patient, CarriedC);

  if (!carried) {
    let bed = sim.world.get(job.bed ?? 0, ModuleC)?.reservedBy === patient ? (job.bed as number) : 0;
    if (!bed) {
      const plan = findFreeBed(sim, shipIdOf(sim, me), origin(me));
      if (!plan) return 'wait';
      bed = plan.bed;
      (sim.world.get(bed, ModuleC) as { reservedBy: number }).reservedBy = patient;
    }
    const target = sim.world.get(bed, ModuleC) as { x: number; y: number };
    job.bed = bed;
    job.x = target.x;
    job.y = target.y;
    downed.bed = bed;
    sim.world.add(patient, CarriedC, { carrier: crew });
    (sim.world.get(patient, CrewC) as Crew).activity = 'carried';
    return 'working';
  }
  if (carried.carrier !== crew) return 'wait';

  const bedModule = sim.world.get(job.bed ?? 0, ModuleC);
  if (!bedModule) return 'wait';
  const pos = patientPos as Position;
  pos.x = pos.toX = bedModule.x;
  pos.y = pos.toY = bedModule.y;
  pos.progress = 0;
  sim.world.remove(patient, CarriedC);
  downed.stabilized = true;
  (sim.world.get(patient, CrewC) as Crew).activity = 'downed';
  sim.events.emit({ type: 'crew.rescued', crew: patient, by: crew });
  return 'done';
}
