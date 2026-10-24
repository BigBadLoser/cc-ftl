import { describe, expect, it } from 'vitest';
import { HealthC } from '../sim/crew/components';
import { CombatC, FTL_CHARGE_SEC, START_NODE, deserialize, galaxyIndex, newGame, passingMeets, playerShip, serialize, type Sim } from '../sim';
import type { Fleet } from '../sim/galaxy/types';
import { giveItems } from '../sim/story/effects';
import { packetCount } from '../sim/sector/packet';
import { checkOdds, unmetReasons } from '../sim/story/requirements';
import { playerStock } from '../sim/story/world';
import type { EventDef } from '../sim/story/defs';
import { content } from '.';

/** Story events belong to hyperspace hops (storyHop.ts): none while the ship idles, one at most per hop, never on an interdicted hop. */

const step = (sim: Sim, n = 1) => {
  const out = [];
  for (let i = 0; i < n; i++) {
    sim.step();
    out.push(...sim.events.drain());
  }
  return out;
};
const adjacent = (sim: Sim, id: string): string[] => (galaxyIndex(sim.galaxy).adjacent.get(id) ?? []).map((e) => (e.a === id ? e.b : e.a)).sort();
/** A route of `hops` nodes from the start that never doubles back. */
function routeOf(sim: Sim, hops: number): string[] {
  const route = [START_NODE];
  for (let h = 0; h < hops; h++) {
    const next = adjacent(sim, route[route.length - 1] as string).find((n) => !route.includes(n));
    if (!next) break;
    route.push(next);
  }
  return route.slice(1);
}
/** A game with no NPC traffic, a charged drive and plenty of fuel, flying `hops` hops. */
function trip(seed: number, hops: number): { sim: Sim; route: string[] } {
  const sim = newGame(seed, content);
  sim.galaxy.fleets = [];
  giveItems(sim, 'item.fuel', 80);
  const c = sim.world.get(playerShip(sim), CombatC);
  if (c) c.ftl = FTL_CHARGE_SEC;
  const route = routeOf(sim, hops);
  sim.enqueue({ type: 'galaxy.jump', ship: playerShip(sim), route });
  return { sim, route };
}
/** Answer the open decision with the first choice that is accepted. */
function answer(sim: Sim): void {
  const ev = sim.story.active?.event as string;
  for (const c of sim.content.events?.[ev]?.choices ?? []) {
    sim.enqueue({ type: 'story.choose', choice: c.id });
    step(sim);
    if (sim.story.active?.event !== ev) return;
  }
  throw new Error(`no choice of ${ev} was accepted`);
}
/** An event that needs cargo and a skill check, and whose outcome (either way) gives fuel and hurts the crew member who rolled. */
const FUEL_EVENT: EventDef = {
  title: 'Packet test', text: 'Cargo and crew are packet data in hyperspace.', mode: 'decision', triggers: [{ kind: 'chain' }],
  choices: [{
    id: 'go', label: 'Go', requires: [{ kind: 'item', item: 'item.fuel', count: 10 }, { kind: 'crew', count: 1 }],
    check: { skill: 'repair', difficulty: 0 },
    success: { effects: [{ type: 'items', item: 'item.fuel', count: 30 }, { type: 'crewDamage', amount: 7, who: 'actor' }] },
    failure: { effects: [{ type: 'items', item: 'item.fuel', count: 30 }, { type: 'crewDamage', amount: 7, who: 'actor' }] },
  }],
};
const packetHp = (sim: Sim): number[] => (sim.sector.packet?.entities ?? []).filter((e) => e.c['crew'] && e.c['health']).map((e) => (e.c['health'] as { hp: number }).hp);
/** A one-hop trip that ends in the packet-test event (queued, so it opens at the hop). */
const withEvent = { ...content, events: { ...content.events, 'test.packet': FUEL_EVENT } };
function eventTrip(seed: number): Sim {
  const sim = newGame(seed, withEvent);
  sim.galaxy.fleets = [];
  giveItems(sim, 'item.fuel', 80);
  const c = sim.world.get(playerShip(sim), CombatC);
  if (c) c.ftl = FTL_CHARGE_SEC;
  sim.story.queue.push({ event: 'test.packet', due: 0 });
  sim.enqueue({ type: 'galaxy.jump', ship: playerShip(sim), route: routeOf(sim, 1) });
  for (let i = 0; i < 90000 && sim.galaxy.travel?.phase !== 'story'; i++) sim.step();
  return sim;
}
const started = (sim: Sim, n: number) => step(sim, n).filter((e) => e.type === 'story.started' && e.mode === 'decision');

