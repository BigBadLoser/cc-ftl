import { describe, expect, it } from 'vitest';
import { CombatC, FTL_CHARGE_SEC, START_NODE, ShipC, deserialize, galaxyIndex, newGame, playerShip, serialize, type Sim } from '../sim';
import { CrewC, PositionC } from '../sim/crew/components';
import { AllegianceC } from '../sim/fight/components';
import { leaveBlocker } from '../sim/galaxy/eventGrid';
import { giveItems } from '../sim/story/effects';
import { TraderC } from '../sim/trade/types';
import type { SceneRuleDef } from '../sim/scene/types';
import { shipCrew } from '../sim/capture/control';
import { Rng } from '../sim/rng';
import { STORY_HOP_CHANCE } from '../sim/galaxy/tuning';
import { ModuleC } from '../sim/modules/components';
import { WeaponC } from '../sim/combat/components';
import { shipIdOf } from '../sim/regions';
import { materialiseFleet, liftFleet } from '../sim/galaxy/fleetShips';
import { isHostileFaction } from '../sim/galaxy/standing';
import { hostileAct } from '../sim/combat/provoke';
import type { Fleet } from '../sim/galaxy/types';
import { AboardC, VehicleC, type Vehicle } from '../sim/vehicles/components';
import { content } from '.';

/** Physical encounters (#173): a signal's remote actions, investigating into a scene in a pocket, the observer, leaving, save and load. */

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

