import { describe, expect, it } from 'vitest';
import { CombatC, FTL_CHARGE_SEC, START_NODE, TICK_HZ, galaxyIndex, newGame, playerShip, type Sim } from '../sim';
import { CrewC, DeadC, DownedC, HealthC, NeedsC, PositionC } from '../sim/crew/components';
import { boardCrew } from '../sim/vehicles/lifecycle';
import { POD_HOLD_SEC } from '../sim/vehicles/escape';
import { lodgingHere } from '../sim/consent/guests';
import { placementGapError, shipIdOf } from '../sim/regions';
import { giveItems } from '../sim/story/effects';
import { AboardC, VehicleC } from '../sim/vehicles/components';
import { deserialize, serialize } from '../sim/save';
import { ConsentC } from '../sim/consent/components';
import { content } from '.';

/** The medical pod (#173 step 6): an escape pod adrift with a bleeding patient; called in, it docks and lets them out, and the crew carry them to a bed. */

const EVENT = 'event.medical_emergency';
const step = (sim: Sim, n = 1) => {
  for (let i = 0; i < n; i++) sim.step();
  sim.events.drain();
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

/** A two-hop trip whose first hop signals the pod; stops with the decision open. */
function signalled(seed: number, hops = 2): Sim {
  const sim = newGame(seed, content);
  sim.story.goals.skipped = true;
  sim.galaxy.fleets = [];
  giveItems(sim, 'item.fuel', 80);
  const combat = sim.world.get(playerShip(sim), CombatC);
  if (combat) combat.ftl = FTL_CHARGE_SEC;
  sim.story.queue.push({ event: EVENT, due: 0, force: true });
  sim.enqueue({ type: 'galaxy.jump', ship: playerShip(sim), route: routeOf(sim, hops) });
  for (let i = 0; i < 90000 && sim.galaxy.travel?.phase !== 'story'; i++) sim.step();
  sim.events.drain();
  return sim;
}

/** Dropped out beside the pod and deployed; the pod is real once the scene's next second has passed. */
function inScene(seed: number, hops = 2): Sim {
  const sim = signalled(seed, hops);
  sim.enqueue({ type: 'story.choose', choice: 'approach' });
  step(sim, 2);
  for (const [x, y] of [[100, 60], [20, 50], [300, 200], [40, 150], [200, 20], [350, 100]] as const) {
    sim.enqueue({ type: 'sector.deploy', x, y });
    step(sim);
    if (sim.sector.state === 'active') break;
  }
  for (let i = 0; i < 40 && pod(sim).vehicle === undefined; i++) step(sim);
  return sim;
}
const pod = (sim: Sim) => sim.galaxy.event!.scene.pods![0]!;
const fired = (sim: Sim): string[] => sim.galaxy.event!.watch.fired.map((k) => k.split('#')[0] as string);

describe('the medical pod', () => {
  it('rolls one named patient with a role, an origin and a bleed time, the same for the same signal', () => {
    const a = signalled(5).galaxy.signal?.pods;
    const pods = signalled(5).galaxy.signal?.pods ?? [];
    expect(pods).toHaveLength(1);
    const p = pods[0]!;
    expect(p.patient.name.length).toBeGreaterThan(0);
    expect(p.bleed).toBeGreaterThanOrEqual(150);
    expect(p.bleed).toBeLessThanOrEqual(210);
    expect(a?.[0]?.patient.name).toBe(p.patient.name);
  });

  it('is adrift with the patient aboard, downed and bleeding, from the deploy', () => {
    const sim = inScene(5);
    const p = pod(sim);
    const v = sim.world.get(p.vehicle!, VehicleC)!;
    expect(v.state).toBe('flying');
    expect(v.pilot).toBe(0);
    expect(v.passengers).toEqual([p.crew]);
    expect(sim.world.get(p.crew!, AboardC)?.vehicle).toBe(p.vehicle);
    const before = sim.world.get(p.crew!, DownedC)!.bleed;
    step(sim, 40);
    expect(sim.world.get(p.crew!, DownedC)!.bleed).toBeCloseTo(before - 2, 1);
  });

  it('called in, it docks and lets the patient out; they come aboard as a passenger and are carried to a bed', () => {
    const sim = inScene(5);
    const p = pod(sim);
    sim.enqueue({ type: 'galaxy.recoverPod', pod: p.id });
    step(sim);
    expect(p.called).toBe(true);
    let out = false;
    for (let i = 0; i < 20 * 60 && !out; i++) {
      step(sim);
      out = sim.world.has(p.crew!, PositionC);
    }
    expect(out).toBe(true);
    expect(shipIdOf(sim, sim.world.get(p.crew!, PositionC)!)).toBe(playerShip(sim));
    expect(lodgingHere(sim, p.crew!)?.by).toBe('passage');
    expect(sim.world.get(p.vehicle!, VehicleC)?.passengers).toEqual([]);
    // emptied, it holds at the airlock a moment (to be seen docked), then casts off
    expect(sim.world.get(p.vehicle!, VehicleC)?.state).toBe('docked');
    step(sim, POD_HOLD_SEC * TICK_HZ + 2);
    expect(sim.world.get(p.vehicle!, VehicleC)?.state).toBe('flying');
    let stable = false;
    for (let i = 0; i < 20 * 90 && !stable; i++) {
      step(sim);
      stable = !!sim.world.get(p.crew!, DownedC)?.stabilized || !sim.world.has(p.crew!, DownedC);
    }
    expect(stable).toBe(true);
    expect(sim.world.has(p.crew!, DeadC)).toBe(false);
    step(sim, 40);
    expect(fired(sim)).toContain('podRescued');
  });

  it('left adrift, the patient bleeds out and the observer logs it', () => {
    const sim = inScene(5);
    const p = pod(sim);
    step(sim, 20 * (p.bleed + 5));
    expect(sim.world.has(p.crew!, DeadC)).toBe(true);
    expect(fired(sim)).toContain('podDied');
  });

  it('leaving with the patient still adrift sets the pod_left flag', () => {
    const sim = inScene(5);
    sim.enqueue({ type: 'galaxy.leaveEvent' });
    step(sim, 3);
    expect(sim.galaxy.event).toBeNull();
    expect(sim.story.flags['pod_left']).toBe(1);
  });
});

/** Called in and out of the pod, aboard as a passenger (the observer has handed them on). */
function rescued(seed: number): { sim: Sim; crew: number; purse: number; owner: string } {
  const sim = inScene(seed, 1);
  const p = pod(sim);
  sim.enqueue({ type: 'galaxy.recoverPod', pod: p.id });
  for (let i = 0; i < 20 * 60 && !p.handed; i++) step(sim);
  expect(p.handed).toBe(true);
  return { sim, crew: p.crew!, purse: p.purse, owner: p.owner };
}
const carryOf = (sim: Sim, crew: number) => sim.world.get(playerShip(sim), ConsentC)?.grants.find((g) => g.crew?.includes(crew))?.carry;
/** Leave the pocket and fly on until the ship is in the next node. */
function flyOn(sim: Sim): void {
  sim.enqueue({ type: 'galaxy.leaveEvent' });
  step(sim, 3);
  expect(sim.galaxy.event).toBeNull();
  // Fly on, passing up any other signal on the way (no second pocket).
  for (let i = 0; i < 90000 && sim.sector.state !== 'deploying'; i++) {
    sim.step();
    const active = sim.story.active ? sim.content.events?.[sim.story.active.event] : undefined;
    const pass = active?.choices?.find((c) => !c.outcome?.effects?.some((e) => e.type === 'scene') && !c.remote && !c.cost && !c.requires && !c.check);
    if (pass) sim.enqueue({ type: 'story.choose', choice: pass.id });
    if (sim.galaxy.travel?.phase === 'arrived') sim.enqueue({ type: 'galaxy.drop' });
  }
  const p = sim.sector.packet!;
  for (let x = 0; x + p.w <= sim.sector.width && sim.sector.state !== 'active'; x += 4) {
    for (let y = 2; y + p.h <= sim.sector.height; y += 4) {
      if (placementGapError(sim, { x, y, w: p.w, h: p.h })) continue;
      sim.enqueue({ type: 'sector.deploy', x, y });
      step(sim);
      break;
    }
  }
  expect(sim.sector.state).toBe('active');
}

describe('the pod patient after the pocket', () => {
  it('carries the event on their passage grant: origin, a rolled purse, nothing fired yet', () => {
    const { sim, crew, purse, owner } = rescued(5);
    expect(purse).toBeGreaterThanOrEqual(60);
    expect(purse).toBeLessThanOrEqual(150);
    expect(carryOf(sim, crew)).toEqual({ event: EVENT, origin: owner, purse, fired: [] });
  });

  it('back on their feet in the next node: they pay what they carry and their faction gains standing, once, and not again on reload', () => {
    const { sim, crew, purse, owner } = rescued(5);
    flyOn(sim);
    expect(sim.world.has(crew, DownedC)).toBe(true);
    const credits = sim.trade.credits;
    const rep = sim.story.reputation[owner] ?? 0;
    sim.world.get(crew, HealthC)!.hp = 39.9;
    let log = '';
    const effects: string[] = [];
    for (let i = 0; i < 20 * 60 && sim.world.has(crew, DownedC); i++) {
      sim.step();
      for (const e of sim.events.drain()) {
        if (e.type === 'scene.observed' && e.rule === 'helpedPerson') log = e.text;
        if (e.type === 'story.effect' && e.effect === 'reputation') effects.push(e.text);
      }
    }
    expect(sim.world.has(crew, DownedC)).toBe(false);
    for (let i = 0; i < 40; i++) {
      sim.step();
      for (const e of sim.events.drain()) {
        if (e.type === 'scene.observed' && e.rule === 'helpedPerson') log = e.text;
        if (e.type === 'story.effect' && e.effect === 'reputation') effects.push(e.text);
      }
    }
    expect(log).toContain(sim.world.get(crew, CrewC)!.name);
    expect(sim.trade.credits).toBe(credits + purse);
    expect(sim.story.reputation[owner]).toBe(rep + 1);
    expect(effects).toEqual([`${sim.content.galaxy!.factions[owner]!.name} standing +1`]);
    expect(carryOf(sim, crew)?.fired).toEqual([`helpedPerson#n${crew}`]);
    step(sim, 100);
    expect(sim.trade.credits).toBe(credits + purse);
    const back = deserialize(serialize(sim), content);
    step(back, 100);
    expect(back.trade.credits).toBe(credits + purse);
    expect(back.story.reputation[owner]).toBe(rep + 1);
  });

  it('saved and loaded mid-stay, still downed: the carry survives and the reward lands after the load', () => {
    const { sim, crew, purse } = rescued(5);
    flyOn(sim);
    const back = deserialize(serialize(sim), content);
    expect(carryOf(back, crew)?.purse).toBe(purse);
    const credits = back.trade.credits;
    back.world.get(crew, HealthC)!.hp = 39.9;
    step(back, 20 * 30);
    expect(back.world.has(crew, DownedC)).toBe(false);
    expect(back.trade.credits).toBe(credits + purse);
  });

  it('dies aboard after the pocket: the death rule fires once and their passage grant goes', () => {
    const { sim, crew } = rescued(5);
    flyOn(sim);
    const texts: string[] = [];
    sim.world.get(crew, DownedC)!.stabilized = false;
    sim.world.get(crew, DownedC)!.bleed = 1;
    for (let i = 0; i < 20 * 5; i++) {
      sim.step();
      for (const e of sim.events.drain()) if (e.type === 'scene.observed') texts.push(e.rule);
    }
    expect(sim.world.has(crew, DeadC)).toBe(true);
    expect(texts.filter((r) => r === 'personDied')).toHaveLength(1);
    expect(texts).not.toContain('podDied');
    expect(texts).not.toContain('helpedPerson');
    expect(carryOf(sim, crew)).toBeUndefined();
  });
});

describe('vitals aboard a vehicle', () => {
  /** A player crew member put aboard the starter shuttle, downed (patched or not). */
  function aboard(patched: boolean): { sim: Sim; crew: number } {
    const sim = newGame(3, content);
    const shuttle = sim.world.query(VehicleC)[0]!;
    const crew = sim.world.query(CrewC).find((c) => sim.world.has(c, PositionC))!;
    boardCrew(sim, crew, shuttle);
    sim.world.get(crew, HealthC)!.hp = 0;
    sim.world.add(crew, DownedC, { bleed: 3, stabilized: false, bed: 0, ...(patched ? { patched: true as const } : {}) });
    return { sim, crew };
  }
  it('a downed crew member in a shuttle bleeds out; first aid stops it', () => {
    const open = aboard(false);
    step(open.sim, 20 * 4);
    expect(open.sim.world.has(open.crew, DeadC)).toBe(true);
    const patched = aboard(true);
    step(patched.sim, 20 * 4);
    expect(patched.sim.world.has(patched.crew, DeadC)).toBe(false);
  });
  it('a hurt crew member aboard heals; a starving one is harmed', () => {
    const sim = newGame(3, content);
    const shuttle = sim.world.query(VehicleC)[0]!;
    const [a, b] = sim.world.query(CrewC).filter((c) => sim.world.has(c, PositionC));
    boardCrew(sim, a!, shuttle);
    boardCrew(sim, b!, shuttle);
    sim.world.get(a!, HealthC)!.hp = 50;
    const hb = sim.world.get(b!, HealthC)!;
    const needs = sim.world.get(b!, NeedsC)!;
    step(sim, 20);
    const start = hb.hp;
    for (let i = 0; i < 20 * 5; i++) {
      needs.hunger = 0;
      sim.step();
    }
    expect(sim.world.get(a!, HealthC)!.hp).toBeGreaterThan(50);
    expect(hb.hp).toBeLessThan(start);
  });
});
