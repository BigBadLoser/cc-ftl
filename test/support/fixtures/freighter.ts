import { CombatC, ShipC } from '../../../src/sim/combat/components';
import { galaxyIndex, START_NODE } from '../../../src/sim/galaxy/state';
import { newGame } from '../../../src/sim/newGame';
import type { Sim } from '../../../src/sim/sim';
import type { EventDef } from '../../../src/sim/story/defs';
import { playerShip } from '../../../src/sim/trade/player';
import { FTL_CHARGE_SEC } from '../../../src/sim/tuning';
import { CrewC, PositionC } from '../../../src/sim/crew/components';
import { AllegianceC } from '../../../src/sim/fight/components';
import { shipGrid, shipIdOf } from '../../../src/sim/regions';
import { giveItems } from '../../../src/sim/story/effects';
import type { SceneShipRecipe } from '../../../src/sim/scene/types';
import { content } from '../content';
import { expect } from 'vitest';
import { run } from '../run';
import { fileCache } from '../cache';

/** The distress freighter (#173 step 5): a helpless ship, aid by hail with guests aboard, the reactor clock (fires, then it blows), raiders, the observer. */

/** Setup for the distress freighter tests (freighter.test.ts, freighter.slow.test.ts): a two-hop trip to the signal, the scene deployed, and the state readers. */
export const deploy = (sim: Sim) => {
  for (const [x, y] of [[100, 60], [20, 50], [300, 200], [40, 150], [200, 20], [350, 100]] as const) {
    sim.enqueue({ type: 'sector.deploy', x, y });
    run(sim, 1);
    if (sim.sector.state === 'active') break;
  }
};
export const adjacent = (sim: Sim, id: string): string[] => (galaxyIndex(sim.galaxy).adjacent.get(id) ?? []).map((e) => (e.a === id ? e.b : e.a)).sort();
export function routeOf(sim: Sim, hops: number): string[] {
  const route = [START_NODE];
  for (let h = 0; h < hops; h++) {
    const next = adjacent(sim, route[route.length - 1] as string).find((n) => !route.includes(n));
    if (!next) break;
    route.push(next);
  }
  return route.slice(1);
}

export const EVENT = 'event.distress_call';
export const base = content.events[EVENT] as EventDef;
/** The content with the freighter's raiders fixed: left out, there from the start, or coming on their clock. */
export const raiderContent = fileCache<string, typeof content>();
export function withRaiders(mode: 'none' | 'here' | 'coming'): typeof content {
  const made = raiderContent.get(mode);
  if (made) return made;
  const ships = (base.scene?.ships ?? []).map((r): SceneShipRecipe => {
    if (!r.arrive) return r;
    const rest = { ...r };
    delete rest.danger;
    return { ...rest, chance: mode === 'none' ? 0 : 1, arrive: { ...r.arrive, chance: mode === 'coming' ? 1 : 0 } };
  });
  const c = { ...content, events: { ...content.events, [EVENT]: { ...base, scene: { ...base.scene!, ships } } } } as typeof content;
  raiderContent.set(mode, c);
  return c;
}

/** A two-hop trip whose first hop signals the freighter; stops with the decision open. */
export function signalled(seed: number, c = content): Sim {
  const sim = newGame(seed, c);
  sim.story.goals.skipped = true;
  sim.galaxy.fleets = [];
  giveItems(sim, 'item.fuel', 80);
  const combat = sim.world.get(playerShip(sim), CombatC);
  if (combat) combat.ftl = FTL_CHARGE_SEC;
  sim.story.queue.push({ event: EVENT, due: 0, force: true });
  sim.enqueue({ type: 'galaxy.jump', ship: playerShip(sim), route: routeOf(sim, 2) });
  for (let i = 0; i < 90000 && sim.galaxy.travel?.phase !== 'story'; i++) sim.step();
  sim.events.drain();
  return sim;
}
export const choose = (sim: Sim, choice: string) => {
  sim.enqueue({ type: 'story.choose', choice });
  return run(sim, 2);
};
/** Into the freighter's scene, deployed (`help`: help was offered on the hail first). */
export function buildScene(seed: number, opts: { help?: boolean; c?: typeof content } = {}): Sim {
  const sim = signalled(seed, opts.c ?? withRaiders('none'));
  if (opts.help) choose(sim, 'hail');
  choose(sim, opts.help ? 'help' : 'approach');
  deploy(sim);
  for (let i = 0; i < 40 && sim.galaxy.event?.scene.timers.some((t) => t.at === undefined); i++) run(sim, 1); // the clock starts at deploy (next scene second)
  return sim;
}
export const freighterOf = (sim: Sim): number => sim.galaxy.event?.scene.ships.find((x) => x.tag === 'freighter')?.contact.ship as number;
export const spec = (sim: Sim) => sim.galaxy.event!.scene.ships.find((x) => x.tag === 'freighter')!;
export const timer = (sim: Sim) => sim.galaxy.event!.scene.timers[0]!;
export const firesOn = (sim: Sim, ship: number): number => {
  const g = shipGrid(sim, ship)!;
  let n = 0;
  for (let y = g.y0; y < g.y0 + g.height; y++) for (let x = g.x0; x < g.x0 + g.width; x++) if (g.get('fire', x, y) > 0) n++;
  return n;
};
export const fired = (sim: Sim): string[] => sim.galaxy.event!.watch.fired.map((k) => k.split('#')[0] as string);
/** Stand one of the player's crew on a floor tile of the ship. */
export function standOn(sim: Sim, ship: number, crew: number): void {
  const s = sim.world.get(ship, ShipC) as { x: number; y: number; width: number; height: number };
  const pos = sim.world.get(crew, PositionC) as { x: number; y: number };
  const g = shipGrid(sim, ship)!;
  for (let y = s.y; y < s.y + s.height; y++) for (let x = s.x; x < s.x + s.width; x++) {
    if (g.get('struct', x, y) === 1 && shipIdOf(sim, { x, y }) === ship) {
      pos.x = x;
      pos.y = y;
      return;
    }
  }
}
export const countSpace = (sim: Sim, ship: number): number => {
  const s = sim.world.get(ship, ShipC)!;
  const g = shipGrid(sim, ship)!;
  let n = 0;
  for (let y = s.y; y < s.y + s.height; y++) for (let x = s.x; x < s.x + s.width; x++) if (g.get('struct', x, y) === 0) n++;
  return n;
};
export const playerCrewIds = (sim: Sim): number[] => sim.world.query(CrewC, PositionC).filter((id) => sim.world.get(id, AllegianceC)?.faction === 'player');

/** The party flies over, mends the reactor before the clock runs out, and comes home (from a scene with help agreed). */
export function expectPartyMends(sim: Sim): void {
  const freighter = freighterOf(sim);
    const s = spec(sim);
    let aboard = 0;
    for (let i = 0; i < 150 && s.aid?.state !== 'done'; i++) {
      run(sim, 20);
      aboard = Math.max(aboard, playerCrewIds(sim).filter((c) => shipIdOf(sim, sim.world.get(c, PositionC)!) === freighter).length);
    }
    expect(aboard).toBeGreaterThan(0);
    expect(s.aid?.state).toBe('done');
    expect(timer(sim).stopped).toBe(true);
    expect(sim.world.get(freighter, ShipC)).toMatchObject({ faction: 'neutral', state: 'active' });
    expect(sim.world.get(freighter, ShipC)?.provoked).toBeUndefined();
    expect(fired(sim)).toContain('helped');
    expect(fired(sim)).not.toContain('boarded');
}
