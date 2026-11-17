import { definePart } from '../types';

export interface ItemsSpec {
  credits?: number;
  /** Items into the player's storage, as a reward would (item id -> count). */
  give?: Record<string, number>;
}
declare module '../types' { interface ScenarioSpec { items?: ItemsSpec } }

/** Credits and goods in the hold (`debug.setCredits`, `debug.giveItems`). */
export default definePart<'items'>({
  key: 'items',
  after: ['node'],
  apply(ctx, i) {
    if (i.credits !== undefined) ctx.enqueue({ type: 'debug.setCredits', value: i.credits });
    for (const [item, count] of Object.entries(i.give ?? {})) ctx.enqueue({ type: 'debug.giveItems', item, count });
    ctx.step();
  },
});
