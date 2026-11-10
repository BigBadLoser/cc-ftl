import { describe, expect, it } from 'vitest';
import { CombatC, FTL_CHARGE_SEC, START_NODE, ShipC, deserialize, galaxyIndex, newGame, playerShip, serialize, type Sim } from '../sim';
import { DeadC } from '../sim/crew/components';
import { EggSacC, NestC } from '../sim/aliens/components';
import { hostileAboard } from '../sim/salvage/system';
import { SalvageOrderC } from '../sim/salvage/components';
import { applyEffect, giveItems } from '../sim/story/effects';
import { playerCrew, playerStock, withPlayerAboard } from '../sim/story/world';
import { VehicleC } from '../sim/vehicles/components';
import { buildStory } from './storySnapshot';
import { content } from '../content';

/** The derelict encounter (#173 step 3): the signal and its scan, the wreck in its pocket, and what the observer makes of working it. */

const step = (sim: Sim, n = 1) => {
  const out = [];
  for (let i = 0; i < n; i++) {
    sim.step();
    out.push(...sim.events.drain());
  }
  return out;
};
const deploy = (sim: Sim) => {
  for (const [x, y] of [[100, 60], [20, 50], [300, 200], [40, 150], [200, 20], [350, 100]] as const) {
    sim.enqueue({ type: 'sector.deploy', x, y });
    step(sim);
    if (sim.sector.state === 'active') break;
  }
};
const adjacent = (sim: Sim, id: string): string[] => (galaxyIndex(sim.galaxy).adjacent.get(id) ?? []).map((e) => (e.a === id ? e.b : e.a)).sort();
function routeOf(sim: Sim, hops: number): string[] {
  const route = [START_NODE];
  for (let h = 0; h < hops; h++) {
    const next = adjacent(sim, route[route.length - 1] as string).find((n) => !route.includes(n));
    if (!next) break;
    route.push(next);
  }
  return route.slice(1);
}
const choose = (sim: Sim, choice: string) => {
  sim.enqueue({ type: 'story.choose', choice });
  return step(sim, 2);
};

/** A two-hop trip whose first hop signals the derelict; stops with the decision open. `prep` runs on the fresh game. */
function signalled(seed: number, prep?: (sim: Sim) => void): Sim {
  const sim = newGame(seed, content);
  sim.story.goals.skipped = true;
  sim.galaxy.fleets = [];
  giveItems(sim, 'item.fuel', 80);
  prep?.(sim);
  const combat = sim.world.get(playerShip(sim), CombatC);
  if (combat) combat.ftl = FTL_CHARGE_SEC;
  sim.story.queue.push({ event: 'event.derelict_sighting', due: 0, force: true });
  sim.enqueue({ type: 'galaxy.jump', ship: playerShip(sim), route: routeOf(sim, 2) });
  for (let i = 0; i < 90000 && sim.galaxy.travel?.phase !== 'story'; i++) sim.step();
  sim.events.drain();
  return sim;
}
/** Into the derelict's scene, deployed. Returns its ship id. */
function inScene(seed: number): { sim: Sim; wreck: number } {
  const sim = signalled(seed);
  choose(sim, 'approach');
  deploy(sim);
  step(sim, 20);
  return { sim, wreck: sim.galaxy.event?.scene.derelicts[0]?.ship as number };
}
/** The first seed from `from` whose derelict has (or has not) life signs: egg sacs or a nest. */
function seedWith(infested: boolean, from = 1): number {
  for (let s = from; s < from + 40; s++) if (((signalled(s).galaxy.signal?.derelicts[0]?.read.sacs ?? 0) > 0) === infested) return s;
  throw new Error('no such seed');
}
const observed = (out: { type: string }[]) => out.filter((e): e is { type: 'scene.observed'; rule: string; text: string } & typeof e => e.type === 'scene.observed');

