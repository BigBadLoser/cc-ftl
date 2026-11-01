import type { Command } from '../commands';
import type { Sim } from '../sim';
import { setFlag } from './effects';
import { choose, dismissNotice, openNotice, pump, startEvent } from './engine';
import { skipGoals } from './goals';

type StoryCommandType = Extract<Command['type'], `story.${string}`>;
type Handler<T extends StoryCommandType> = (sim: Sim, cmd: Extract<Command, { type: T }>) => void;

export const storyHandlers: { [T in StoryCommandType]: Handler<T> } = {
  'story.choose': (sim, cmd) => choose(sim, cmd.choice),
  'story.skipGoals': (sim) => skipGoals(sim),
  'story.fire': (sim, cmd) => {
    if (!sim.content.events?.[cmd.event]) return void sim.events.emit({ type: 'command.rejected', command: cmd.type, reason: 'noEvent' });
    startEvent(sim, cmd.event);
  },
  'story.setContext': (sim, cmd) => {
    const s = sim.story;
    if (cmd.danger !== undefined) s.context.danger = cmd.danger;
    if (cmd.faction !== undefined) s.context.faction = cmd.faction;
  },
  'story.openNotice': (sim, cmd) => openNotice(sim, cmd.notice),
  'story.dismissNotice': (sim, cmd) => dismissNotice(sim, cmd.notice),
  'story.setFlag': (sim, cmd) => {
    setFlag(sim, cmd.flag, cmd.value);
    pump(sim);
  },
};
