import { describe, expect, it } from 'vitest';
import {
  CombatC, FTL_CHARGE_SEC, START_NODE, ShipC, bribeCost, deserialize, evadeOddsFor, passingMeets, evadeOdds, evadeRoll, galaxyIndex, newGame, playerShip, serialize, type Sim,
} from '../sim';
import { fleetStrength } from '../sim/galaxy/encounterOdds';
import { eventNodeId } from '../sim/galaxy/eventGrid';
import type { Fleet } from '../sim/galaxy/types';
import { giveItems } from '../sim/story/effects';
import { content } from '.';

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
const adjacent = (sim: Sim, id: string): string[] =>
  (galaxyIndex(sim.galaxy).adjacent.get(id) ?? []).map((e) => (e.a === id ? e.b : e.a)).sort();
const enemies = (sim: Sim): number[] => sim.world.query(ShipC).filter((id) => sim.world.get(id, ShipC)?.faction !== 'player');
const packetCombat = (sim: Sim) => {
  const p = sim.sector.packet;
  return p?.entities.find((e) => e.id === p.ship)?.c['combat'] as { ftl: number; evasion: number; pilot: number };
};

/** The player flies two hops; a pirate fleet (or `faction`/`role`) at the first node flies the other way and interdicts there. */
function interdiction(seed: number, faction = 'pirates', role: Fleet['role'] = 'pirate', over: Partial<Fleet> = {}, others = 0) {
  const sim = newGame(seed, content);
  sim.story.goals.skipped = true; // opening grace off: these tests interdict at the danger-0 start
  sim.galaxy.fleets = [];
  giveItems(sim, 'item.fuel', 50);
  const c = sim.world.get(playerShip(sim), CombatC);
  if (c) c.ftl = FTL_CHARGE_SEC;
  const to = adjacent(sim, START_NODE)[0] as string;
  const next = adjacent(sim, to).find((n) => n !== START_NODE) ?? START_NODE;
  sim.enqueue({ type: 'galaxy.jump', ship: playerShip(sim), route: [to, next] });
  const g = sim.galaxy;
  // Non-hostile crossings only sometimes become a hail or scan: take a fleet id that does (the turn of the crossing is the next one).
  while (!passingMeets(sim, g.nextFleet, g.turn + 1)) g.nextFleet++;
  const f: Fleet = {
    id: g.nextFleet++, faction, role, ships: [{ id: g.nextFleet++, faction, shipgen: faction === 'pirates' ? 'faction.scrapper' : 'faction.civilian', seed: 77, depth: 1, since: 0 }],
    node: to, from: to, moved: -1, route: [START_NODE], dest: START_NODE, dwell: 0, legs: 0, home: `${START_NODE}#0`, synced: g.turn, ...over,
  };
  g.fleets.push(f);
  // More hostile fleets crossing the same hop (deeper ships, so the lead one is the strongest).
  for (let i = 0; i < others; i++) g.fleets.push({ ...f, id: g.nextFleet++, ships: [{ ...f.ships[0]!, id: g.nextFleet++, depth: 3 + i, seed: 80 + i }] });
  step(sim);
  flyOn(sim);
  return { sim, f, to, next, enc: g.encounters[0]! };
}
/** Fly on until the trip stops at something other than a hop, answering any story decision a hop draws (these tests are about encounters). */
const flyOn = (sim: Sim): void => {
  while (sim.galaxy.travel?.phase === 'hop' || sim.galaxy.travel?.phase === 'story') {
    step(sim);
    sim.story.active = null;
  }
};
const respond = (sim: Sim, choice: 'evade' | 'bribe' | 'fight' | 'respond' | 'ignore' | 'acknowledge', id = sim.galaxy.encounters[0]?.id as number) => {
  sim.enqueue({ type: 'galaxy.respond', encounter: id, choice });
  return step(sim);
};
/** Wreck every ship that is not the player's. */
const wreckEnemies = (sim: Sim) => {
  for (const id of enemies(sim)) {
    const s = sim.world.get(id, ShipC);
    if (s) s.state = 'wreck';
  }
};

