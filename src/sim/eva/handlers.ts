import type { Command } from '../commands';
import { CrewC, DeadC, DraftedC, PositionC } from '../crew/components';
import { isIncapacitated, releaseAssignment } from '../crew/helpers';
import { BodyC } from '../body';
import { gridOfShip, shipEntityOf } from '../combat/ships';
import type { Sim } from '../sim';
import { CrewC as CrewKey, type Crew } from '../crew/components';
import { SuitC } from '../portals/components';
import { VehicleC } from '../vehicles/components';
import { occupants, unboardCrew, vehicleDefOf } from '../vehicles/lifecycle';
import { EvaFloatC } from './components';
import { floatTicks, nearestExterior, tileCentre, tileFrame, vehicleSuits } from './shuttle';
import { startErrand, findSuitStow } from './errands';
import { planWalk } from './route';
import { airlockUsable, freeSuits, isSuited, needsAir, suitDef, suitTile } from './suit';
import { ModuleC } from '../modules/components';

type EvaCommandType = Extract<Command['type'], `eva.${string}`>;
type Handler<T extends EvaCommandType> = (sim: Sim, cmd: Extract<Command, { type: T }>) => void;

function reject(sim: Sim, command: string, reason: string): void {
  sim.events.emit({ type: 'command.rejected', command, reason });
}

/** Common checks: a living, drafted crew member who is able to act and stands on a grid. Returns false after rejecting. */
function ready(sim: Sim, type: string, crew: number): boolean {
  if (!sim.world.has(crew, CrewC) || sim.world.has(crew, DeadC)) return reject(sim, type, 'noCrew'), false;
  if (!sim.world.has(crew, DraftedC)) return reject(sim, type, 'notDrafted'), false;
  if (isIncapacitated(sim, crew) || !sim.world.has(crew, PositionC)) return reject(sim, type, 'incapacitated'), false;
  return true;
}

