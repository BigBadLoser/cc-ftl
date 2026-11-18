import { describe, expect, it } from 'vitest';
import { CombatC, ShipC, WeaponC } from '../sim/combat/components';
import { remotesDone } from '../sim/story/requirements';
import { deserialize, serialize } from '../sim/save';
import type { Sim } from '../sim/sim';
import { playerShip } from '../sim/trade/player';
import { CrewC, DeadC, JobC, PositionC, WorkBlockC } from '../sim/crew/components';
import { jobFits } from '../sim/crew/jobFit';
import { AwayC, AwaySiteC } from '../sim/away/components';
import { ModuleC } from '../sim/modules/components';
import { shipGrid, shipIdOf } from '../sim/regions';
import { playerStock } from '../sim/items/held';
import { ConsentC } from '../sim/consent/components';
import { guestOn } from '../sim/consent/guests';
import { content } from '.';
import { run } from '../../test/support/sim';
import { cachedWorld } from '../../test/support/world';

/** The distress freighter (#173 step 5): a helpless ship, aid by hail with guests aboard, the reactor clock (fires, then it blows), raiders, the observer. */
import { deploy, expectPartyMends, withRaiders, signalled, choose, buildScene, freighterOf, spec, timer, firesOn, fired, standOn, countSpace, playerCrewIds } from '../../test/support/fixtures/freighter';


/** The scene as `buildScene` leaves it, built once per worker and handed out as a fresh clone (a save round-trip) per test. */
export function inScene(seed: number, opts: { help?: boolean; raiders?: 'none' | 'here' | 'coming' } = {}): { sim: Sim; freighter: number } {
  const raiders = opts.raiders ?? 'none';
  const sim = cachedWorld(`freighter:${seed}:${opts.help ? 'help' : 'approach'}:${raiders}`, () => buildScene(seed, { help: opts.help, c: withRaiders(raiders) }));
  return { sim, freighter: freighterOf(sim) };
}