describe('evade', () => {
  it('the roll is a pure function of the seed and the encounter id; odds follow evasion and fleet strength', () => {
    const a = interdiction(26);
    const b = interdiction(26);
    expect(evadeRoll(a.sim, a.enc)).toBe(evadeRoll(b.sim, b.enc));
    expect(a.enc.id).toBe(b.enc.id);
    const base = evadeOdds(a.sim, a.enc);
    Object.assign(packetCombat(a.sim), { evasion: 0.24, pilot: 3 });
    expect(evadeOdds(a.sim, a.enc)).toBeGreaterThan(base);
    expect(evadeOdds(a.sim, { ...a.enc, strength: a.enc.strength + 10 })).toBeLessThan(evadeOdds(a.sim, a.enc));
    expect(evadeOdds(a.sim, { ...a.enc, strength: 1000 })).toBeGreaterThanOrEqual(0.05);
  }, 60000);

  /** Make the roll land clear of the odds, by choosing an encounter id whose roll is mid-range and setting the helm to win or lose it. */
  function rigged(wins: boolean) {
    const r = interdiction(26);
    const { sim } = r;
    let id = r.enc.id;
    while (evadeRoll(sim, { ...r.enc, id }) < 0.2 || evadeRoll(sim, { ...r.enc, id }) > 0.7) id += 1000;
    r.enc.id = id;
    const roll = evadeRoll(sim, r.enc);
    // A top pilot at powered engines (about 0.8 against one small ship) wins a mid-range roll; no engine power (odds at the minimum) loses it.
    Object.assign(packetCombat(sim), wins ? { evasion: 0.12 * 1.5, pilot: 5 } : { evasion: 0, pilot: 0 });
    r.enc.strength = 1.5;
    expect(evadeOdds(sim, r.enc) > roll).toBe(wins);
    return r;
  }

  it('success: the encounter clears and the trip carries on along the route', () => {
    const { sim, next } = rigged(true);
    const ev = respond(sim, 'evade');
    expect(ev).toContainEqual(expect.objectContaining({ type: 'galaxy.evadeRoll', success: true }));
    expect(ev).toContainEqual(expect.objectContaining({ type: 'galaxy.encounterResolved', outcome: 'evaded' }));
    expect(sim.galaxy.encounters).toHaveLength(0);
    expect(sim.galaxy.event).toBeNull();
    flyOn(sim);
    expect(sim.galaxy.current).toBe(next);
    expect(sim.galaxy.travel?.phase).toBe('arrived');
  }, 60000);

  it('failure: forced into the fight on an event grid', () => {
    const { sim } = rigged(false);
    const ev = respond(sim, 'evade');
    expect(ev).toContainEqual(expect.objectContaining({ type: 'galaxy.evadeRoll', success: false }));
    expect(ev).toContainEqual(expect.objectContaining({ type: 'galaxy.eventEntered', kind: 'fight' }));
    expect(sim.galaxy.event).not.toBeNull();
    expect(sim.sector.node).toBe(eventNodeId(sim.galaxy.event!.id));
  }, 60000);
});

