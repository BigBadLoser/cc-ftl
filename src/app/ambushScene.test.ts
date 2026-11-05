import { describe, expect, it } from 'vitest';
import { CombatC, FTL_CHARGE_SEC, START_NODE, ShipC, galaxyIndex, newGame, playerShip, serialize, deserialize, type Sim } from '../sim';
import { AllegianceC } from '../sim/fight/components';
import { DownedC, PositionC } from '../sim/crew/components';
import { shipIdOf } from '../sim/regions';
import { hostileAct } from '../sim/combat/provoke';
import { killCrew } from '../sim/crew/death';
import { applyEffect, giveItems } from '../sim/story/effects';
import { RolledSkillsC } from '../sim/crew/traits';
import { playerCrew, playerStock, withPlayerAboard } from '../sim/story/world';
import { ItemStackC } from '../sim/items/components';
import { BoarderC, VehicleC } from '../sim/vehicles/components';
import { leaveBlocker } from '../sim';
import { buildStory } from './storySnapshot';
import { eventOf } from './encounterSnapshot';
import { content } from '../content';

/** The pirate ambush (#173 step 4): the signal and its scan, the skiff in its pocket, the dock request, and what the observer makes of it. */

const step = (sim: Sim, n = 1) => {
  const out: { type: string; [k: string]: unknown }[] = [];
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

/** A two-hop trip whose first hop signals the returning pirate; stops with the decision open. */
function signalled(seed: number, trap?: boolean): Sim {
  const sim = newGame(seed, content);
  sim.story.goals.skipped = true;
  sim.story.flags['spared_pirate'] = 1;
  sim.galaxy.fleets = [];
  giveItems(sim, 'item.fuel', 80);
  const combat = sim.world.get(playerShip(sim), CombatC);
  if (combat) combat.ftl = FTL_CHARGE_SEC;
  sim.story.queue.push({ event: 'event.pirate_returns', due: 0, force: true });
  sim.enqueue({ type: 'galaxy.jump', ship: playerShip(sim), route: routeOf(sim, 2) });
  for (let i = 0; i < 90000 && sim.galaxy.travel?.phase !== 'story'; i++) sim.step();
  sim.events.drain();
  if (trap !== undefined) sim.enqueue({ type: 'debug.ambush', trap });
  step(sim);
  return sim;
}
/** Into the skiff's pocket, deployed. Returns the skiff's ship id. */
function inScene(seed: number, trap: boolean): { sim: Sim; skiff: number } {
  const sim = signalled(seed, trap);
  choose(sim, 'approach');
  deploy(sim);
  step(sim, 20);
  return { sim, skiff: sim.galaxy.event?.scene.ships[0]?.contact.ship as number };
}
/** Missiles lying loose on the floor of any ship. */
const floorMissiles = (sim: Sim): number => sim.world.query(ItemStackC).reduce((n, id) => n + (sim.world.get(id, ItemStackC)?.item === 'item.missile' ? sim.world.get(id, ItemStackC)?.count ?? 0 : 0), 0);
/** Step until the let-in party has been sent (its members are named on the ship's Boarder). */
const untilSent = (sim: Sim, skiff: number): void => {
  for (let i = 0; i < 20 * 20 && !(sim.world.get(skiff, BoarderC)?.crew.length ?? 0); i++) step(sim);
};
const ambushOf = (sim: Sim) => sim.galaxy.event?.scene.ships[0]?.ambush;
const observed = (out: { type: string }[]) => out.filter((e): e is { type: 'scene.observed'; rule: string; text: string } & typeof e => e.type === 'scene.observed');
/** Step until the request is open (a few seconds' worth after the player is deployed). */
function untilAsked(sim: Sim): void {
  for (let i = 0; i < 60 && ambushOf(sim)?.visit !== 'asked'; i++) step(sim, 20);
}

describe('the returning pirate: signal', () => {
  it('the flag queues it and the signal builds one skiff: trap or honest by seed, nothing spawned in hyperspace', () => {
    const traps = new Set<boolean>();
    for (let s = 1; s < 16 && traps.size < 2; s++) {
      const sim = signalled(s);
      const spec = sim.galaxy.signal;
      expect(sim.story.active?.event).toBe('event.pirate_returns');
      expect(spec?.ships).toHaveLength(1);
      const a = spec?.ships[0]?.ambush;
      expect(a?.talk).toBeTruthy();
      traps.add(!!a?.trap);
      if (a?.trap) {
        expect(a.party).toBe(3);
        expect(spec?.ships[0]?.crew).toBeGreaterThanOrEqual(4);
      } else {
        expect(a?.party).toBeGreaterThanOrEqual(1);
        expect(a?.party).toBeLessThanOrEqual(2);
      }
      expect(sim.world.query(ShipC)).toHaveLength(0); // the player's ship is a packet in hyperspace and nothing spawned
      expect(signalled(s).galaxy.signal).toEqual(sim.galaxy.signal); // the same signal, the same skiff
    }
    expect(traps.size).toBe(2);
  });

  it('a scan reads weapons, boarding craft and crew, and a trap shows more as the crew skill rises', () => {
    const rowsOf = (sim: Sim) => Object.fromEntries((buildStory(sim).active?.intel.find((i) => i.kind === 'scan')?.rows ?? []).map((r) => [r.label, r.value]));
    const dull = signalled(3, true);
    withPlayerAboard(dull, () => playerCrew(dull).forEach((c) => dull.world.add(c, RolledSkillsC, { skills: {} })));
    choose(dull, 'scan');
    const d = rowsOf(dull);
    expect(Object.keys(d)).toEqual(expect.arrayContaining(['Weapons', 'Boarding craft', 'Crew aboard']));
    expect(d['Weapons']).toBe('Armed, as any pirate');
    expect(d['Crew aboard']).toBe('Unclear');
    for (const trap of [true, false]) {
      const sim = signalled(3, trap);
      for (const skill of ['gunnery', 'piloting', 'hacking'] as const) applyEffect(sim, { type: 'skillXp', skill, amount: 600, who: 'all' }, { event: 't', actor: null });
      choose(sim, 'scan');
      const r = rowsOf(sim);
      expect(r['Weapons']).toBe(trap ? 'Guns powered and charged' : 'Guns cold');
      expect(r['Boarding craft']).toBe(trap ? 'Shuttle fuelled, suited crew in the bay' : 'Shuttle bay, cold');
      expect(r['Crew aboard']).toMatch(/^\d+$/);
    }
  });

  it('a hail gives the skiff\'s own talk, and ignoring continues the trip with nothing spawned', () => {
    const sim = signalled(3, true);
    choose(sim, 'hail');
    const hail = buildStory(sim).active?.intel.find((i) => i.kind === 'hail');
    expect(hail?.quote).toBe(sim.galaxy.signal?.ships[0]?.ambush?.talk);
    choose(sim, 'ignore');
    expect(sim.galaxy.event).toBeNull();
    expect(sim.galaxy.signal).toBeNull();
  });
});

describe('the returning pirate: in its pocket', () => {
  it('a trap carries a boarding party of 3 and a shuttle, and is not hostile', () => {
    const { sim, skiff } = inScene(3, true);
    const ship = sim.world.get(skiff, ShipC);
    expect(ship?.faction).toBe('neutral');
    expect(sim.world.get(skiff, BoarderC)?.party).toBe(3);
    expect([...sim.world.query(VehicleC)].some((v) => sim.world.get(v, VehicleC)?.homeShip === skiff)).toBe(true);
    expect(eventOf(sim)?.roster[0]?.status).toBeTruthy();
  });

  it('a trap asks to dock after a while and waits for the answer, holding station', () => {
    const { sim, skiff } = inScene(3, true);
    untilAsked(sim);
    expect(ambushOf(sim)?.visit).toBe('asked');
    expect(eventOf(sim)?.dockRequest?.ship).toBe(skiff);
    step(sim, 20 * 90);
    expect(sim.world.get(skiff, ShipC)?.state).toBe('active'); // it does not jump away with a request open
    expect(sim.world.get(skiff, ShipC)?.faction).toBe('neutral');
  });

  it('let in, the party lands as guests, then turns hostile through hostileAct, party and ship together', () => {
    const { sim, skiff } = inScene(3, true);
    untilAsked(sim);
    sim.enqueue({ type: 'galaxy.visit', ship: skiff, grant: true });
    let aboard = false;
    const me = playerShip(sim);
    for (let i = 0; i < 90 * 20 && ambushOf(sim)?.visit !== 'aboard' && ambushOf(sim)?.visit !== 'sprung'; i++) step(sim);
    expect(['aboard', 'sprung']).toContain(ambushOf(sim)?.visit);
    const party = sim.world.get(skiff, BoarderC)?.crew ?? [];
    expect(party).toHaveLength(3);
    aboard = party.every((c) => shipIdOf(sim, sim.world.get(c, PositionC) as { x: number; y: number }) === me);
    expect(aboard).toBe(true);
    if (ambushOf(sim)?.visit === 'aboard') {
      expect(party.every((c) => sim.world.get(c, AllegianceC)?.faction === 'neutral')).toBe(true); // still passing for guests
      expect(sim.world.get(skiff, ShipC)?.faction).toBe('neutral');
    }
    const out = step(sim, 20 * 15);
    expect(out.some((e) => e.type === 'ship.provoked' && e['reason'] === 'ambush')).toBe(true);
    expect(sim.world.get(skiff, ShipC)?.faction).toBe('hostile');
    expect(party.every((c) => sim.world.get(c, AllegianceC)?.faction === 'hostile')).toBe(true);
    expect(sim.galaxy.provoked.length).toBeGreaterThan(0); // the same group record every provocation writes
    expect(sim.story.flags['pirate_ambushed']).toBe(1);
    expect(sim.story.flags['spared_pirate'] ?? 0).toBe(0);
  });

  it('refusing the request turns the trap on you without a party', () => {
    const { sim, skiff } = inScene(3, true);
    untilAsked(sim);
    sim.enqueue({ type: 'galaxy.visit', ship: skiff, grant: false });
    step(sim, 3);
    expect(ambushOf(sim)?.visit).toBe('refused');
    expect(sim.world.get(skiff, ShipC)?.faction).toBe('hostile');
    expect(sim.world.get(skiff, ShipC)?.provoked).toBe('ambush');
  });

  it('firing first turns the whole group by the ordinary rule, and the request is moot', () => {
    const { sim, skiff } = inScene(3, true);
    untilAsked(sim);
    hostileAct(sim, skiff, 'fired'); // what firing.ts does on a shot that leaves a player weapon
    step(sim, 40);
    expect(sim.world.get(skiff, ShipC)?.faction).toBe('hostile');
    expect(ambushOf(sim)?.visit).toBe('sprung');
    expect(observed(step(sim, 1)).length).toBeGreaterThanOrEqual(0);
    expect(sim.story.flags['pirate_ambushed'] ?? 0).toBe(0); // not an ambush: you fired first
  });

  it('an honest skiff asks to dock too, pays its debt in person (missiles, standing, flag cleared) and goes home', () => {
    const { sim, skiff } = inScene(3, false);
    untilAsked(sim);
    sim.enqueue({ type: 'trade.hail', ship: skiff }); // an answered hail must not keep it from leaving afterwards
    step(sim, 3);
    expect(sim.trade.hails.find((h) => h.ship === skiff)?.answered).toBe(true);
    expect(eventOf(sim)?.dockRequest?.ship).toBe(skiff);
    const before = withPlayerAboard(sim, () => playerStock(sim, 'item.missile'));
    const rep = sim.story.reputation['pirates'] ?? 0;
    sim.enqueue({ type: 'galaxy.visit', ship: skiff, grant: true });
    const rules: string[] = [];
    const floor0 = floorMissiles(sim);
    let dropped = 0;
    for (let i = 0; i < 20 * 150 && !ambushOf(sim)?.home; i++) {
      rules.push(...observed(step(sim)).map((e) => e.rule));
      if (rules.includes('honestPaid')) dropped = Math.max(dropped, floorMissiles(sim) - floor0);
    }
    expect(rules).toContain('honestPaid');
    expect(ambushOf(sim)?.visit).toBe('delivered');
    expect(sim.world.get(skiff, ShipC)?.faction).toBe('neutral'); // never springs
    expect(sim.story.reputation['pirates'] ?? 0).toBeGreaterThan(rep);
    expect(sim.story.flags['spared_pirate'] ?? 0).toBe(0);
    // The missiles were put on the floor inside the airlock, and the haulers carried them to storage by now.
    expect(dropped).toBe(4);
    for (let i = 0; i < 20 * 120 && floorMissiles(sim) > floor0; i++) step(sim);
    expect(floorMissiles(sim)).toBe(floor0);
    expect(withPlayerAboard(sim, () => playerStock(sim, 'item.missile'))).toBe(before + 4);
    expect(ambushOf(sim)?.home).toBe(true);
    // The party is back in its shuttle, and the skiff may jump away.
    const out = step(sim, 20 * 90);
    expect(sim.galaxy.event?.scene.ships[0]?.gone === 'fled' || sim.world.get(skiff, ShipC)?.state === 'fled' || out.some((e) => e.type === 'ship.fled')).toBe(true);
  });

  it('refusing an honest skiff: it pulls away with no hostility, no missiles, the debt unpaid', () => {
    const { sim, skiff } = inScene(3, false);
    untilAsked(sim);
    sim.enqueue({ type: 'trade.hail', ship: skiff });
    step(sim, 3);
    expect(sim.trade.hails.find((h) => h.ship === skiff)?.answered).toBe(true);
    const before = withPlayerAboard(sim, () => playerStock(sim, 'item.missile'));
    sim.enqueue({ type: 'galaxy.visit', ship: skiff, grant: false });
    const out = step(sim, 20 * 90);
    expect(observed(out).map((e) => e.rule)).toContain('honestRefused');
    expect(sim.world.get(skiff, ShipC)?.faction === 'hostile').toBe(false);
    expect(withPlayerAboard(sim, () => playerStock(sim, 'item.missile'))).toBe(before);
    expect(sim.story.flags['spared_pirate'] ?? 0).toBe(0);
    expect(out.some((e) => e.type === 'ship.fled')).toBe(true);
  });

  it('leaving is refused while a visit is under way, for both variants, and allowed once it is settled', () => {
    for (const trap of [true, false]) {
      const { sim, skiff } = inScene(3, trap);
      untilAsked(sim);
      expect(leaveBlocker(sim)).toBeNull(); // an open request blocks nothing
      sim.enqueue({ type: 'galaxy.visit', ship: skiff, grant: true });
      step(sim, 2);
      expect(leaveBlocker(sim)).toBeNull(); // nobody is out yet: a phase alone never blocks
      untilSent(sim, skiff);
      expect(leaveBlocker(sim)).toBe('visitors');
      for (let i = 0; i < 20 * 150 && ambushOf(sim)?.visit !== 'aboard'; i++) step(sim);
      expect(leaveBlocker(sim)).toBe('visitors');
      expect(eventOf(sim)?.canLeave).toBe(false);
      sim.enqueue({ type: 'galaxy.leaveEvent' });
      expect(step(sim)).toContainEqual({ type: 'command.rejected', command: 'galaxy.leaveEvent', reason: 'visitors' });
      for (let i = 0; i < 20 * 150 && !(trap ? ambushOf(sim)?.visit === 'sprung' : ambushOf(sim)?.home); i++) step(sim);
      // A sprung trap is an ordinary fight (leaving then is a flee); an honest party is home and the way is clear.
      expect(leaveBlocker(sim)).not.toBe('visitors');
      if (!trap) expect(leaveBlocker(sim)).toBeNull();
    }
  });

  it('a skiff wrecked after the dock was granted does not hold the player: the visit settles', () => {
    for (const trap of [true, false]) {
      const { sim, skiff } = inScene(3, trap);
      untilAsked(sim);
      sim.enqueue({ type: 'galaxy.visit', ship: skiff, grant: true });
      untilSent(sim, skiff);
      expect(leaveBlocker(sim)).toBe('visitors');
      (sim.world.get(skiff, ShipC) as { state: string }).state = 'wreck';
      expect(leaveBlocker(sim)).not.toBe('visitors'); // read from what is in play, not a stored phase
      step(sim, 40);
      expect(ambushOf(sim)?.visit).toBe('refused');
    }
  });

  it('a skiff wrecked with its party aboard: no permanent block, and the party turns hostile', () => {
    for (const trap of [true, false]) {
      const { sim, skiff } = inScene(3, trap);
      untilAsked(sim);
      sim.enqueue({ type: 'galaxy.visit', ship: skiff, grant: true });
      for (let i = 0; i < 20 * 150 && ambushOf(sim)?.visit !== 'aboard'; i++) step(sim);
      const party = sim.world.get(skiff, BoarderC)?.crew ?? [];
      expect(party.length).toBeGreaterThan(0);
      expect(party.every((c) => sim.world.get(c, AllegianceC)?.faction === 'neutral')).toBe(true);
      (sim.world.get(skiff, ShipC) as { state: string }).state = 'wreck';
      step(sim, 40);
      expect(leaveBlocker(sim)).not.toBe('visitors');
      expect(ambushOf(sim)?.visit).toBe('sprung');
      expect(party.every((c) => sim.world.get(c, AllegianceC)?.faction === 'hostile')).toBe(true); // you killed their ship
    }
  });

  it('a party killed aboard (honest, or a trap before it springs) or downed does not hold the player', () => {
    for (const trap of [true, false]) {
      const { sim, skiff } = inScene(3, trap);
      untilAsked(sim);
      sim.enqueue({ type: 'galaxy.visit', ship: skiff, grant: true });
      for (let i = 0; i < 20 * 150 && ambushOf(sim)?.visit !== 'aboard'; i++) step(sim);
      const party = sim.world.get(skiff, BoarderC)?.crew ?? [];
      expect(leaveBlocker(sim)).toBe('visitors');
      // Downed but alive: not underway (the downed-boarder handling applies), whatever the phase.
      for (const c of party) sim.world.add(c, DownedC, { bleed: 99, stabilized: false, bed: 0 });
      expect(leaveBlocker(sim)).not.toBe('visitors');
      for (const c of party) sim.world.remove(c, DownedC);
      expect(leaveBlocker(sim)).toBe('visitors');
      for (const c of party) killCrew(sim, c);
      expect(leaveBlocker(sim)).not.toBe('visitors');
      step(sim, 40);
      expect(ambushOf(sim)?.visit).toBe(trap ? 'sprung' : 'refused');
      expect(leaveBlocker(sim)).not.toBe('visitors');
    }
  });

  it('boarders killed cost standing with pirates; the skiff destroyed sets a flag', () => {
    const { sim, skiff } = inScene(3, true);
    untilAsked(sim);
    sim.enqueue({ type: 'galaxy.visit', ship: skiff, grant: true });
    for (let i = 0; i < 90 * 20 && ambushOf(sim)?.visit !== 'sprung'; i++) step(sim);
    const rep = sim.story.reputation['pirates'] ?? 0;
    for (const c of sim.world.get(skiff, BoarderC)?.crew ?? []) killCrew(sim, c);
    const out = step(sim, 40);
    expect(observed(out).map((e) => e.rule)).toContain('boardersDown');
    expect(sim.story.reputation['pirates'] ?? 0).toBeLessThan(rep);
    const ship = sim.world.get(skiff, ShipC);
    if (ship) ship.state = 'wreck';
    expect(observed(step(sim, 40)).map((e) => e.rule)).toContain('destroyed');
    expect(sim.story.flags['killed_pirate']).toBe(1);
  });

  it('the scene survives a save and reload mid-request', () => {
    const { sim } = inScene(3, true);
    untilAsked(sim);
    const copy = deserialize(serialize(sim), content);
    expect(copy.galaxy.event?.scene.ships[0]?.ambush?.visit).toBe('asked');
  });
});
