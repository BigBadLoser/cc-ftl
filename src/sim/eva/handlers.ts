import type { Command } from '../commands';
import { CrewC, DeadC, DraftedC, PositionC } from '../crew/components';
import { isIncapacitated, releaseAssignment } from '../crew/helpers';
import type { Sim } from '../sim';
import { startErrand, findSuitStow } from './errands';
import { planWalk } from './route';
import { airlockUsable, freeSuits, isSuited, needsAir, suitTile } from './suit';
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
};

/** Replace whatever the drafted crew member was doing with a suit errand (their move order is dropped). */
function errand(sim: Sim, crew: number, kind: 'suitUp' | 'suitOff', airlock: number, steps: { x: number; y: number }[], gridId: number): void {
  releaseAssignment(sim, crew);
  const drafted = sim.world.get(crew, DraftedC)!;
  drafted.target = null;
  delete drafted.planned;
  startErrand(sim, crew, kind, { airlock, steps }, gridId);
}