describe('distress freighter: signal', () => {
  it('rolls a helpless freighter with a failing reactor and a clock; no raiders at the start tier', () => {
    const sim = signalled(3, content);
    const s = sim.galaxy.signal!;
    expect(s.ships).toHaveLength(1); // danger 0: raiders only deeper
    expect(s.ships[0]).toMatchObject({ tag: 'freighter', stance: 'helpless' });
    expect(s.ships[0]?.damage?.find((d) => d.failing)?.def).toBe('module.reactor');
    expect(s.timers[0]).toMatchObject({ id: 'reactor', ship: 'freighter', stopOn: 'repaired', due: 'wreck' });
    expect(s.timers[0]!.afterSec).toBeGreaterThanOrEqual(150);
  });

  it('opens already connected, so help can be offered from the start and is agreed before dropping out', () => {
    const sim = signalled(3, content);
    expect(sim.story.active?.done ?? []).toEqual([]); // nothing stored: a comms call is answered by definition
    expect(remotesDone(content.events['event.distress_call'], sim.story.active ?? {})).toContain('hail');
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
    run(sim, 10 * 20); // (a minute in freighter.slow)
    expect(sim.world.get(freighter, ShipC)?.state).not.toBe('fled');
    expect(sim.world.get(s.failing![0]!, ModuleC)!.hp).toBe(m.hp); // its own crew cannot mend it
  });

  it('its crew cannot repair (a work block, reason scene); anyone else aboard can take the repair', () => {
    const { sim, freighter } = inScene(3);
    const own = sim.world.query(CrewC, PositionC).filter((c) => shipIdOf(sim, sim.world.get(c, PositionC)!) === freighter);
    expect(own.length).toBeGreaterThan(0);
    for (const c of own) expect(sim.world.get(c, WorkBlockC)?.blocked).toEqual([{ category: 'repair', why: 'scene' }]);
    const reactor = spec(sim).failing![0]!;
    const job = sim.world.query(JobC).map((j) => sim.world.get(j, JobC)!).find((j) => j.kind === 'repair' && j.target === reactor)!;
    expect(job).toBeDefined();
    const at = sim.world.get(own[0]!, PositionC)!;
    expect(jobFits(sim, own[0]!, at, job)).toBe(false);
    const ours = playerCrewIds(sim)[0]!;
    standOn(sim, freighter, ours);
    expect(jobFits(sim, ours, sim.world.get(ours, PositionC)!, job)).toBe(true);
  });

  it('breaks out fires as the clock runs down, then blows: a wreck, everyone aboard gone, the rules fire', () => {
    const { sim, freighter } = inScene(4);
    const t = timer(sim);
    t.at = sim.tick + (t.fires!.leadSec + 4) * 20; // the branch starts near its moment: the natural wait is covered end to end below
    const leadAt = (t.at as number) - (t.fires!.leadSec * 20);
    run(sim, Math.max(0, leadAt - sim.tick) - 20);
    expect(firesOn(sim, freighter)).toBe(0);
    run(sim, 3 * 20);
    expect(firesOn(sim, freighter)).toBeGreaterThan(0);
    expect(t.fired).toBe(1);
    run(sim, (t.at as number) - sim.tick + 3 * 20);
    expect(t.blown).toBe(true);
    expect(sim.world.get(freighter, ShipC)?.state).toBe('wreck');
    expect(fired(sim)).toEqual(expect.arrayContaining(['reactorBlew', 'destroyed']));
  }, 60000);

  it('the clock starts when the player deploys, not while the deploy spot is picked', () => {
    const sim = signalled(4, withRaiders('none'));
    choose(sim, 'approach');
    run(sim, 200); // picking a spot
    expect(sim.sector.state).toBe('deploying');
    expect(timer(sim).at).toBeUndefined();
    deploy(sim);
    const deployed = sim.tick;
    run(sim, 21);
    expect(timer(sim).at).toBeGreaterThanOrEqual(deployed + timer(sim).afterSec * 20);
    expect(timer(sim).at).toBeLessThanOrEqual(deployed + timer(sim).afterSec * 20 + 21);
  }, 60000);

  it('the reactor blows: a blast at it (event, breach, fire), the ship goes dark and wrecks; a guest far off lives, its own crew do not', () => {
    const { sim, freighter } = inScene(4, { help: true });
    run(sim, 21);
    const site = sim.world.get(freighter, AwaySiteC)!;
    const guest = playerCrewIds(sim)[0] as number;
    sim.world.add(guest, AwayC, { site: freighter, vehicle: site.vehicle, cat: 'repair' });
    standOn(sim, freighter, guest);
    const own = sim.world.query(CrewC, PositionC).filter((c) => shipIdOf(sim, sim.world.get(c, PositionC)!) === freighter && c !== guest);
    const reactor = sim.world.get(spec(sim).failing![0]!, ModuleC)!;
    const far = Math.max(Math.abs(sim.world.get(guest, PositionC)!.x - reactor.x), Math.abs(sim.world.get(guest, PositionC)!.y - reactor.y));
    expect(far).toBeGreaterThan(7); // out of the blast's reach
    const g = shipGrid(sim, freighter)!;
    const space0 = countSpace(sim, freighter);
    timer(sim).at = sim.tick + 1;
    const out = run(sim, 21);
    const blast = out.find((e) => e.type === 'ship.blast') as { x: number; y: number; radius: number } | undefined;
    expect(blast).toBeDefined();
    expect(blast!.radius).toBe(6);
    expect(sim.world.get(freighter, ShipC)?.state).toBe('wreck');
    expect(countSpace(sim, freighter)).toBeGreaterThan(space0); // the hull is breached
    expect(firesOn(sim, freighter)).toBeGreaterThan(0);
    expect(g).toBeDefined();
    expect(sim.world.has(guest, DeadC)).toBe(false); // the wreck does not take the guest
    expect(own.every((c) => !sim.world.has(c, CrewC) || sim.world.has(c, DeadC))).toBe(true);
  }, 60000);

  it('repairing the failing reactor in time stops the clock', () => {
    const { sim, freighter } = inScene(4);
    const s = spec(sim);
    const m = sim.world.get(s.failing![0]!, ModuleC)!;
    m.hp = 200;
    timer(sim).at = sim.tick + 100;
    const out = run(sim, 21);
    expect(timer(sim).stopped).toBe(true);
    expect(out.some((e) => e.type === 'scene.observed' && e.rule === 'reactorStopped')).toBe(true);
    run(sim, (timer(sim).at as number) - sim.tick + 40);
    expect(sim.world.get(freighter, ShipC)?.state).not.toBe('wreck');
    expect(fired(sim)).not.toContain('reactorBlew');
  }, 60000);

  it('a freighter wrecked some other way before the deadline stops its clock: no reactor blast reported', () => {
    const { sim, freighter } = inScene(4);
    sim.world.get(freighter, ShipC)!.state = 'wreck'; // raiders got it first
    timer(sim).at = sim.tick + 100;
    run(sim, 21);
    expect(timer(sim).stopped).toBe(true);
    run(sim, (timer(sim).at as number) - sim.tick + 40);
    expect(timer(sim).blown).toBeUndefined();
    expect(fired(sim)).not.toContain('reactorBlew');
  }, 60000);
});

