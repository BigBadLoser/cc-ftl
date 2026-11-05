import type { Command } from '../commands';
import type { Sim } from '../sim';
import { isBreaking } from './helpers';

/**
 * Player orders that would give a crew member a job or an errand (an assignment): the crew ids each one names. A crew member whose break holds control
 * (`isBreaking`: not suspended, not mild) takes none of them: the break machine is the only path writer. Drafting and moving a drafted crew member
 * keep their behaviour (the draft is suspended by a break). One guard, applied where commands are handled (`Sim.apply`).
 */
const ASSIGNING: Partial<{ [T in Command['type']]: (cmd: Extract<Command, { type: T }>) => number[] }> = {
  'crew.man': (c) => [c.id],
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
