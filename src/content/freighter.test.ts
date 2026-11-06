import { describe, expect, it } from 'vitest';
import { CombatC, FTL_CHARGE_SEC, START_NODE, ShipC, deserialize, galaxyIndex, newGame, playerShip, serialize, type Sim } from '../sim';
import { CrewC, PositionC } from '../sim/crew/components';
import { AllegianceC } from '../sim/fight/components';
import { AwayC, AwaySiteC } from '../sim/away/components';
import { ModuleC } from '../sim/modules/components';
import { shipGrid, shipIdOf } from '../sim/regions';
import { giveItems } from '../sim/story/effects';
import { playerStock } from '../sim/story/world';
import type { EventDef } from '../sim';
import type { SceneShipRecipe } from '../sim/scene/types';
import { ConsentC } from '../sim/consent/components';
import { guestOn } from '../sim/consent/guests';
import { content } from '.';

/** The distress freighter (#173 step 5): a helpless ship, aid by hail with guests aboard, the reactor clock (fires, then it blows), raiders, the observer. */

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

const EVENT = 'event.distress_call';
const base = content.events[EVENT] as EventDef;
/** The content with the freighter's raiders fixed: left out, there from the start, or coming on their clock. */
function withRaiders(mode: 'none' | 'here' | 'coming'): typeof content {
  const ships = (base.scene?.ships ?? []).map((r): SceneShipRecipe => {
    if (!r.arrive) return r;
    const rest = { ...r };
    delete rest.danger;
    return { ...rest, chance: mode === 'none' ? 0 : 1, arrive: { ...r.arrive, chance: mode === 'coming' ? 1 : 0 } };
  });
  return { ...content, events: { ...content.events, [EVENT]: { ...base, scene: { ...base.scene!, ships } } } } as typeof content;
}