describe('distress freighter: aid by hail', () => {
  it('the agreed party goes aboard as guests: no provocation, no boarding rule', () => {
    const { sim, freighter } = inScene(3, { help: true });
    run(sim, 21);
    const site = sim.world.get(freighter, AwaySiteC);
    expect(site).toMatchObject({ owner: 'aid', status: 'open', noLoot: true });
    expect(spec(sim).aid).toMatchObject({ state: 'agreed', sent: true });
    // A party member landed aboard (as the site's run would put them).
    const crew = playerCrewIds(sim)[0] as number;
    sim.world.add(crew, AwayC, { site: freighter, vehicle: site!.vehicle, cat: 'repair' });
    standOn(sim, freighter, crew);
    run(sim, 41);
    expect(sim.world.get(freighter, ShipC)).toMatchObject({ faction: 'neutral' });
    expect(sim.world.get(freighter, ShipC)?.provoked).toBeUndefined();
    expect(fired(sim)).not.toContain('boarded');
  });

  // Seeds 6, 8 and 9 put the reactor in a room hotter than HOT_ABOVE once it runs again: the party suits up for it (eva/suit.ts `suitNeeded`).
  // Not seed 5: its party mends the reactor in the clock's last seconds, so a fire wave beside it can tip it either way.
  it.each([3, 6])('end to end (seed %i): the party flies over, mends the reactor before the clock runs out, and comes home', (seed) => {
    // Seed 3 is the one full run on the production pipeline, from the signal; the others start from the cached scene (seeds 8 and 9 in freighter.slow).
    const sim = seed === 3 ? buildScene(3, { help: true, c: withRaiders('none') }) : inScene(seed, { help: true }).sim;
    expectPartyMends(sim);
  }, 120000);

  it('the leave is a consent grant: void once the host is at war with the guests, gone with the site', () => {
    const { sim, freighter } = inScene(3, { help: true });
    run(sim, 21);
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
    run(sim, 21);
    expect(sim.world.has(freighter, ConsentC)).toBe(false);
  });

  it('uninvited boarding still provokes, and calls off help agreed', () => {
    const { sim, freighter } = inScene(3, { help: true });
    run(sim, 21);
    const crew = playerCrewIds(sim).find((c) => !sim.world.has(c, AwayC)) as number;
    standOn(sim, freighter, crew);
    const out = run(sim, 41);
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
    const out = run(sim, 21);
    expect(out).toContainEqual({ type: 'scene.aid', ship: freighter, state: 'agreed' });
    expect(sim.world.get(freighter, AwaySiteC)?.owner).toBe('aid');
    const fuel = playerStock(sim, 'item.fuel');
    for (const id of spec(sim).damaged!) sim.world.get(id, ModuleC)!.hp = sim.content.modules[sim.world.get(id, ModuleC)!.def]!.maxHp;
    const after = run(sim, 41);
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
    expect(run(sim, 1)).toContainEqual({ type: 'command.rejected', command: 'galaxy.aid', reason: 'done' });
  });

  it('leaving with the help under way: abandoned (standing lost) and doomed (its own clock)', () => {
    const { sim, freighter } = inScene(3);
    spec(sim).aid = { state: 'agreed', sent: true }; // agreed, the party not out
    const before = sim.story.reputation['traders'] ?? 0;
    sim.enqueue({ type: 'galaxy.leaveEvent' });
    const out = run(sim, 1).filter((e) => e.type === 'scene.observed').map((e) => (e as { rule: string }).rule);
    expect(out).toEqual(expect.arrayContaining(['abandoned', 'doomed']));
    expect(sim.story.reputation['traders']).toBe(before - 1);
    expect(sim.story.flags['aid_abandoned']).toBe(1);
    expect(freighter).toBeGreaterThan(0);
  });

  it('saves and loads mid-aid', () => {
    const { sim } = inScene(4, { help: true });
    run(sim, 61);
    const copy = deserialize(serialize(sim), sim.content);
    run(sim, 60);
    run(copy, 60);
    expect(serialize(copy)).toEqual(serialize(sim));
  });
});