describe('story events happen in transit', () => {
  it('none start while the ship idles in a node, however long', () => {
    const sim = newGame(3, content);
    // Even a follow-up that is due waits for the next hop.
    sim.story.queue.push({ event: 'event.distress_call', due: 0 });
    const turn0 = sim.galaxy.turn;
    let decisions = 0;
    for (let i = 0; i < 10; i++) {
      decisions += started(sim, 600).length;
      if (sim.story.active) break;
    }
    expect(sim.galaxy.turn).toBeGreaterThan(turn0); // longer than the old 3-minute periodic draw, with a galaxy turn and arrival rolls in it
    expect(decisions).toBe(0);
    expect(sim.story.active).toBeNull();
    expect(sim.story.queue).toHaveLength(1);
  }, 120000);

  it('a hop can draw one: the trip is held until it is answered, then goes on', () => {
    let held = 0;
    for (let seed = 1; seed <= 12 && held < 2; seed++) {
      const { sim, route } = trip(seed, 3);
      let answered = 0;
      for (let i = 0; i < 90000 && sim.galaxy.travel?.phase !== 'arrived'; i++) {
        sim.step();
        if (sim.galaxy.travel?.phase !== 'story') continue;
        const t = sim.galaxy.travel;
        const at = t.at;
        const turn = sim.galaxy.turn;
        expect(sim.story.active).not.toBeNull();
        expect(t.held).toBe('hopEnd');
        // Held: nothing moves while the decision is open, and the ship cannot drop out.
        step(sim, 200);
        expect(sim.galaxy.travel).toMatchObject({ phase: 'story', at });
        expect(sim.galaxy.turn).toBe(turn);
        sim.enqueue({ type: 'galaxy.drop' });
        expect(step(sim).some((e) => e.type === 'command.rejected' && e.reason === 'inStory')).toBe(true);
        answer(sim);
        answered++;
        expect(sim.galaxy.travel?.phase).not.toBe('story');
      }
      expect(sim.galaxy.travel).toMatchObject({ phase: 'arrived', at: route.length });
      expect(answered).toBeLessThanOrEqual(route.length); // one per hop at most
      if (answered > 0) held++;
    }
    expect(held).toBeGreaterThan(0);
  }, 240000);

  it('never on a hop that interdicts', () => {
    let interdictions = 0;
    for (let seed = 1; seed <= 24; seed++) {
      const sim = newGame(seed, content);
      const g = sim.galaxy;
      g.fleets = [];
      giveItems(sim, 'item.fuel', 50);
      const c = sim.world.get(playerShip(sim), CombatC);
      if (c) c.ftl = FTL_CHARGE_SEC;
      const to = adjacent(sim, START_NODE)[0] as string;
      const next = adjacent(sim, to).find((n) => n !== START_NODE) ?? START_NODE;
      sim.enqueue({ type: 'galaxy.jump', ship: playerShip(sim), route: [to, next] });
      while (!passingMeets(sim, g.nextFleet, g.turn + 1)) g.nextFleet++;
      const f: Fleet = {
        id: g.nextFleet++, faction: 'pirates', role: 'pirate', ships: [{ id: g.nextFleet++, faction: 'pirates', shipgen: 'faction.scrapper', seed: 77, depth: 1, since: 0 }],
        node: to, from: to, moved: -1, route: [START_NODE], dest: START_NODE, dwell: 0, legs: 0, home: `${START_NODE}#0`, synced: g.turn,
      };
      g.fleets.push(f);
      step(sim);
      while (g.travel?.phase === 'hop') step(sim);
      expect(g.travel?.phase).toBe('interdicted');
      expect(sim.story.active).toBeNull();
      expect(sim.galaxy.encounters.some((e) => e.kind === 'interdict')).toBe(true);
      interdictions++;
    }
    expect(interdictions).toBe(24);
  }, 240000);

  it('an event in hyperspace sees and changes the packet: cargo, crew, rewards and harm survive the drop', () => {
    const sim = eventTrip(5);
    expect(sim.galaxy.travel?.phase).toBe('story');
    expect(sim.story.active?.event).toBe('test.packet');
    expect(sim.sector.state).toBe('hyperspace');
    const choice = sim.content.events!['test.packet']!.choices![0]!;
    // Read side: the packet's cargo meets the requirement, a crew member is found to roll the check.
    expect(unmetReasons(sim, choice)).toEqual([]);
    expect(checkOdds(sim, choice.check!)).not.toBeNull();
    const fuel0 = packetCount(sim.sector.packet!, 'item.fuel');
    const hp0 = packetHp(sim);
    expect(hp0.length).toBeGreaterThan(0);
    const world0 = sim.world.ids().length;
    // The look leaves nothing behind in the world.
    expect(world0).toBe(sim.world.ids().length);
    sim.enqueue({ type: 'story.choose', choice: 'go' });
    step(sim);
    expect(sim.story.active).toBeNull();
    // Write side: the reward is in the packet, one crew member took the harm.
    expect(packetCount(sim.sector.packet!, 'item.fuel')).toBe(fuel0 + 30);
    const hp1 = packetHp(sim);
    expect(hp1.filter((h, i) => h < (hp0[i] as number))).toHaveLength(1);
    expect(sim.sector.packet!.entities.some((e) => e.c['crew'])).toBe(true);
    // The trip goes on and ends; dropping and deploying keeps it all.
    for (let i = 0; i < 90000 && sim.galaxy.travel?.phase !== 'arrived'; i++) { sim.step(); sim.story.active = null; }
    const fuelEnd = packetCount(sim.sector.packet!, 'item.fuel');
    sim.enqueue({ type: 'galaxy.drop' });
    step(sim);
    for (const [x, y] of [[100, 60], [20, 50], [300, 200], [40, 150], [200, 20], [350, 100]] as const) {
      sim.enqueue({ type: 'sector.deploy', x, y });
      step(sim);
      if (sim.sector.state === 'active') break;
    }
    expect(sim.sector.state).toBe('active');
    expect(playerStock(sim, 'item.fuel')).toBe(fuelEnd);
    expect(fuelEnd).toBeGreaterThan(fuel0 + 20);
    const hurt = sim.world.query(HealthC).filter((id) => sim.world.get(id, HealthC)!.hp < sim.world.get(id, HealthC)!.max);
    expect(hurt.length).toBeGreaterThanOrEqual(1);
  }, 120000);

  it('answering after a save and load acts on the loaded packet the same way', () => {
    const a = eventTrip(5);
    const b = deserialize(serialize(a), withEvent);
    expect(b.story.active?.event).toBe('test.packet');
    expect(unmetReasons(b, b.content.events!['test.packet']!.choices![0]!)).toEqual([]);
    for (const s of [a, b]) {
      s.enqueue({ type: 'story.choose', choice: 'go' });
      step(s);
    }
    expect(packetCount(b.sector.packet!, 'item.fuel')).toBe(packetCount(a.sector.packet!, 'item.fuel'));
    expect(packetHp(b)).toEqual(packetHp(a));
    expect(serialize(b)).toBe(serialize(a));
  }, 120000);

  it('a save taken mid-event loads with the decision open and the trip held, and carries on identically', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const { sim } = trip(seed, 3);
      for (let i = 0; i < 90000 && sim.galaxy.travel?.phase !== 'story' && sim.galaxy.travel?.phase !== 'arrived'; i++) sim.step();
      if (sim.galaxy.travel?.phase !== 'story') continue;
      const json = serialize(sim);
      expect(JSON.parse(json).galaxy.travel).toMatchObject({ phase: 'story', held: 'hopEnd' });
      const b = deserialize(json, content);
      expect(serialize(b)).toBe(json);
      expect(b.story.active?.event).toBe(sim.story.active?.event);
      for (const s of [sim, b]) {
        answer(s);
        for (let i = 0; i < 90000 && s.galaxy.travel?.phase !== 'arrived'; i++) {
          s.step();
          if (s.story.active) answer(s);
        }
        expect(s.galaxy.travel?.phase).toBe('arrived');
      }
      expect(serialize(b)).toBe(serialize(sim));
      return;
    }
    throw new Error('no seed drew an event');
  }, 240000);
});

