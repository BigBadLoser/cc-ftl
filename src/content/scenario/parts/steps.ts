import { runSteps, type Step } from '../lib/steps';
import { definePart } from '../types';

declare module '../types' { interface ScenarioSpec { steps?: readonly Step[] } }

/** The escape hatch of a preset: an ordered script of commands and waits, run after every other part (`prep` runs the same kind of script before them). */
export default definePart<'steps'>({
  key: 'steps',
  after: ['ship', 'node', 'items', 'prep', 'events', 'crew', 'modules', 'ships'],
  apply: (ctx, steps) => runSteps(ctx, steps),
});