describe('distress freighter: raiders', () => {
  it('already circling: hostile at open, guns on the freighter', () => {
    const { sim, freighter } = inScene(3, { raiders: 'here' });
    const r = sim.galaxy.event!.scene.ships.find((x) => x.tag === 'raider')!;
    expect(r.contact.ship).toBeDefined();
    expect(sim.world.get(r.contact.ship!, ShipC)?.faction).toBe('hostile');
    expect(sim.world.get(r.contact.ship!, CombatC)?.prey).toBe(freighter);
    run(sim, 10 * 20);
    expect(sim.world.get(r.contact.ship!, CombatC)?.target?.ship).toBe(freighter);
  }, 60000);

  it('target choice: a threat beats the prey (the player firing on a raider turns it), and the prey beats an idle foe again once the player stops', () => {
    const { sim, freighter } = inScene(3, { raiders: 'here' });
    const r = sim.galaxy.event!.scene.ships.find((x) => x.tag === 'raider')!.contact.ship!;
    const me = playerShip(sim);
    run(sim, 5 * 20);
    expect(sim.world.get(r, CombatC)?.target?.ship).toBe(freighter); // prey over the player, who has not fired
    const mod = sim.world.query(ModuleC).find((m) => shipIdOf(sim, sim.world.get(m, ModuleC)!) === r)!;
    sim.enqueue({ type: 'combat.setTarget', ship: me, weaponId: null, targetShip: r, targetModuleId: mod });
    for (let i = 0; i < 40 * 20 && sim.world.get(r, CombatC)?.threat === undefined; i++) run(sim, 1);
    expect(sim.world.get(r, CombatC)?.threat?.ship).toBe(me); // firing.ts: who fired on it
    run(sim, 3 * 20);
    expect(sim.world.get(r, CombatC)?.target?.ship).toBe(me);
    expect(sim.world.get(r, CombatC)?.prey).toBe(freighter); // the prey is kept, ranked below the threat
    sim.enqueue({ type: 'combat.setTarget', ship: me, weaponId: null, targetShip: 0, targetModuleId: 0 });
    for (const id of sim.world.query(ModuleC)) {
      const w = sim.world.get(id, WeaponC);
      if (w && shipIdOf(sim, sim.world.get(id, ModuleC)!) === me) w.target = null;
    }
    run(sim, 20 * 20);
    expect(sim.world.get(r, CombatC)?.target?.ship).toBe(freighter);
  }, 60000);

  it('coming on a clock: not there at open, jumps in when it is due', () => {
    const { sim, freighter } = inScene(3, { raiders: 'coming' });
    const r = sim.galaxy.event!.scene.ships.find((x) => x.tag === 'raider')!;
    expect(r.arriveAfter).toBeGreaterThanOrEqual(60);
    expect(r.contact.ship).toBeUndefined();
    r.arriveAt = sim.tick + 100; // near its moment (the clock itself is covered by the deploy-start test below)
    run(sim, (r.arriveAt as number) - sim.tick - 40);
    expect(r.contact.ship).toBeUndefined();
    run(sim, 80);
    expect(r.contact.ship).toBeDefined();
    expect(sim.world.get(r.contact.ship!, CombatC)?.prey).toBe(freighter);
  }, 60000);

  it('the arrival clock starts at deploy: time spent picking the deploy spot does not bring the raiders in sooner', () => {
    const sim = signalled(3, withRaiders('coming'));
    choose(sim, 'approach');
    const r = sim.galaxy.event!.scene.ships.find((x) => x.tag === 'raider')!;
    run(sim, 120 * 20); // two minutes on the deploy screen, longer than any arrival delay
    expect(sim.sector.state).not.toBe('active');
    expect(r.arriveAt).toBeUndefined();
    deploy(sim);
    for (let i = 0; i < 40 && r.arriveAt === undefined; i++) run(sim, 1);
    expect(r.arriveAt).toBeGreaterThanOrEqual(sim.tick + (r.arriveAfter as number) * 20 - 40);
    expect(r.contact.ship).toBeUndefined();
  }, 60000);
});