/** A two-hop trip whose first hop signals the trader skiff (queued, so it opens at the hop); stops with the decision open. */
function signalled(seed: number, c = content): Sim {
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
const choose = (sim: Sim, choice: string) => {
  sim.enqueue({ type: 'story.choose', choice });
  return step(sim, 2);
};
/** Into the skiff's scene, deployed. Returns the skiff's ship id. */
function inScene(seed: number, c = content): { sim: Sim; skiff: number } {
  const sim = signalled(seed, c);
  choose(sim, 'approach');
  deploy(sim);
  return { sim, skiff: sim.galaxy.event?.scene.ships[0]?.contact.ship as number };
}

/** Battle stations, an aim at the ship and one volley from charged weapons (the shot that leaves is the hostile act). */
function fireOn(sim: Sim, target: number): void {
  const me = playerShip(sim);
  sim.enqueue({ type: 'combat.battleStations', on: true });
  sim.enqueue({ type: 'combat.setTarget', ship: me, weaponId: null, targetShip: target, targetModuleId: 0 });
  step(sim, 5 * 20); // the turrets run out
  for (const id of sim.world.query(WeaponC)) {
    const w = sim.world.get(id, WeaponC);
    if (w && shipIdOf(sim, sim.world.get(id, ModuleC) as { x: number; y: number }) === me) w.charge = 1;
  }
  sim.enqueue({ type: 'combat.fireVolley', ship: me });
  step(sim);
}

describe('scene signal', () => {
  it('builds the scene when the decision opens; remote actions keep it open and are taken once', () => {
    const sim = signalled(3);
    const spec = sim.galaxy.signal;
    expect(sim.story.active?.event).toBe('event.trader_swap');
    expect(spec?.ships).toHaveLength(1);
    const ship = spec?.ships[0];
    expect(ship?.stance).toBe('neutral');
    expect(ship?.crew).toBeGreaterThanOrEqual(1);
    expect(ship?.crew).toBeLessThanOrEqual(3);
    expect(ship?.cargo?.length).toBeGreaterThanOrEqual(2);
    expect(ship?.contact.name).toBeTruthy();
    const out = choose(sim, 'hail');
    expect(out).toContainEqual({ type: 'story.remote', event: 'event.trader_swap', choice: 'hail', action: 'hail' });
    expect(sim.story.active?.done).toEqual(['hail']);
    expect(choose(sim, 'hail')).toContainEqual({ type: 'command.rejected', command: 'story.choose', reason: 'done' });
    expect(sim.galaxy.travel?.phase).toBe('story');
    expect(sim.world.query(ShipC).length).toBe(0); // nothing spawned: the ship waits in hyperspace
  });

  it('is the same scene for the same signal (seed, event, hop)', () => {
    expect(signalled(5).galaxy.signal).toEqual(signalled(5).galaxy.signal);
  });

  it('ignoring it continues the trip and spawns nothing', () => {
    const sim = signalled(3);
    choose(sim, 'ignore');
    expect(sim.galaxy.signal).toBeNull();
    expect(sim.galaxy.event).toBeNull();
    expect(sim.galaxy.travel?.phase).toBe('hop');
  });

  it('a scene decision opened off the lane (no trip, no signal) locks its scene choices but can be answered', () => {
    const sim = newGame(3, content);
    sim.story.goals.skipped = true;
    sim.enqueue({ type: 'story.fire', event: 'event.trader_swap' });
    step(sim, 2);
    expect(sim.story.active?.event).toBe('event.trader_swap');
    expect(sim.galaxy.signal).toBeNull();
    for (const c of ['hail', 'scan', 'approach']) expect(choose(sim, c)).toContainEqual({ type: 'command.rejected', command: 'story.choose', reason: 'unmet' });
    expect(sim.story.active?.done ?? []).toEqual([]);
    choose(sim, 'ignore');
    expect(sim.story.active).toBeNull();
    expect(sim.galaxy.event).toBeNull();
  });
});

describe('scene in a pocket', () => {
  it('investigating drops out into the scene: the skiff is real, neutral, with the rolled crew, stock and wallet', () => {
    const { sim, skiff } = inScene(3);
    const ev = sim.galaxy.event;
    const spec = ev?.scene.ships[0];
    expect(ev?.kind).toBe('scene');
    expect(sim.galaxy.travel?.phase).toBe('event');
    expect(sim.sector.state).toBe('active');
    const ship = sim.world.get(skiff, ShipC);
    expect(ship?.faction).toBe('neutral');
    expect(ship?.name).toBe(spec?.contact.name);
    expect(shipCrew(sim, skiff)).toHaveLength(spec?.crew as number);
    const t = sim.world.get(skiff, TraderC);
    expect(t?.stock).toEqual(spec?.cargo);
    expect(t?.credits).toBe(spec?.credits);
  });

  it('saves and loads mid-scene', () => {
    const { sim } = inScene(4);
    step(sim, 40);
    const copy = deserialize(serialize(sim), content);
    expect(copy.galaxy.event).toEqual(sim.galaxy.event);
    step(sim, 60);
    step(copy, 60);
    expect(copy.galaxy.event).toEqual(sim.galaxy.event);
    expect(serialize(copy)).toEqual(serialize(sim));
  });

  it('leaving resumes the trip at the same hop and wipes the pocket', () => {
    const { sim } = inScene(3);
    const at = sim.galaxy.travel?.at;
    sim.enqueue({ type: 'galaxy.leaveEvent' });
    const out = step(sim);
    expect(out.some((e) => e.type === 'galaxy.eventLeft')).toBe(true);
    expect(sim.galaxy.event).toBeNull();
    expect(sim.sector.state).toBe('hyperspace');
    expect(sim.galaxy.travel?.phase).toBe('hop');
    expect(sim.galaxy.travel?.at).toBe(at);
    for (let i = 0; i < 90000 && sim.galaxy.travel?.at === at; i++) step(sim);
    expect(sim.galaxy.travel?.at).toBe((at ?? 0) + 1); // the hop goes on
  });

  it('a scene drawn at the end of the last hop leaves the trip arrived, not flying past its end', () => {
    // Only the skiff is drawable, and the story Rng is set so the hop's roll draws.
    const only = { ...content, events: { 'event.trader_swap': content.events['event.trader_swap'] } };
    const sim = newGame(3, only as typeof content);
    sim.story.goals.skipped = true;
    sim.galaxy.fleets = [];
    giveItems(sim, 'item.fuel', 80);
    const combat = sim.world.get(playerShip(sim), CombatC);
    if (combat) combat.ftl = FTL_CHARGE_SEC;
    let state = 1;
    while (new Rng(state).next() >= STORY_HOP_CHANCE) state++;
    sim.story.rng = state;
    sim.enqueue({ type: 'galaxy.jump', ship: playerShip(sim), route: routeOf(sim, 1) });
    for (let i = 0; i < 90000 && sim.galaxy.travel?.phase !== 'story'; i++) sim.step();
    expect(sim.galaxy.travel?.held).toBe('hopEnd');
    choose(sim, 'approach');
    deploy(sim);
    expect(sim.galaxy.event?.kind).toBe('scene');
    sim.enqueue({ type: 'galaxy.leaveEvent' });
    step(sim, 3);
    expect(sim.galaxy.travel?.phase).toBe('arrived');
    expect(sim.galaxy.travel?.at).toBe(1);
  });
});

describe('scene observer', () => {
  it('reads facts from state: a shot fired on a neutral fires the shared rule once', () => {
    const { sim, skiff } = inScene(3);
    fireOn(sim, skiff);
    const out = step(sim, 41).filter((e) => e.type === 'scene.observed');
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ rule: 'attacked', ship: skiff, tone: 'bad' });
    expect(sim.story.flags['attacked_neutral']).toBe(1);
  });

  it('boarding a neutral turns it hostile, costs standing with its owner, and leaving waits for the crew', () => {
    const { sim, skiff } = inScene(3);
    const before = sim.story.reputation['traders'] ?? 0;
    const s = sim.world.get(skiff, ShipC) as { x: number; y: number; width: number; height: number };
    const crew = sim.world.query(CrewC, PositionC).find((id) => sim.world.get(id, AllegianceC)?.faction === 'player') as number;
    const pos = sim.world.get(crew, PositionC) as { x: number; y: number };
    // Stand them on the skiff's grid (any of its floor tiles: its centre row is walkable on every civilian hull).
    for (let x = s.x; x < s.x + s.width; x++) {
      pos.x = x;
      pos.y = Math.floor(s.y + s.height / 2);
      if (leaveBlocker(sim) === 'crewAway') break;
    }
    expect(leaveBlocker(sim)).toBe('crewAway');
    step(sim, 21);
    expect(sim.story.reputation['traders']).toBe(before - 1);
    expect(sim.story.flags['boarded_neutral']).toBe(1);
    expect(sim.world.get(skiff, ShipC)).toMatchObject({ faction: 'hostile', provoked: 'boarded' });
    // Taken as a prize it is the player's, but leaving lifts only the player's own ship: the crew on the prize are still away.
    (sim.world.get(skiff, ShipC) as { faction: string }).faction = 'player';
    expect(leaveBlocker(sim)).toBe('crewAway');
  });

  it('crew sitting in a shuttle stowed in a prize\'s bay are away; the empty shuttle stays with the prize', () => {
    const { sim, skiff } = inScene(3);
    expect(leaveBlocker(sim)).toBeNull();
    (sim.world.get(skiff, ShipC) as { faction: string }).faction = 'player'; // taken as a prize
    const shuttle = sim.world.createEntity();
    const v = { homeShip: skiff, state: 'stowed', pilot: 0, passengers: [] as number[] } as unknown as Vehicle;
    sim.world.add(shuttle, VehicleC, v);
    expect(leaveBlocker(sim)).toBeNull();
    const crew = sim.world.query(CrewC, PositionC).find((id) => sim.world.get(id, AllegianceC)?.faction === 'player') as number;
    sim.world.remove(crew, PositionC);
    sim.world.add(crew, AboardC, { vehicle: shuttle });
    v.pilot = crew;
    expect(leaveBlocker(sim)).toBe('crewAway');
  });

  it('an encounter may switch a shared rule off', () => {
    const off = { ...content, events: { ...content.events, 'event.trader_swap': { ...content.events['event.trader_swap'], scene: { ...content.events['event.trader_swap'].scene, rules: { attacked: null } } } } };
    const { sim, skiff } = inScene(3, off as typeof content);
    fireOn(sim, skiff);
    expect(step(sim, 41).filter((e) => e.type === 'scene.observed' && e.rule === 'attacked')).toHaveLength(0);
  });

  it('timers come due by the clock and fire their rules', () => {
    const rule: SceneRuleDef = { on: 'timer', timer: 'late', effects: [{ type: 'flag', flag: 'late' }], log: 'Too late' };
    const base = content.events['event.trader_swap'];
    const timed = { ...content, events: { ...content.events, 'event.trader_swap': { ...base, scene: { ...base.scene, timers: [{ id: 'late', afterSec: 3 }], rules: { late: rule } } } } };
    const { sim } = inScene(3, timed as typeof content);
    expect(sim.story.flags['late']).toBeUndefined();
    step(sim, 3 * 20 + 21);
    expect(sim.story.flags['late']).toBe(1);
  });
});