describe('evade odds follow the pilot', () => {
  const one = 1.5; // a lone depth-1 pirate
  const helm = (skill: number, engines = 1) => ({ evasion: 0.12 * engines * (1 + 0.1 * skill), pilot: skill });

  it('a top pilot gets about 0.8 against a single small pirate, a mediocre one about 0.4', () => {
    expect(evadeOddsFor(helm(5), one)).toBeCloseTo(0.8, 1);
    expect(evadeOddsFor(helm(1.5), one)).toBeCloseTo(0.4, 1);
    expect(evadeOddsFor(helm(3), one)).toBeGreaterThan(evadeOddsFor(helm(1.5), one));
  });

  it('the curve: a top pilot evades a moderate fleet about 80% of the time, a novice rarely, and strength matters', () => {
    const light = 1.5, moderate = 3.5, heavy = 7, overwhelming = 12;
    const row = (skill: number) => [light, moderate, heavy, overwhelming].map((s) => evadeOddsFor(helm(skill), s));
    expect(row(5)[1]).toBeGreaterThanOrEqual(0.75);
    expect(row(5)[1]).toBeLessThanOrEqual(0.85);
    expect(row(3)[1]).toBeGreaterThan(0.45);
    expect(row(3)[1]).toBeLessThan(0.65);
    expect(row(0.5)[1]).toBeLessThan(0.35);
    for (const skill of [0.5, 3, 5]) for (let i = 1; i < 4; i++) expect(row(skill)[i]).toBeLessThanOrEqual(row(skill)[i - 1] as number);
    for (let i = 0; i < 4; i++) expect(row(5)[i]).toBeGreaterThan(row(3)[i] as number);
  });

  it('with nobody at the helm the best pilot aboard flies: the staged ship is no longer stuck at the floor', () => {
    const sim = newGame(26, content);
    sim.story.goals.skipped = true; // opening grace off: these tests interdict at the danger-0 start
    const combat = sim.world.get(playerShip(sim), CombatC)!;
    for (let i = 0; i < 40; i++) sim.step();
    expect(combat.pilot).toBe(0);
    expect(combat.cruisePilot).toBeGreaterThan(0);
    expect(combat.cruiseEvasion).toBeGreaterThan(0);
    expect(evadeOdds(sim, { strength: 3.5 } as never)).toBeGreaterThan(0.4);
  });

  it('no pilot or unpowered engines are at the minimum; weaker engines and bigger fleets lower the odds', () => {
    expect(evadeOddsFor({ evasion: 0, pilot: 0 }, one)).toBe(0.05);
    expect(evadeOddsFor({ evasion: 0, pilot: 5 }, one)).toBe(0.05);
    expect(evadeOddsFor(helm(5, 0.5), one)).toBeLessThan(evadeOddsFor(helm(5), one));
    expect(evadeOddsFor(helm(5), 6)).toBeLessThan(evadeOddsFor(helm(5), one));
    expect(evadeOddsFor(helm(50), 0)).toBeLessThanOrEqual(0.9);
    expect(evadeOddsFor(helm(5), 1000)).toBe(0.05);
  });
});

describe('two hostile fleets on one hop', () => {
  it('only the strongest interdicts, and answering it lets the trip go on and travel work afterwards', () => {
    const { sim, f, enc } = interdiction(26, 'pirates', 'pirate', {}, 1);
    const pending = sim.galaxy.encounters.filter((e) => e.kind === 'interdict');
    expect(pending).toHaveLength(1);
    expect(pending[0]?.fleet).not.toBe(f.id);
    expect(pending[0]?.strength).toBeGreaterThan(fleetStrength(f.ships));
    expect(enc.kind).toBe('interdict');
    sim.trade.credits = 5000;
    respond(sim, 'bribe', pending[0]!.id);
    expect(sim.galaxy.encounters.filter((e) => e.kind === 'interdict')).toHaveLength(0);
    expect(sim.galaxy.travel?.phase).not.toBe('interdicted');
    // The trip carries on and ends; a new jump is accepted afterwards.
    for (let i = 0; i < 80 && sim.galaxy.travel; i++) { step(sim); sim.story.active = null; if (sim.galaxy.travel?.phase === 'arrived') sim.enqueue({ type: 'galaxy.drop' }); }
    expect(sim.galaxy.travel).toBeNull();
  }, 60000);

  it('a second interdiction left pending (an older save) keeps the trip halted until it is answered too, then resumes', () => {
    const { sim, enc } = interdiction(26);
    const twin = { ...enc, id: sim.galaxy.nextFleet++, fleet: enc.fleet };
    sim.galaxy.encounters.push(twin);
    sim.trade.credits = 5000;
    respond(sim, 'bribe', enc.id);
    expect(sim.galaxy.travel?.phase).toBe('interdicted');
    expect(sim.galaxy.encounters.map((e) => e.id)).toEqual([twin.id]);
    respond(sim, 'bribe', twin.id);
    expect(sim.galaxy.encounters.some((e) => e.kind === 'interdict')).toBe(false);
    expect(sim.galaxy.travel?.phase).not.toBe('interdicted');
  }, 60000);
});

