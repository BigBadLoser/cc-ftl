import { runSteps, type Step } from '../lib/steps';
import { definePart } from '../types';

declare module '../types' { interface ScenarioSpec { prep?: readonly Step[] } }

/** A script of commands and waits run before the story, crew, module and ship parts (a spare bed that must stand before a trip starts). */
export default definePart<'prep'>({
  key: 'prep',
  after: ['ship', 'node', 'items'],
  apply: (ctx, steps) => runSteps(ctx, steps),
});
