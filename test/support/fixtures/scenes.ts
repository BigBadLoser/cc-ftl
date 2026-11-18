/** Shared setups of the physical-encounter tests (scenes, #173) and their slow tier: a trip to the trader skiff's signal, and into its scene. */
import { CombatC } from '../../../src/sim/combat/components';
import { START_NODE } from '../../../src/sim/galaxy/state';
import { newGame } from '../../../src/sim/newGame';
import type { Sim } from '../../../src/sim/sim';
import { giveItems } from '../../../src/sim/story/effects';
import { playerShip } from '../../../src/sim/trade/player';
import { FTL_CHARGE_SEC } from '../../../src/sim/tuning';
import { content } from '../content';
import { cachedWorld } from '../world';
import { adjacent, step, deploy } from './traffic';

export function routeOf(sim: Sim, hops: number): string[] {
  const route = [START_NODE];
  for (let h = 0; h < hops; h++) {
    const next = adjacent(sim, route[route.length - 1] as string).find((n) => !route.includes(n));
    if (!next) break;
    route.push(next);
  }
  return route.slice(1);
}

function signalledFresh(seed: number, c: typeof content): Sim {
  const sim = newGame(seed, c);
  sim.story.goals.skipped = true;
  sim.galaxy.fleets = [];
  giveItems(sim, 'item.fuel', 80);
  const combat = sim.world.get(playerShip(sim), CombatC);
  if (combat) combat.ftl = FTL_CHARGE_SEC;
  sim.story.queue.push({ event: 'event.trader_swap', due: 0, force: true });
  sim.enqueue({ type: 'galaxy.jump', ship: playerShip(sim), route: routeOf(sim, 2) });
  for (let i = 0; i < 90000 && sim.galaxy.travel?.phase !== 'story'; i++) sim.step();
  sim.events.drain();
  return sim;
}

export const choose = (sim: Sim, choice: string) => {
  sim.enqueue({ type: 'story.choose', choice });
  return step(sim, 2);
};

/**
 * A two-hop trip whose first hop signals the trader skiff (queued, so it opens at the hop); stops with the decision open. The trip steps
 * thousands of ticks and most cases start from the same one, so the default content builds it once per file (a variant content builds fresh).
 */
export function signalled(seed: number, c = content): Sim {
  return c === content ? cachedWorld(`signalled:${seed}`, () => signalledFresh(seed, c)) : signalledFresh(seed, c);
}

function sceneFresh(seed: number, c: typeof content): Sim {
  const sim = signalledFresh(seed, c);
  choose(sim, 'approach');
  deploy(sim);
  return sim;
}

/** Into the skiff's scene, deployed. Returns the skiff's ship id. */
export function inScene(seed: number, c = content): { sim: Sim; skiff: number } {
  const sim = c === content ? cachedWorld(`inScene:${seed}`, () => sceneFresh(seed, c)) : sceneFresh(seed, c);
  return { sim, skiff: sim.galaxy.event?.scene.ships[0]?.contact.ship as number };
}