describe('bribe', () => {
  it('costs more for stronger fleets and deeper danger, and less with good standing', () => {
    const { sim, enc } = interdiction(26);
    const c = bribeCost(sim, enc);
    expect(c).toBeGreaterThanOrEqual(10);
    expect(bribeCost(sim, { ...enc, strength: enc.strength * 3 })).toBeGreaterThan(c);
    expect(bribeCost(sim, { ...enc, danger: enc.danger + 4 })).toBeGreaterThan(c);
    sim.story.reputation.pirates = 6;
    expect(bribeCost(sim, enc)).toBeLessThan(c);
  }, 60000);

  it('is refused without the credits, leaving the interdiction pending', () => {
    const { sim } = interdiction(26);
    sim.trade.credits = 0;
    expect(respond(sim, 'bribe')).toContainEqual({ type: 'command.rejected', command: 'galaxy.respond', reason: 'cantAfford' });
    expect(sim.galaxy.encounters).toHaveLength(1);
    expect(sim.galaxy.travel?.phase).toBe('interdicted');
  }, 60000);

  it('pays, clears the encounter, resumes the trip and starts the fleet cooldown', () => {
    const { sim, f, enc, next } = interdiction(26);
    const cost = bribeCost(sim, enc);
    sim.trade.credits = cost + 5;
    const turn = sim.galaxy.turn;
    const ev = respond(sim, 'bribe');
    expect(ev).toContainEqual({ type: 'galaxy.bribed', id: enc.id, cost, faction: 'pirates' });
    expect(sim.trade.credits).toBe(5);
    expect(sim.galaxy.encounters).toHaveLength(0);
    expect(f.met).toBe(turn);
    flyOn(sim);
    expect(sim.galaxy.current).toBe(next);
  }, 60000);
});

