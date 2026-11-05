import type { Command } from '../commands';
import type { Sim } from '../sim';
import { isBreaking } from './helpers';

/**
 * Player orders that would give a crew member a job or an errand, or touch their path or task (an attack or a move order, un-drafting, a recall): the
 * crew ids each one names. A crew member whose break holds control (`isBreaking`: not suspended, not mild) takes none of them: the break machine is
 * the only path writer. Drafting a crew member stays allowed (the draft is suspended by a break). One guard, applied where commands are handled
 * (`Sim.apply`); a command that names several crew is rejected only when all of them are breaking (the handlers skip the breaking ones).
 */
const ASSIGNING: Partial<{ [T in Command['type']]: (cmd: Extract<Command, { type: T }>) => number[] }> = {
  'crew.man': (c) => [c.id],
  'crew.attack': (c) => [c.id],
  'crew.moveTo': (c) => [c.id],
  'crew.moveGroup': (c) => c.ids,
  'crew.draft': (c) => (c.drafted ? [] : [c.id]), // un-drafting clears the path
  'crew.recall': (c) => c.ids,
  'crew.cancelSabotage': (c) => c.ids,
  'crew.hack': (c) => [c.id],
  'crew.forceDoor': (c) => c.ids,
  'crew.sabotage': (c) => c.ids,
  'eva.suitUp': (c) => [c.crew],
  'eva.suitOff': (c) => [c.crew],
  'eva.refill': (c) => [c.crew],
  'eva.board': (c) => [c.crew],
  'vehicle.embark': (c) => [c.crew],
};

/** The rejection reason for an order that assigns work to crew whose break holds control (every crew member it names), else null. */
export function breakOrderRejection(sim: Sim, cmd: Command): 'breaking' | null {
  const ids = (ASSIGNING[cmd.type] as ((c: Command) => number[]) | undefined)?.(cmd);
  return ids && ids.length > 0 && ids.every((id) => isBreaking(sim, id)) ? 'breaking' : null;
}