describe('scene departures', () => {
  it('an unhailed neutral jumps out when its business is done, and the observer logs it', () => {
    const { sim, skiff } = inScene(3);
    const s = sim.galaxy.event?.scene.ships[0];
    expect(s?.stay).toBeGreaterThanOrEqual(100);
    const out = step(sim, Math.round(((s?.stay ?? 0) + 60) * 20));
    expect(out.some((e) => e.type === 'ship.fled' && e.ship === skiff)).toBe(true);
    expect(out.filter((e) => e.type === 'scene.observed' && e.rule === 'fled')).toHaveLength(1);
    expect(s?.gone).toBe('fled');
    expect(sim.world.get(skiff, ShipC)).toBeUndefined();
    sim.enqueue({ type: 'galaxy.leaveEvent' });
    step(sim);
    expect(sim.galaxy.event).toBeNull();
  });

  it('a skiff hailed from the signal holds station', () => {
    const sim = signalled(3);
    choose(sim, 'hail');
    choose(sim, 'approach');
    deploy(sim);
    const s = sim.galaxy.event?.scene.ships[0];
    expect(s?.hailed).toBe(true);
    const out = step(sim, Math.round(((s?.stay ?? 0) + 60) * 20));
    expect(out.some((e) => e.type === 'ship.fled')).toBe(false);
    expect(sim.world.get(s?.contact.ship as number, ShipC)?.state).toBe('active');
  });

  it('answering a hail in the pocket makes it hold station too', () => {
    const { sim, skiff } = inScene(3);
    sim.enqueue({ type: 'trade.hail', ship: skiff });
    step(sim, 21);
    expect(sim.galaxy.event?.scene.ships[0]?.hailed).toBe(true);
  });
});