describe('fight', () => {
  it('opens an event grid: a pocket with the player packet and the fleet ships, nothing archived', () => {
    const { sim, f, to } = interdiction(26);
    const archives = sim.archives.length;
    const ev = respond(sim, 'fight');
    expect(ev).toContainEqual(expect.objectContaining({ type: 'galaxy.encounterResolved', outcome: 'fought' }));
    const grid = sim.galaxy.event!;
    expect(grid.kind).toBe('fight');
    expect(sim.sector.node).toBe(`event:${grid.id}`);
    expect(sim.galaxy.current).toBe(to);
    expect(sim.sector.state).toBe('deploying');
    expect(sim.sector.packet?.ship).toBeGreaterThan(0);
    expect(sim.galaxy.travel?.phase).toBe('event');
    expect(sim.galaxy.fleets.includes(f)).toBe(false);
    expect(enemies(sim)).toHaveLength(1);
    expect(sim.world.get(enemies(sim)[0] as number, ShipC)?.faction).not.toBe('neutral');
    expect(sim.archives).toHaveLength(archives);
    expect(sim.galaxy.nodes[sim.sector.node]).toBeUndefined();
    deploy(sim);
    expect(sim.sector.state).toBe('active');
    step(sim, 60);
    expect(sim.sector.inCombat).toBe(true);
    // The event grid draws nothing from the map: no story draw, no arrivals, no turns.
    const turn = sim.galaxy.turn;
    step(sim, 1300);
    expect(sim.galaxy.turn).toBe(turn);
    expect(sim.archives).toHaveLength(archives);
  }, 60000);

  it('jumping and dropping are refused in the grid', () => {
    const { sim } = interdiction(26);
    respond(sim, 'fight');
    deploy(sim);
    sim.enqueue({ type: 'galaxy.jump', ship: playerShip(sim), route: [START_NODE] });
    expect(step(sim)).toContainEqual({ type: 'command.rejected', command: 'galaxy.jump', reason: 'inEvent' });
    sim.enqueue({ type: 'galaxy.drop' });
    expect(step(sim)).toContainEqual(expect.objectContaining({ type: 'command.rejected', command: 'galaxy.drop' }));
  }, 60000);

  it('combat won: leaving puts the ship back in hyperspace, travel resumes to the original destination, the grid leaves nothing', () => {
    const { sim, next, f } = interdiction(26);
    const archives = sim.archives.length;
    respond(sim, 'fight');
    deploy(sim);
    step(sim, 40);
    wreckEnemies(sim);
    step(sim, 5);
    sim.enqueue({ type: 'galaxy.leaveEvent' });
    const ev = step(sim);
    expect(ev).toContainEqual(expect.objectContaining({ type: 'galaxy.eventLeft' }));
    expect(sim.galaxy.event).toBeNull();
    expect(sim.sector.state).toBe('hyperspace');
    expect(sim.sector.packet?.ship).toBeGreaterThan(0);
    expect(sim.world.ids()).toHaveLength(0);
    expect(sim.archives).toHaveLength(archives);
    expect(sim.galaxy.fleets.includes(f)).toBe(false); // destroyed
    expect(sim.sector.inCombat).toBe(false);
    expect(sim.galaxy.lastResult?.outcome).toBe('cleared');
    expect(sim.galaxy.travel?.phase).toBe('hop');
    flyOn(sim);
    expect(sim.galaxy.current).toBe(next);
    expect(sim.galaxy.travel?.phase).toBe('arrived');
    sim.enqueue({ type: 'galaxy.drop' });
    step(sim, 2);
    deploy(sim);
    expect(sim.sector.state).toBe('active');
    expect(sim.sector.node).toBe(next);
    expect(sim.archives.some((a) => a.node.startsWith('event:'))).toBe(false);
  }, 60000);

  it('leaving under fire needs a charged drive; survivors go back to the map as descriptors with the cooldown', () => {
    const { sim, f } = interdiction(26);
    respond(sim, 'fight');
    deploy(sim);
    step(sim, 40);
    const me = sim.world.get(playerShip(sim), CombatC)!;
    me.ftl = 0;
    sim.enqueue({ type: 'galaxy.leaveEvent' });
    expect(step(sim)).toContainEqual({ type: 'command.rejected', command: 'galaxy.leaveEvent', reason: 'notCharged' });
    expect(sim.galaxy.event).not.toBeNull();
    me.ftl = FTL_CHARGE_SEC;
    const turn = sim.galaxy.turn;
    sim.enqueue({ type: 'combat.flee', ship: playerShip(sim) });
    step(sim);
    expect(sim.galaxy.event).toBeNull();
    expect(sim.sector.state).toBe('hyperspace');
    expect(packetCombat(sim).ftl).toBe(0);
    expect(sim.galaxy.fleets.includes(f)).toBe(true);
    expect(f.ships.every((c) => c.ship === undefined)).toBe(true);
    expect(f.met).toBe(turn);
    expect(sim.world.ids()).toHaveLength(0);
  }, 60000);

  it('leaving before deploying also works', () => {
    const { sim, next } = interdiction(26);
    respond(sim, 'fight');
    sim.enqueue({ type: 'galaxy.leaveEvent' });
    step(sim);
    expect(sim.galaxy.event).toBeNull();
    expect(sim.sector.state).toBe('hyperspace');
    flyOn(sim);
    expect(sim.galaxy.current).toBe(next);
  }, 60000);
});

describe('save and load', () => {
  const same = (a: Sim, b: Sim) => expect(serialize(b)).toBe(serialize(a));

  it('mid-encounter: a reload continues identically', () => {
    const { sim } = interdiction(26);
    const copy = deserialize(serialize(sim), content);
    same(sim, copy);
    sim.trade.credits = copy.trade.credits = 5000;
    respond(sim, 'bribe');
    respond(copy, 'bribe');
    step(sim, 60);
    step(copy, 60);
    same(sim, copy);
  }, 60000);

  it('mid-fight (before and after deploying): a reload continues identically', () => {
    const { sim } = interdiction(26);
    respond(sim, 'fight');
    let copy = deserialize(serialize(sim), content);
    same(sim, copy);
    deploy(sim);
    deploy(copy);
    step(sim, 200);
    step(copy, 200);
    same(sim, copy);
    copy = deserialize(serialize(sim), content);
    step(sim, 100);
    step(copy, 100);
    same(sim, copy);
    expect(copy.galaxy.event).not.toBeNull();
    wreckEnemies(sim);
    wreckEnemies(copy);
    for (const s of [sim, copy]) s.enqueue({ type: 'galaxy.leaveEvent' });
    step(sim, 200);
    step(copy, 200);
    same(sim, copy);
    expect(copy.galaxy.event).toBeNull();
  }, 60000);
});