export const evaHandlers: { [T in EvaCommandType]: Handler<T> } = {
  'eva.suitUp': (sim, cmd) => {
    if (!ready(sim, cmd.type, cmd.crew)) return;
    const pos = sim.world.get(cmd.crew, PositionC)!;
    if (!needsAir(sim, cmd.crew)) return reject(sim, cmd.type, 'airless');
    if (isSuited(sim, cmd.crew)) return reject(sim, cmd.type, 'suited');
    const at = suitTile(sim, cmd.airlock);
    if (!at || !airlockUsable(sim, cmd.airlock)) return reject(sim, cmd.type, 'noAirlock');
    if (sim.world.get(cmd.airlock, ModuleC)?.gridId !== pos.gridId) return reject(sim, cmd.type, 'otherGrid');
    if (freeSuits(sim, cmd.airlock) <= 0) return reject(sim, cmd.type, 'noSuit');
    const plan = planWalk(sim, cmd.crew, pos.gridId, { x: pos.toX, y: pos.toY }, at);
    if (!plan) return reject(sim, cmd.type, 'unreachable');
    errand(sim, cmd.crew, 'suitUp', cmd.airlock, plan.steps, pos.gridId);
  },
  'eva.suitOff': (sim, cmd) => {
    if (!ready(sim, cmd.type, cmd.crew)) return;
    const pos = sim.world.get(cmd.crew, PositionC)!;
    if (!isSuited(sim, cmd.crew)) return reject(sim, cmd.type, 'notSuited');
    let airlock = cmd.airlock ?? 0;
    let steps = null as { x: number; y: number }[] | null;
    if (airlock) {
      const at = suitTile(sim, airlock);
      if (!at || !airlockUsable(sim, airlock)) return reject(sim, cmd.type, 'noAirlock');
      if (sim.world.get(airlock, ModuleC)?.gridId !== pos.gridId) return reject(sim, cmd.type, 'otherGrid');
      steps = planWalk(sim, cmd.crew, pos.gridId, { x: pos.toX, y: pos.toY }, at)?.steps ?? null;
    } else {
      const src = findSuitStow(sim, cmd.crew, pos);
      airlock = src?.airlock ?? 0;
      steps = src?.steps ?? null;
    }
    if (!airlock || !steps) return reject(sim, cmd.type, 'unreachable');
    errand(sim, cmd.crew, 'suitOff', airlock, steps, pos.gridId);
  },
  'eva.out': (sim, cmd) => {
    const v = sim.world.get(cmd.vehicle, VehicleC);
    const body = sim.world.get(cmd.vehicle, BodyC);
    if (!v || !body) return reject(sim, cmd.type, 'noVehicle');
    const gridId = gridOfShip(sim, v.hover ?? 0);
    if (v.state !== 'flying' || v.dest || !gridId) return reject(sim, cmd.type, 'notHovering');
    const aboard = cmd.crew === undefined ? [...v.passengers] : [cmd.crew];
    if (aboard.some((c) => !occupants(v).includes(c))) return reject(sim, cmd.type, 'notAboard');
    const going = aboard.filter((c) => needsAir(sim, c) && !sim.world.has(c, DeadC));
    if (going.length === 0) return reject(sim, cmd.type, 'airless');
    const frame = tileFrame(sim, gridId, body.x, body.y);
    const spots = frame ? nearestExterior(sim, gridId, frame, going.length) : [];
    if (!frame || spots.length === 0) return reject(sim, cmd.type, 'noHull');
    if ((spots[0] as { d: number }).d > suitDef(sim).floatRange) return reject(sim, cmd.type, 'outOfRange');
    if (vehicleSuits(sim, v) <= 0) return reject(sim, cmd.type, 'noSuit');
    going.slice(0, Math.min(going.length, vehicleSuits(sim, v), spots.length)).forEach((crew, i) => {
      const spot = spots[i] as { x: number; y: number; d: number };
      v.suits = vehicleSuits(sim, v) - 1;
      unboardCrew(sim, crew, cmd.vehicle, { gridId, x: spot.x, y: spot.y });
      if (!sim.world.has(crew, DraftedC)) sim.world.add(crew, DraftedC, { target: null });
      (sim.world.get(crew, CrewKey) as Crew).activity = 'drafted';
      sim.world.add(crew, SuitC, { worn: true, air: suitDef(sim).airSec, vehicle: cmd.vehicle });
      const land = tileCentre(sim, gridId, spot.x, spot.y) as { x: number; y: number };
      const start = hatchFace(body, land);
      const ticks = floatTicks(sim, Math.hypot(land.x - start.x, land.y - start.y));
      sim.world.add(crew, EvaFloatC, { mode: 'out', vehicle: cmd.vehicle, sx: start.x, sy: start.y, ticks, total: ticks });
      sim.events.emit({ type: 'suit.donned', crew, airlock: 0 });
    });
  },
  'eva.board': (sim, cmd) => {
    if (!ready(sim, cmd.type, cmd.crew)) return;
    const v = sim.world.get(cmd.vehicle, VehicleC);
    const body = sim.world.get(cmd.vehicle, BodyC);
    const pos = sim.world.get(cmd.crew, PositionC)!;
    if (!v || !body) return reject(sim, cmd.type, 'noVehicle');
    if (!isSuited(sim, cmd.crew)) return reject(sim, cmd.type, 'notSuited');
    if (v.state !== 'flying' || v.dest || !v.hover || v.hover !== shipEntityOf(sim, pos.gridId)) return reject(sim, cmd.type, 'notHovering');
    if (occupants(v).length >= (vehicleDefOf(sim, v)?.capacity ?? 0) + 1) return reject(sim, cmd.type, 'full');
    const at = tileCentre(sim, pos.gridId, pos.x, pos.y);
    const d = at ? Math.hypot(body.x - at.x, body.y - at.y) : Infinity;
    if (!at || d > suitDef(sim).floatRange) return reject(sim, cmd.type, 'outOfRange');
    releaseAssignment(sim, cmd.crew);
    const drafted = sim.world.get(cmd.crew, DraftedC)!;
    drafted.target = null;
    delete drafted.planned;
    const face = hatchFace(body, at);
    const ticks = floatTicks(sim, Math.hypot(at.x - face.x, at.y - face.y));
    sim.world.add(cmd.crew, EvaFloatC, { mode: 'back', vehicle: cmd.vehicle, sx: face.x, sy: face.y, ticks, total: ticks });
  },
};

/** Replace whatever the drafted crew member was doing with a suit errand (their move order is dropped). */
function errand(sim: Sim, crew: number, kind: 'suitUp' | 'suitOff', airlock: number, steps: { x: number; y: number }[], gridId: number): void {
  releaseAssignment(sim, crew);
  const drafted = sim.world.get(crew, DraftedC)!;
  drafted.target = null;
  delete drafted.planned;
  startErrand(sim, crew, kind, { airlock, steps }, gridId);
}

/** The point of the shuttle's hull-facing side (2.6 tiles from its centre toward the hull tile), in sector tiles: drifting crew start and end there, in view rather than under the sprite. */
function hatchFace(frame: { x: number; y: number }, to: { x: number; y: number }): { x: number; y: number } {
  const dx = to.x - frame.x;
  const dy = to.y - frame.y;
  const d = Math.hypot(dx, dy);
  const k = d > 0 ? Math.min(2.6, Math.max(0, d - 0.5)) / d : 0;
  return { x: frame.x + dx * k, y: frame.y + dy * k };
}
