import { definePart } from '../types';

export interface HookRef { name: string; args?: unknown }
declare module '../types' { interface ScenarioSpec { hooks?: readonly HookRef[] } }

/** Scenario hooks to attach once the scene is built (see `hooks/`); they run at `afterBuild`, per tick and on events. */
export default definePart<'hooks'>({
  key: 'hooks',
  after: ['steps'],
  apply(ctx, refs) {
    for (const r of refs) ctx.attach(r.name, r.args);
  },
});