describe('provoking a neutral', () => {
  it('battle stations and an aim leave it neutral; holds stop anything firing', () => {
    const { sim, skiff } = inScene(3);
    const me = playerShip(sim);
    sim.enqueue({ type: 'combat.battleStations', on: true });
    sim.enqueue({ type: 'combat.setTarget', ship: me, weaponId: null, targetShip: skiff, targetModuleId: 0 });
    for (const id of sim.world.query(WeaponC)) {
      const w = sim.world.get(id, WeaponC);
      if (w) w.charge = 1;
    }
    const out = step(sim, 200);
    expect(sim.sector.stations).toBe(true);
    expect(out.some((e) => e.type === 'weapon.fired')).toBe(false);
    expect(sim.world.get(skiff, ShipC)?.faction).toBe('neutral');
    expect(sim.sector.inCombat).toBe(false);
  });

  it('aiming a held weapon at a neutral does not fire it', () => {
    const { sim, skiff } = inScene(3);
    const me = playerShip(sim);
    sim.enqueue({ type: 'combat.battleStations', on: true });
    step(sim);
    const gun = sim.world.query(WeaponC, ModuleC).find((id) => shipIdOf(sim, sim.world.get(id, ModuleC) as { x: number; y: number }) === me) as number;
    (sim.world.get(gun, WeaponC) as { charge: number }).charge = 1;
    sim.enqueue({ type: 'combat.setTarget', ship: me, weaponId: gun, targetShip: skiff, targetModuleId: 0 });
    expect(step(sim, 100).some((e) => e.type === 'weapon.fired')).toBe(false);
    expect(sim.world.get(skiff, ShipC)?.faction).toBe('neutral');
  });

  it('re-aiming a held weapon from an enemy to a neutral drops the pending shot', () => {
    const { sim, skiff } = inScene(3);
    const me = playerShip(sim);
    sim.enqueue({ type: 'combat.battleStations', on: true });
    step(sim);
    const gun = sim.world.query(WeaponC, ModuleC).find((id) => shipIdOf(sim, sim.world.get(id, ModuleC) as { x: number; y: number }) === me) as number;
    const w = sim.world.get(gun, WeaponC) as { once?: boolean; charge: number };
    w.once = true; // an earlier aim at an enemy, still charging
    sim.enqueue({ type: 'combat.setTarget', ship: me, weaponId: gun, targetShip: skiff, targetModuleId: 0 });
    step(sim);
    expect(w.once).toBe(false);
    w.charge = 1;
    expect(step(sim, 100).some((e) => e.type === 'weapon.fired')).toBe(false);
    expect(sim.world.get(skiff, ShipC)?.faction).toBe('neutral');
  });

  it('the first shot turns it hostile, a fight is on, and it fires back', () => {
    // A full crew (a lone one cannot man the guns and the helm at once): the ordinary hostile AI and crew do the rest.
    const base = content.events['event.trader_swap'];
    const crewed = { ...content, events: { ...content.events, 'event.trader_swap': { ...base, scene: { ...base.scene, ships: [{ ...base.scene.ships[0], crew: [3, 3] }] } } } };
    const { sim, skiff } = inScene(3, crewed as typeof content);
    fireOn(sim, skiff);
    expect(sim.world.get(skiff, ShipC)).toMatchObject({ faction: 'hostile', provoked: 'fired' });
    const out = step(sim, 60 * 20);
    expect(sim.sector.inCombat).toBe(true);
    expect(out.some((e) => e.type === 'weapon.fired' && e.ship === skiff)).toBe(true);
  });

  it('standing down drops aims at neutrals and lifts the holds', () => {
    const { sim, skiff } = inScene(3);
    const me = playerShip(sim);
    sim.enqueue({ type: 'combat.battleStations', on: true });
    sim.enqueue({ type: 'combat.setTarget', ship: me, weaponId: null, targetShip: skiff, targetModuleId: 0 });
    step(sim);
    sim.enqueue({ type: 'combat.battleStations', on: false });
    step(sim);
    expect(sim.sector.stations).toBeUndefined();
    expect(sim.world.get(me, CombatC)?.target).toBeNull();
    expect(sim.world.query(WeaponC).every((id) => sim.world.get(id, WeaponC)?.mode !== 'hold' || sim.world.get(id, WeaponC)?.restore === undefined)).toBe(true);
  });

  it('provoking records the group once: its crew on a shuttle turn, and a ship lifted out and back, after a reload, or waiting for room comes in hostile', () => {
    const sim = newGame(24, content);
    const g = sim.galaxy;
    const f = g.fleets.find((x) => x.ships.length > 1 && !isHostileFaction(sim, x.faction)) as Fleet;
    Object.assign(f, { node: g.current, from: g.current, route: [], dwell: 99, synced: g.turn });
    // One ship made real, the other still waiting for room in the sector.
    const waiting = f.ships.splice(1);
    materialiseFleet(sim, f);
    f.ships.push(...waiting);
    const first = f.ships[0]?.ship as number;
    expect(waiting.every((c) => c.ship === undefined)).toBe(true);
    expect(sim.world.get(first, ShipC)?.faction).toBe('neutral');
    // One of its crew embarked on its shuttle (no position on a grid).
    const crew = shipCrew(sim, first)[0] as number;
    const shuttle = sim.world.createEntity();
    sim.world.add(shuttle, VehicleC, { homeShip: first } as Vehicle);
    sim.world.remove(crew, PositionC);
    sim.world.add(crew, AboardC, { vehicle: shuttle });
    hostileAct(sim, first, 'fired');
    const side = sim.world.get(first, ShipC)?.faction;
    expect(side).not.toBe('neutral');
    expect(sim.world.get(crew, AllegianceC)?.faction).toBe(side);
    expect(g.provoked).toEqual([`fleet:${f.id}`]);
    liftFleet(sim, f);
    const back = deserialize(serialize(sim), content);
    const again = back.galaxy.fleets.find((x) => x.id === f.id) as Fleet;
    materialiseFleet(back, again);
    for (const c of again.ships) if (c.ship !== undefined) expect(back.world.get(c.ship, ShipC)?.faction).toBe(side);
    expect(again.ships.every((c) => c.ship !== undefined)).toBe(true);
  });
});