describe('alerts: hail, scan, distress', () => {
  it('a hail and a scan are acknowledged and clear', () => {
    for (const [faction, role, kind] of [['traders', 'trader', 'hail'], ['navy', 'patrol', 'scan']] as const) {
      const { sim } = interdiction(27, faction, role);
      const e = sim.galaxy.encounters.find((x) => x.kind === kind);
      expect(e).toBeDefined();
      respond(sim, 'acknowledge', e!.id);
      expect(sim.galaxy.encounters.some((x) => x.id === e!.id)).toBe(false);
      respond(sim, 'fight', e!.id); // gone now
    }
  }, 60000);

  /** A stranded damaged trader sits at the node the player reaches. */
  function distress() {
    const sim = newGame(27, content);
    sim.story.goals.skipped = true; // opening grace off: these tests interdict at the danger-0 start
    sim.galaxy.fleets = [];
    giveItems(sim, 'item.fuel', 50);
    const c = sim.world.get(playerShip(sim), CombatC);
    if (c) c.ftl = FTL_CHARGE_SEC;
    const to = adjacent(sim, START_NODE)[0] as string;
    const next = adjacent(sim, to).find((n) => n !== START_NODE) ?? START_NODE;
    const g = sim.galaxy;
    const f: Fleet = {
      id: g.nextFleet++, faction: 'traders', role: 'trader', ships: [{ id: g.nextFleet++, faction: 'traders', shipgen: 'faction.civilian', seed: 5, depth: 1, since: 0 }],
      node: to, from: to, moved: -1, route: [], dest: to, dwell: 99, legs: 0, home: `${START_NODE}#0`, synced: g.turn, damaged: true,
    };
    g.fleets.push(f);
    sim.enqueue({ type: 'galaxy.jump', ship: playerShip(sim), route: [to, next] });
    while (!g.encounters.length) step(sim);
    return { sim, f, to, next };
  }

  it('respond: an event grid with the damaged ship as a neutral; leaving carries the trip on, the helped fleet is no longer adrift', () => {
    const { sim, f, next } = distress();
    expect(sim.galaxy.encounters[0]?.kind).toBe('distress');
    const rep = sim.story.reputation.traders ?? 0;
    respond(sim, 'respond');
    expect(sim.galaxy.event?.kind).toBe('rescue');
    expect(enemies(sim).map((id) => sim.world.get(id, ShipC)?.faction)).toEqual(['neutral']);
    deploy(sim);
    step(sim, 100);
    expect(sim.sector.inCombat).toBe(false);
    sim.enqueue({ type: 'galaxy.leaveEvent' });
    step(sim);
    expect(sim.galaxy.event).toBeNull();
    expect(sim.story.reputation.traders).toBeGreaterThan(rep);
    expect(f.damaged).toBeUndefined();
    expect(sim.galaxy.fleets.includes(f)).toBe(true);
    flyOn(sim);
    expect(sim.galaxy.current).toBe(next);
  }, 60000);

  it('ignore: the call is dropped and the trip is untouched', () => {
    const { sim, f, next } = distress();
    respond(sim, 'ignore');
    expect(sim.galaxy.encounters).toHaveLength(0);
    expect(sim.galaxy.event).toBeNull();
    expect(sim.galaxy.fleets.includes(f)).toBe(true);
    flyOn(sim);
    expect(sim.galaxy.current).toBe(next);
  }, 60000);
});