/** A two-hop trip whose first hop signals the freighter; stops with the decision open. */
function signalled(seed: number, c = content): Sim {
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
const choose = (sim: Sim, choice: string) => {
  sim.enqueue({ type: 'story.choose', choice });
  return step(sim, 2);
};
/** Into the freighter's scene, deployed (`help`: help was offered on the hail first). */
function inScene(seed: number, opts: { help?: boolean; c?: typeof content } = {}): { sim: Sim; freighter: number } {
  const sim = signalled(seed, opts.c ?? withRaiders('none'));
  if (opts.help) choose(sim, 'hail');
  choose(sim, opts.help ? 'help' : 'approach');
  deploy(sim);
  const s = sim.galaxy.event?.scene.ships.find((x) => x.tag === 'freighter');
  return { sim, freighter: s?.contact.ship as number };
}
const spec = (sim: Sim) => sim.galaxy.event!.scene.ships.find((x) => x.tag === 'freighter')!;
const timer = (sim: Sim) => sim.galaxy.event!.scene.timers[0]!;
const firesOn = (sim: Sim, ship: number): number => {
  const g = shipGrid(sim, ship)!;
  let n = 0;
  for (let y = g.y0; y < g.y0 + g.height; y++) for (let x = g.x0; x < g.x0 + g.width; x++) if (g.get('fire', x, y) > 0) n++;
  return n;
};
const fired = (sim: Sim): string[] => sim.galaxy.event!.watch.fired.map((k) => k.split('#')[0] as string);
/** Stand one of the player's crew on a floor tile of the ship. */
function standOn(sim: Sim, ship: number, crew: number): void {
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
const playerCrewIds = (sim: Sim): number[] => sim.world.query(CrewC, PositionC).filter((id) => sim.world.get(id, AllegianceC)?.faction === 'player');

describe('distress freighter: signal', () => {
  it('rolls a helpless freighter with a failing reactor and a clock; no raiders at the start tier', () => {
    const sim = signalled(3, content);
    const s = sim.galaxy.signal!;
    expect(s.ships).toHaveLength(1); // danger 0: raiders only deeper
    expect(s.ships[0]).toMatchObject({ tag: 'freighter', stance: 'helpless' });
    expect(s.ships[0]?.damage?.find((d) => d.failing)?.def).toBe('module.reactor');
    expect(s.timers[0]).toMatchObject({ id: 'reactor', ship: 'freighter', stopOn: 'repaired', due: 'wreck' });
    expect(s.timers[0]!.afterSec).toBeGreaterThanOrEqual(130);
  });

  it('offering help needs the hail first, and agrees help before dropping out', () => {
    const sim = signalled(3, content);
    expect(choose(sim, 'help')).toContainEqual({ type: 'command.rejected', command: 'story.choose', reason: 'unmet' });
    choose(sim, 'hail');
    choose(sim, 'help');
    deploy(sim);
    expect(spec(sim).aid?.state).toBe('agreed');
  });
});

describe('distress freighter: the scene', () => {
  it('spawns damaged and stays put; the damage is what the spec rolled', () => {
    const { sim, freighter } = inScene(3);
    const s = spec(sim);
    expect(sim.world.get(freighter, ShipC)?.faction).toBe('neutral');
    expect(s.damaged?.length).toBe(2);
    expect(s.failing).toHaveLength(1);
    const m = sim.world.get(s.failing![0]!, ModuleC)!;
    expect(m.def).toBe('module.reactor');
    expect(m.hp).toBe(Math.round((200 * (s.damage![0]!.pct)) / 100));
    step(sim, 60 * 20);
    expect(sim.world.get(freighter, ShipC)?.state).not.toBe('fled');
    expect(sim.world.get(s.failing![0]!, ModuleC)!.hp).toBe(m.hp); // its own crew cannot mend it
  });

  it('breaks out fires as the clock runs down, then blows: a wreck, everyone aboard gone, the rules fire', () => {
    const { sim, freighter } = inScene(4);
    const t = timer(sim);
    const leadAt = (t.at as number) - (t.fires!.leadSec * 20);
    step(sim, Math.max(0, leadAt - sim.tick) - 20);
    expect(firesOn(sim, freighter)).toBe(0);
    step(sim, 3 * 20);
    expect(firesOn(sim, freighter)).toBeGreaterThan(0);
    expect(t.fired).toBe(1);
    step(sim, (t.at as number) - sim.tick + 3 * 20);
    expect(t.blown).toBe(true);
    expect(sim.world.get(freighter, ShipC)?.state).toBe('wreck');
    expect(fired(sim)).toEqual(expect.arrayContaining(['reactorBlew', 'destroyed']));
  }, 60000);

  it('repairing the failing reactor in time stops the clock', () => {
    const { sim, freighter } = inScene(4);
    const s = spec(sim);
    const m = sim.world.get(s.failing![0]!, ModuleC)!;
    m.hp = 200;
    const out = step(sim, 21);
    expect(timer(sim).stopped).toBe(true);
    expect(out.some((e) => e.type === 'scene.observed' && e.rule === 'reactorStopped')).toBe(true);
    step(sim, (timer(sim).at as number) - sim.tick + 40);
    expect(sim.world.get(freighter, ShipC)?.state).not.toBe('wreck');
    expect(fired(sim)).not.toContain('reactorBlew');
  }, 60000);
});

describe('distress freighter: aid by hail', () => {
  it('the agreed party goes aboard as guests: no provocation, no boarding rule', () => {
    const { sim, freighter } = inScene(3, { help: true });
    step(sim, 21);
    const site = sim.world.get(freighter, AwaySiteC);
    expect(site).toMatchObject({ owner: 'aid', status: 'open', noLoot: true });
    expect(spec(sim).aid).toMatchObject({ state: 'agreed', sent: true });
    // A party member landed aboard (as the site's run would put them).
    const crew = playerCrewIds(sim)[0] as number;
    sim.world.add(crew, AwayC, { site: freighter, vehicle: site!.vehicle, cat: 'repair' });
    standOn(sim, freighter, crew);
    step(sim, 41);
    expect(sim.world.get(freighter, ShipC)).toMatchObject({ faction: 'neutral' });
    expect(sim.world.get(freighter, ShipC)?.provoked).toBeUndefined();
    expect(fired(sim)).not.toContain('boarded');
  });

  it('end to end: the party flies over, mends the reactor before the clock runs out, and comes home', () => {
    const { sim, freighter } = inScene(3, { help: true });
    const s = spec(sim);
    let aboard = 0;
    for (let i = 0; i < 150 && s.aid?.state !== 'done'; i++) {
      step(sim, 20);
      aboard = Math.max(aboard, playerCrewIds(sim).filter((c) => shipIdOf(sim, sim.world.get(c, PositionC)!) === freighter).length);
    }
    expect(aboard).toBeGreaterThan(0);
    expect(s.aid?.state).toBe('done');
    expect(timer(sim).stopped).toBe(true);
    expect(sim.world.get(freighter, ShipC)).toMatchObject({ faction: 'neutral', state: 'active' });
    expect(sim.world.get(freighter, ShipC)?.provoked).toBeUndefined();
    expect(fired(sim)).toContain('helped');
    expect(fired(sim)).not.toContain('boarded');
  }, 120000);

  it('the leave is a consent grant: void once the host is at war with the guests, gone with the site', () => {
    const { sim, freighter } = inScene(3, { help: true });
    step(sim, 21);
    const site = sim.world.get(freighter, AwaySiteC)!;
    expect(sim.world.get(freighter, ConsentC)?.grants).toEqual([expect.objectContaining({ by: 'aid', faction: 'player', site: freighter })]);
    const crew = playerCrewIds(sim)[0] as number;
    sim.world.add(crew, AwayC, { site: freighter, vehicle: site.vehicle, cat: 'repair' });
    expect(guestOn(sim, crew, freighter)).toBe(true);
    (sim.world.get(freighter, ShipC) as { faction: string }).faction = 'hostile';
    expect(guestOn(sim, crew, freighter)).toBe(false);
    (sim.world.get(freighter, ShipC) as { faction: string }).faction = 'neutral';
    sim.world.remove(freighter, AwaySiteC);
    expect(guestOn(sim, crew, freighter)).toBe(false);
    step(sim, 21);
    expect(sim.world.has(freighter, ConsentC)).toBe(false);
  });

  it('uninvited boarding still provokes, and calls off help agreed', () => {
    const { sim, freighter } = inScene(3, { help: true });
    step(sim, 21);
    const crew = playerCrewIds(sim).find((c) => !sim.world.has(c, AwayC)) as number;
    standOn(sim, freighter, crew);
    const out = step(sim, 41);
    expect(sim.world.get(freighter, ShipC)?.provoked).toBe('boarded');
    expect(fired(sim)).toContain('boarded');
    expect(spec(sim).aid?.state).toBe('broken');
    expect(out).toContainEqual({ type: 'scene.aid', ship: freighter, state: 'broken' });
    expect(sim.world.get(freighter, AwaySiteC)?.status ?? 'closing').toBe('closing');
  });

  it('helping in the pocket by command; the repairs done close the site and fire the shared helped rule', () => {
    const { sim, freighter } = inScene(3);
    const before = sim.story.reputation['traders'] ?? 0;
    sim.enqueue({ type: 'galaxy.aid', ship: freighter });
    const out = step(sim, 21);
    expect(out).toContainEqual({ type: 'scene.aid', ship: freighter, state: 'agreed' });
    expect(sim.world.get(freighter, AwaySiteC)?.owner).toBe('aid');
    const fuel = playerStock(sim, 'item.fuel');
    for (const id of spec(sim).damaged!) sim.world.get(id, ModuleC)!.hp = sim.content.modules[sim.world.get(id, ModuleC)!.def]!.maxHp;
    const after = step(sim, 41);
    expect(spec(sim).aid?.state).toBe('done');
    expect(after).toContainEqual({ type: 'scene.aid', ship: freighter, state: 'done' });
    expect(sim.world.get(freighter, AwaySiteC)?.status ?? 'closing').toBe('closing');
    expect(fired(sim)).toContain('helped');
    expect(sim.story.reputation['traders']).toBe(before + 2);
    expect(sim.story.flags['ships_helped']).toBe(1);
    const gifts = spec(sim).cargo!.slice(0, 2).map((q) => q.item);
    expect(gifts.some((i) => (i === 'item.fuel' ? playerStock(sim, i) > fuel : playerStock(sim, i) > 0))).toBe(true);
    // Done is done: no second offer.
    sim.enqueue({ type: 'galaxy.aid', ship: freighter });
    expect(step(sim)).toContainEqual({ type: 'command.rejected', command: 'galaxy.aid', reason: 'done' });
  });

  it('leaving with the help under way: abandoned (standing lost) and doomed (its own clock)', () => {
    const { sim, freighter } = inScene(3);
    spec(sim).aid = { state: 'agreed', sent: true }; // agreed, the party not out
    const before = sim.story.reputation['traders'] ?? 0;
    sim.enqueue({ type: 'galaxy.leaveEvent' });
    const out = step(sim, 1).filter((e) => e.type === 'scene.observed').map((e) => (e as { rule: string }).rule);
    expect(out).toEqual(expect.arrayContaining(['abandoned', 'doomed']));
    expect(sim.story.reputation['traders']).toBe(before - 1);
    expect(sim.story.flags['aid_abandoned']).toBe(1);
    expect(freighter).toBeGreaterThan(0);
  });

  it('saves and loads mid-aid', () => {
    const { sim } = inScene(4, { help: true });
    step(sim, 61);
    const copy = deserialize(serialize(sim), sim.content);
    step(sim, 60);
    step(copy, 60);
    expect(serialize(copy)).toEqual(serialize(sim));
  });
});

describe('distress freighter: raiders', () => {
  it('already circling: hostile at open, guns on the freighter', () => {
    const { sim, freighter } = inScene(3, { c: withRaiders('here') });
    const r = sim.galaxy.event!.scene.ships.find((x) => x.tag === 'raider')!;
    expect(r.contact.ship).toBeDefined();
    expect(sim.world.get(r.contact.ship!, ShipC)?.faction).toBe('hostile');
    expect(sim.world.get(r.contact.ship!, CombatC)?.prey).toBe(freighter);
    step(sim, 10 * 20);
    expect(sim.world.get(r.contact.ship!, CombatC)?.target?.ship).toBe(freighter);
  }, 60000);

  it('coming on a clock: not there at open, jumps in when it is due', () => {
    const { sim, freighter } = inScene(3, { c: withRaiders('coming') });
    const r = sim.galaxy.event!.scene.ships.find((x) => x.tag === 'raider')!;
    expect(r.arriveAfter).toBeGreaterThanOrEqual(60);
    expect(r.contact.ship).toBeUndefined();
    step(sim, (r.arriveAt as number) - sim.tick - 40);
    expect(r.contact.ship).toBeUndefined();
    step(sim, 80);
    expect(r.contact.ship).toBeDefined();
    expect(sim.world.get(r.contact.ship!, CombatC)?.prey).toBe(freighter);
  }, 60000);
});