describe('derelict signal', () => {
  it('builds one derelict from the generator, with a scan reading; nothing spawns in hyperspace', () => {
    const sim = signalled(3);
    const d = sim.galaxy.signal?.derelicts[0];
    expect(sim.galaxy.signal?.derelicts).toHaveLength(1);
    expect(sim.galaxy.signal?.persistence).toBe('discovery');
    expect(d?.name).toBeTruthy();
    expect(d?.intensity).toBeGreaterThanOrEqual(0.3);
    expect(d?.intensity).toBeLessThanOrEqual(0.75);
    expect(d?.read.ruin).toBeGreaterThanOrEqual(0);
    expect(sim.world.query(ShipC)).toHaveLength(0);
    expect(signalled(3).galaxy.signal).toEqual(sim.galaxy.signal); // the same signal, the same wreck
  });

  it('a scan reads its condition, air and signs; it does not count them before the crew have worked wrecks', () => {
    const sim = signalled(seedWith(true));
    expect(buildStory(sim).active?.intel).toEqual([]);
    choose(sim, 'scan');
    const rows = buildStory(sim).active?.intel[0]?.rows ?? [];
    expect(rows.map((r) => r.label)).toEqual(expect.arrayContaining(['Make', 'Condition', 'Air', 'Signs']));
    const signs = rows.find((r) => r.label === 'Signs')?.value;
    expect(signs).toBe('Faint life signs');
    sim.story.flags['derelicts_found'] = 2; // practice: the reader of derelicts_found
    expect(buildStory(sim).active?.intel[0]?.rows.find((r) => r.label === 'Signs')?.value).toMatch(/about \d+/);
  });

  it('the hacking scan needs hacking 4, gives nothing but a deep read: counts and cargo without practice', () => {
    const probe = content.events['event.derelict_sighting'].choices.find((c) => c.id === 'probe');
    expect(probe?.requires).toEqual([{ kind: 'skill', skill: 'hacking', level: 4 }]);
    expect(choose(signalled(3), 'probe')).toContainEqual({ type: 'command.rejected', command: 'story.choose', reason: 'unmet' }); // starter crew: hacking 2
    const sim = signalled(seedWith(true), (s) => applyEffect(s, { type: 'skillXp', skill: 'hacking', amount: 300, who: 'all' }, { event: 'test', actor: null }));
    const before = withPlayerAboard(sim, () => playerStock(sim, 'item.electronics'));
    const out = choose(sim, 'probe');
    expect(out).toContainEqual({ type: 'story.remote', event: 'event.derelict_sighting', choice: 'probe', action: 'probe' });
    expect(withPlayerAboard(sim, () => playerStock(sim, 'item.electronics'))).toBe(before);
    const rows = buildStory(sim).active?.intel[0]?.rows ?? [];
    expect(rows.find((r) => r.label === 'Signs')?.value).toMatch(/^Egg sacs, about \d+$/);
  });

  it('after a scan the comms window still offers the probe, and the sensor action is the probe once both are done', () => {
    const sim = signalled(3, (s) => applyEffect(s, { type: 'skillXp', skill: 'hacking', amount: 300, who: 'all' }, { event: 'test', actor: null }));
    expect(buildStory(sim).active?.comms).toMatchObject({ scanned: false, scanChoice: 'scan', scanKind: 'scan' });
    choose(sim, 'scan');
    expect(buildStory(sim).active?.comms).toMatchObject({ scanned: true, scanChoice: 'probe', scanKind: 'probe' });
    choose(sim, 'probe');
    expect(buildStory(sim).active?.comms).toMatchObject({ scanned: true, scanChoice: null, scanKind: null });
  });

  it('dropping out needs an EVA shuttle in its bay', () => {
    const sim = signalled(3, (s) => {
      for (const id of s.world.query(VehicleC)) s.world.destroyEntity(id);
    });
    expect(choose(sim, 'approach')).toContainEqual({ type: 'command.rejected', command: 'story.choose', reason: 'unmet' });
  });
});

describe('derelict in its pocket', () => {
  it('investigating makes the wreck real beside the ship: a neutral wreck as the scan read it', () => {
    const { sim, wreck } = inScene(seedWith(true));
    const d = sim.galaxy.event?.scene.derelicts[0];
    const ship = sim.world.get(wreck, ShipC);
    expect(ship?.state).toBe('wreck');
    expect(ship?.faction).toBe('neutral');
    expect(ship?.name).toBe(d?.name);
    expect(d?.infested).toBe(true);
    expect(hostileAboard(sim, wreck)).toBe(true);
  });

  it('salvaging it counts a derelict found; clearing what was aboard sets a flag; leaving it flags it left', () => {
    const { sim, wreck } = inScene(seedWith(true));
    sim.world.add(wreck, SalvageOrderC, { types: ['hull'], status: 'running', done: 1, since: sim.tick });
    let out = step(sim, 25);
    expect(observed(out).map((e) => e.rule)).toContain('salvaged');
    expect(sim.story.flags['derelicts_found']).toBe(1);
    expect(observed(out).map((e) => e.rule)).not.toContain('cleared');
    for (const id of [...sim.world.query(EggSacC), ...sim.world.query(NestC)]) sim.world.destroyEntity(id);
    out = step(sim, 25);
    expect(observed(out).map((e) => e.rule)).toContain('cleared');
    expect(sim.story.flags['infestations_cleared']).toBe(1);
    step(sim, 25);
    expect(sim.story.flags['derelicts_found']).toBe(1); // once per wreck
    sim.enqueue({ type: 'galaxy.leaveEvent' });
    out = step(sim);
    expect(sim.galaxy.event).toBeNull();
    expect(sim.story.flags['derelicts_left']).toBe(1);
  });

  it('a crew member who dies out here is logged', () => {
    const { sim } = inScene(seedWith(false));
    const c = playerCrew(sim)[0] as number;
    sim.world.add(c, DeadC, { tick: sim.tick });
    const out = observed(step(sim, 25));
    expect(out.find((e) => e.rule === 'crewLost')?.text).toMatch(/did not come back/);
  });

  it('saves and loads mid-scene', () => {
    const { sim } = inScene(4);
    const copy = deserialize(serialize(sim), content);
    expect(copy.galaxy.event).toEqual(sim.galaxy.event);
    step(sim, 60);
    step(copy, 60);
    expect(serialize(copy)).toEqual(serialize(sim));
  });
});
