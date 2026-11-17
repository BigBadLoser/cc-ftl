import { galaxyIndex, playerShip, type Sim } from '../../../sim';
import { definePart, type BuildCtx } from '../types';

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

/** Free spots to try for a deployment, in order (a rejected one overlaps something). */
const DEPLOY_SPOTS = [[100, 60], [20, 50], [300, 200], [40, 150], [200, 20], [350, 100]] as const;

/** `hops` nodes out from the current one, always taking the first neighbour (by id) not already on the route. */
export function routeOf(sim: Sim, hops: number): string[] {
  const adjacent = (id: string): string[] => (galaxyIndex(sim.galaxy).adjacent.get(id) ?? []).map((e) => (e.a === id ? e.b : e.a)).sort();
  const route = [sim.galaxy.current];
  for (let h = 0; h < hops; h++) {
    const next = adjacent(route[route.length - 1] as string).find((n) => !route.includes(n));
    if (!next) break;
    route.push(next);
  }
  return route.slice(1);
}

/** Deploy the ship at the first free spot, once the node asks for it. */
export function deployShip(ctx: BuildCtx): void {
  for (const [x, y] of DEPLOY_SPOTS) {
    ctx.enqueue({ type: 'sector.deploy', x, y });
    ctx.step();
    if (ctx.sim.sector.state === 'active') return;
  }
}

/** Story events and the trip that opens them: the signal, its answers, and the drop-out beside the scene (the pirate ambush, the distress freighter, the medical pod). */
export default definePart<'events'>({
  key: 'events',
  after: ['ship', 'node', 'items'],
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
