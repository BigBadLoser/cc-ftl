import { playerShip } from '../../../sim';
import { deployShip, routeOf } from '../lib/trip';
import { definePart } from '../types';

export interface EventsSpec {
  /** Story flags set first. */
  flags?: Record<string, number>;
  /** A story event queued for the next trip (forced and due now): its first hop opens it as a signal. */
  queue?: string;
  /** A trip of this many hops from the current node, with the drive charged, run until the event opens (the decision is open: the signal window). */
  trip?: { hops: number };
  /** The returning pirate's trap or honest skiff, fixed instead of what the seed rolls, and the trap's slip (`debug.ambush`). */
  trap?: boolean;
  tell?: 'name' | 'lag';
  /** Fix the scene's raiders: left out, there from the start, or coming on their clock (`debug.sceneArrivals`). */
  raiders?: 'none' | 'here' | 'coming';
  /** Answers to the open decision, in order (`story.choose`, two ticks each), then the ship is deployed beside the scene. */
  choose?: readonly string[];
}
declare module '../types' { interface ScenarioSpec { events?: EventsSpec } }

/** Story events and the trip that opens them: the signal, its answers, and the drop-out beside the scene (the pirate ambush, the distress freighter, the medical pod). */
export default definePart<'events'>({
  key: 'events',
  after: ['ship', 'node', 'items', 'prep'],
  apply(ctx, e) {
    const { sim } = ctx;
    // Pre-start setup (as the tests always did): the flag is written, not sent, so the story does not also queue its own delayed copy of the event.
    for (const [flag, value] of Object.entries(e.flags ?? {})) sim.story.flags[flag] = value;
    if (e.queue) sim.story.queue.push({ event: e.queue, due: 0, force: true }); // pre-start setup: no command queues a forced event
    if (e.trip) {
      ctx.enqueue({ type: 'debug.chargeFtl' }, { type: 'galaxy.jump', ship: playerShip(sim), route: routeOf(sim, e.trip.hops) });
      ctx.until(() => sim.galaxy.travel?.phase === 'story', 90000, 'the trip opens its event');
      sim.events.drain();
    }
    if (e.trap !== undefined) ctx.enqueue({ type: 'debug.ambush', trap: e.trap, ...(e.tell ? { tell: e.tell } : {}) });
    if (e.raiders) ctx.enqueue({ type: 'debug.sceneArrivals', mode: e.raiders });
    if (e.trip) ctx.step();
    if (e.choose?.length) {
      for (const choice of e.choose) {
        ctx.enqueue({ type: 'story.choose', choice });
        ctx.step(2);
      }
      deployShip(ctx);
    }
  },
});
