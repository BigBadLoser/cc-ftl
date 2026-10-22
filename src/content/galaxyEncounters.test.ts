import { describe, expect, it } from 'vitest';
import {
  CombatC, FTL_CHARGE_SEC, START_NODE, ShipC, bribeCost, deserialize, evadeOdds, evadeRoll, galaxyIndex, newGame, playerShip, serialize, type Sim,
} from '../sim';
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
  return p?.entities.find((e) => e.id === p.ship)?.c['combat'] as { ftl: number; evasion: number };
};

/** The player flies two hops; a pirate fleet (or `faction`/`role`) at the first node flies the other way and interdicts there. */
function interdiction(seed: number, faction = 'pirates', role: Fleet['role'] = 'pirate', over: Partial<Fleet> = {}) {
  const sim = newGame(seed, content);
  sim.galaxy.fleets = [];
  giveItems(sim, 'item.fuel', 50);
  const c = sim.world.get(playerShip(sim), CombatC);
  if (c) c.ftl = FTL_CHARGE_SEC;
  const to = adjacent(sim, START_NODE)[0] as string;
  const next = adjacent(sim, to).find((n) => n !== START_NODE) ?? START_NODE;
  sim.enqueue({ type: 'galaxy.jump', ship: playerShip(sim), route: [to, next] });
  const g = sim.galaxy;
  const f: Fleet = {
    id: g.nextFleet++, faction, role, ships: [{ id: g.nextFleet++, faction, shipgen: faction === 'pirates' ? 'faction.scrapper' : 'faction.civilian', seed: 77, depth: 1, since: 0 }],
    node: to, from: to, moved: -1, route: [START_NODE], dest: START_NODE, dwell: 0, ttl: 99, ...over,
  };
  g.fleets.push(f);
  step(sim);
  while (g.travel?.phase === 'hop') step(sim);
  return { sim, f, to, next, enc: g.encounters[0]! };
}
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
    packetCombat(a.sim).evasion = 0.5;
    expect(evadeOdds(a.sim, a.enc)).toBeGreaterThan(base);
    expect(evadeOdds(a.sim, { ...a.enc, strength: a.enc.strength + 10 })).toBeLessThan(evadeOdds(a.sim, a.enc));
    expect(evadeOdds(a.sim, { ...a.enc, strength: 1000 })).toBeGreaterThanOrEqual(0.05);
  }, 60000);

  /** Make the roll land between the odds, by choosing an encounter id whose roll is mid-range and setting the evasion around it. */
  function rigged(wins: boolean) {
    const r = interdiction(26);
    const { sim } = r;
    let id = r.enc.id;
    while (evadeRoll(sim, { ...r.enc, id }) < 0.2 || evadeRoll(sim, { ...r.enc, id }) > 0.7) id += 1000;
    r.enc.id = id;
    const roll = evadeRoll(sim, r.enc);
    packetCombat(sim).evasion = Math.max(0, roll + (wins ? 0.1 : -0.1) - 0.3 + r.enc.strength * 0.05);
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
    while (sim.galaxy.travel?.phase === 'hop') step(sim);
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
    while (sim.galaxy.travel?.phase === 'hop') step(sim);
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
    expect(sim.galaxy.travel?.phase).toBe('hop');
    while (sim.galaxy.travel?.phase === 'hop') step(sim);
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
    while (sim.galaxy.travel?.phase === 'hop') step(sim);
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
    sim.galaxy.fleets = [];
    giveItems(sim, 'item.fuel', 50);
    const c = sim.world.get(playerShip(sim), CombatC);
    if (c) c.ftl = FTL_CHARGE_SEC;
    const to = adjacent(sim, START_NODE)[0] as string;
    const next = adjacent(sim, to).find((n) => n !== START_NODE) ?? START_NODE;
    const g = sim.galaxy;
    const f: Fleet = {
      id: g.nextFleet++, faction: 'traders', role: 'trader', ships: [{ id: g.nextFleet++, faction: 'traders', shipgen: 'faction.civilian', seed: 5, depth: 1, since: 0 }],
      node: to, from: to, moved: -1, route: [], dest: to, dwell: 99, ttl: 99, damaged: true,
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
    while (sim.galaxy.travel?.phase === 'hop') step(sim);
    expect(sim.galaxy.current).toBe(next);
  }, 60000);

  it('ignore: the call is dropped and the trip is untouched', () => {
    const { sim, f, next } = distress();
    respond(sim, 'ignore');
    expect(sim.galaxy.encounters).toHaveLength(0);
    expect(sim.galaxy.event).toBeNull();
    expect(sim.galaxy.fleets.includes(f)).toBe(true);
    while (sim.galaxy.travel?.phase === 'hop') step(sim);
    expect(sim.galaxy.current).toBe(next);
  }, 60000);
});
