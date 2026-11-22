import { describe, expect, it } from 'vitest';
import { IonC, ProjectileC, ShipC, WeaponC } from '../../sim/combat/components';
import { aimDirection, turretPosition } from '../../sim/combat/geometry';
import { shipById } from '../../sim/combat/shipQuery';
import { CrewC, JobC, PositionC } from '../../sim/crew/components';
import type { SimEvent } from '../../sim/events';
import { ModuleC } from '../../sim/modules/components';
import { newGame } from '../../sim/newGame';
import type { ShipTemplate } from '../../sim/registry';
import { shipGrid, shipIdOf, shipIds } from '../../sim/regions';
import { SkillXpC } from '../../sim/story/components';
import { content } from '../index';
import {
  aim, arsonSim, combatOf, countAmmo, duel, dummy, dummyNoShield, fightSim, gunShip, modulesOf, registry, withMissiles, withTargets,
} from '../../../test/support/fixtures/combat';
import { eventsOf as ofType, nth, run } from '../../../test/support/sim';
import { expectReplayable } from '../../../test/support/world';

describe('combat start and consoles', () => {
  it('starts combat and crew man their consoles by skill', () => {
    const sim = newGame(1, content);
    sim.enqueue({ type: 'debug.spawnEnemy', template: 'ship.raider', x: 100, y: 50 });
    const events = run(sim, 400);
    expect(ofType(events, 'combat.started')).toHaveLength(1);
    expect(sim.sector.inCombat).toBe(true);
    const manned = (shipId: number, def: string): string | undefined => {
      const [m] = modulesOf(sim, shipId, def) as [number];
      const job = sim.world.query(JobC).map((j) => sim.world.get(j, JobC)!).find((j) => j.kind === 'operate' && j.target === m);
      return job && job.reservedBy ? sim.world.get(job.reservedBy, CrewC)!.role : undefined;
    };
    expect(manned(1, 'module.weaponsConsole')).toBe('role.gunner');
    expect(manned(1, 'module.helm')).toBe('role.pilot');
    expect(manned(1, 'module.shieldConsole')).toBeUndefined(); // engineers and the medic do not volunteer
    expect(manned(2, 'module.weaponsConsole')).toBe('role.gunner');
    expect(manned(2, 'module.helm')).toBe('role.pilot');
    expect(sim.world.query(ShipC)).toHaveLength(2);
    expect(shipById(sim, shipIds(sim)[1] as number)?.state).toBe('active');
  });

  it('weapons do not charge without an operator, and charge and fire with one', () => {
    const none = duel('module.burstLaser', dummyNoShield, { crew: [] });
    aim(none, 1, 2);
    const e1 = run(none, 800);
    const [laser] = modulesOf(none, 1, 'module.burstLaser') as [number];
    expect(none.world.get(laser, WeaponC)!.charge).toBe(0);
    expect(ofType(e1, 'weapon.fired')).toHaveLength(0);

    const manned = duel('module.burstLaser', dummyNoShield);
    aim(manned, 1, 2);
    const e2 = run(manned, 800);
    expect(ofType(e2, 'weapon.fired').length).toBeGreaterThanOrEqual(3);
    expect(ofType(e2, 'projectile.hit').length + ofType(e2, 'projectile.miss').length).toBeGreaterThan(0);
  });

  it('hold fire keeps weapons charged until combat.fireVolley', () => {
    const sim = duel('module.burstLaser', dummyNoShield);
    aim(sim, 1, 2);
    sim.enqueue({ type: 'combat.setHold', ship: nth(sim, 1), hold: true });
    expect(ofType(run(sim, 600), 'weapon.fired')).toHaveLength(0);
    const [laser] = modulesOf(sim, 1, 'module.burstLaser') as [number];
    expect(sim.world.get(laser, WeaponC)!.charge).toBe(1);
    sim.enqueue({ type: 'combat.fireVolley', ship: nth(sim, 1) });
    expect(ofType(run(sim, 25), 'weapon.fired')).toHaveLength(3); // 40 ticks at the old 8 s laser charge, the same share of the 5 s charge
    expect(sim.world.get(laser, WeaponC)!.charge).toBeLessThan(0.4);
  });
});

describe('turrets', () => {
  it('aim at the target in 8 directions and shots start at the turret', () => {
    const sim = duel('module.burstLaser', dummyNoShield);
    const [laser] = modulesOf(sim, 1, 'module.burstLaser') as [number];
    const [target] = modulesOf(sim, 2, 'module.reactor') as [number];
    aim(sim, 1, 2, target);
    run(sim, 2);
    const from = turretPosition(sim, laser)!;
    const to = turretPosition(sim, target)!;
    const aimNow = sim.world.get(laser, WeaponC)!.aim;
    expect(aimNow).toBe(aimDirection(to.x - from.x, to.y - from.y));
    expect(aimNow).toBe(0); // the enemy lies far to the east and a little south
    let fired: SimEvent | undefined;
    for (let i = 0; i < 20 * 20 && !fired; i++) {
      sim.step();
      fired = sim.events.drain().find((e) => e.type === 'weapon.fired');
    }
    expect(fired?.type).toBe('weapon.fired');
    const p = sim.world.get((fired as Extract<SimEvent, { type: 'weapon.fired' }>).projectile, ProjectileC)!;
    expect([p.x0, p.y0]).toEqual([from.x, from.y]);
  });

  it('quantises directions clockwise from +x', () => {
    expect([[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]].map(([x, y]) => aimDirection(x!, y!)))
      .toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });
});

describe('weapons', () => {
  it('burst laser strips shield layers, then shields recharge', () => {
    const sim = duel('module.burstLaser', dummy);
    aim(sim, 1, 2);
    // Run until the layers are down (a crew member levelling gunnery mid-run moves the volley, so no fixed tick count).
    const events: SimEvent[] = [];
    for (let t = 0; t < 1200 && !(events.some((e) => e.type === 'projectile.shieldHit') && combatOf(sim, 2).shield.layers === 0); t += 10) events.push(...run(sim, 10));
    expect(ofType(events, 'projectile.shieldHit').length).toBeGreaterThanOrEqual(1);
    expect(combatOf(sim, 2).shield.layers).toBe(0);
    // Recharge: one layer after rechargeSec (10 s, about 7 s with SHIELD_REGEN_MULT) without further volleys (hold fire).
    sim.enqueue({ type: 'combat.setHold', ship: nth(sim, 1), hold: true });
    run(sim, 2);
    const weapon = modulesOf(sim, 1, 'module.burstLaser')[0] as number;
    sim.world.get(weapon, WeaponC)!.charge = 0;
    sim.world.get(weapon, WeaponC)!.shotsLeft = 0;
    run(sim, 20 * 11);
    expect(combatOf(sim, 2).shield.layers).toBe(1);
  });

  it('a shield that is up drops to no layers within a tick or two when its ship loses power', () => {
    const sim = duel('module.burstLaser', dummy);
    for (let t = 0; t < 20 * 60 && combatOf(sim, 2).shield.layers === 0; t += 10) run(sim, 10); // the emitter dish deploys first
    expect(combatOf(sim, 2).shield.max).toBeGreaterThan(0);
    expect(combatOf(sim, 2).shield.layers).toBeGreaterThan(0);
    const reactors = modulesOf(sim, 2, 'module.reactor');
    expect(reactors.length).toBeGreaterThan(0);
    for (const id of reactors) sim.enqueue({ type: 'module.setEnabled', id, enabled: false });
    run(sim, 2);
    expect(modulesOf(sim, 2, 'module.shieldGen').every((id) => !sim.world.get(id, ModuleC)!.powered)).toBe(true);
    expect(combatOf(sim, 2).shield.max).toBe(0);
    expect(combatOf(sim, 2).shield.layers).toBe(0);
  });

  it('mass driver breaches the hull and the room vents', () => {
    const wallTarget: ShipTemplate = {
      name: 'Wall', crew: [], faction: 'hostile',
      rows: ['##############', '#____________#', '#____________#', '#____________#', '#____________#', '#____________#', '##############'],
      modules: [{ def: 'module.storage', x: 12, y: 3, rot: 2 }],
    };
    const sim = duel('module.massDriver', wallTarget);
    aim(sim, 1, 2, modulesOf(sim, 2, 'module.storage')[0] as number);
    const meanO2 = (): number => {
      const g = shipGrid(sim, shipIds(sim)[1] as number)!;
      let sum = 0;
      let n = 0;
      for (let y = 1; y <= 5; y++) for (let x = 1; x <= 12; x++) { sum += g.get('o2', g.x0 + x, g.y0 + y); n++; }
      return sum / n;
    };
    run(sim, 20);
    expect(meanO2()).toBeGreaterThan(18);
    const events = run(sim, 20 * 120);
    expect(ofType(events, 'projectile.hit').length).toBeGreaterThan(0);
    expect(ofType(events, 'hull.breach').length).toBeGreaterThan(0);
    expect(meanO2()).toBeLessThan(8);
  });

  it('mass driver passes one shield layer, laser does not', () => {
    const sim = duel('module.massDriver', dummy);
    aim(sim, 1, 2);
    // The first slug only: shields now regenerate fast enough (SHIELD_REGEN_MULT) for a second layer to be up before the next one lands.
    const events = run(sim, 20 * 18);
    expect(ofType(events, 'projectile.shieldHit')).toHaveLength(0);
    expect(ofType(events, 'projectile.hit').length + ofType(events, 'projectile.miss').length).toBeGreaterThan(0);
  });

  it('missile bypasses shields and consumes ammo', () => {
    const sim = duel('module.missileLauncher', dummy, { extra: [withMissiles] });
    aim(sim, 1, 2);
    const crate = modulesOf(sim, 1, 'module.storage')[0] as number;
    const stock = (): number => countAmmo(sim, crate);
    expect(stock()).toBe(20);
    // Ammo weapons start on hold: they charge but nothing leaves without a volley.
    expect(sim.world.get(modulesOf(sim, 1, 'module.missileLauncher')[0] as number, WeaponC)!.mode).toBe('hold');
    expect(ofType(run(sim, 20 * 15), 'weapon.fired')).toHaveLength(0);
    expect(stock()).toBe(20);
    const events: SimEvent[] = [];
    for (let i = 0; i < 30; i++) {
      sim.enqueue({ type: 'combat.fireVolley', ship: nth(sim, 1) });
      events.push(...run(sim, 20));
    }
    const fired = ofType(events, 'weapon.fired').length;
    expect(fired).toBeGreaterThanOrEqual(2);
    expect(stock()).toBe(20 - fired);
    expect(ofType(events, 'projectile.shieldHit')).toHaveLength(0);
    expect(ofType(events, 'projectile.hit').length + ofType(events, 'projectile.miss').length).toBeGreaterThan(0);
  });

  it('a missile launcher without ammo never charges', () => {
    const sim = duel('module.missileLauncher', dummyNoShield);
    aim(sim, 1, 2);
    expect(ofType(run(sim, 600), 'weapon.fired')).toHaveLength(0);
  });

  it('ion cannon drains a shield layer, or disables the module it hits', () => {
    const shielded = duel('module.ionCannon', dummy);
    aim(shielded, 1, 2);
    const ev = run(shielded, 20 * 25);
    expect(ofType(ev, 'projectile.shieldHit').length).toBeGreaterThanOrEqual(1);
    expect(shielded.world.query(IonC)).toHaveLength(0);

    // Hit the reactor: ion-disabled, it supplies nothing and the ship goes dark until the timer ends.
    const sim = duel('module.ionCannon', dummyNoShield);
    const reactor = modulesOf(sim, 2, 'module.reactor')[0] as number;
    aim(sim, 1, 2, reactor);
    let sawIon = false;
    let unpoweredWhileIon = false;
    for (let i = 0; i < 20 * 40 && !unpoweredWhileIon; i++) {
      sim.step();
      if (sim.world.has(reactor, IonC)) {
        sawIon = true;
        unpoweredWhileIon = !sim.world.get(reactor, ModuleC)!.powered;
      }
    }
    expect(sawIon).toBe(true);
    expect(unpoweredWhileIon).toBe(true);
    sim.enqueue({ type: 'module.setEnabled', id: modulesOf(sim, 1, 'module.ionCannon')[0] as number, enabled: false });
    run(sim, 20 * 12);
    expect(sim.world.has(reactor, IonC)).toBe(false);
    expect(sim.world.get(reactor, ModuleC)!.powered).toBe(true);
  });

  it('incendiary starts a fire that crew extinguish', () => {
    const sim = arsonSim();
    // Up to a minute, ending once a crew member has put a fire out (the run on to the last fire is in combat.slow.test.ts).
    const events: SimEvent[] = [];
    for (let i = 0; i < 60 && !events.some((e) => e.type === 'crew.jobDone' && e.kind === 'extinguish'); i++) events.push(...run(sim, 20));
    expect(ofType(events, 'fire.started').length).toBeGreaterThan(0);
    expect(events.some((e) => e.type === 'crew.jobDone' && e.kind === 'extinguish')).toBe(true);
  });
});

describe('evasion, point defence, shields', () => {
  it('evasion needs a pilot and engines', () => {
    const piloted = newGame(1, content);
    piloted.enqueue({ type: 'debug.spawnEnemy', template: 'ship.raider', x: 100, y: 50 });
    run(piloted, 400);
    expect(combatOf(piloted, 1).evasion).toBeGreaterThan(0.25);

    const unpiloted = newGame(1, content);
    unpiloted.enqueue({ type: 'debug.spawnEnemy', template: 'ship.raider', x: 100, y: 50 });
    for (const id of unpiloted.world.query(CrewC)) {
      // nobody may fly it: crew with a low operating priority relieve an empty helm after a while
      unpiloted.enqueue({ type: 'crew.setPriority', id, category: 'operating', value: 0 });
    }
    run(unpiloted, 400);
    expect(combatOf(unpiloted, 1).evasion).toBe(0);
    expect(combatOf(unpiloted, 1).ftl).toBe(0);

    const noEngines = newGame(1, content);
    noEngines.enqueue({ type: 'debug.spawnEnemy', template: 'ship.raider', x: 100, y: 50 });
    for (const e of modulesOf(noEngines, 1, 'module.engine')) noEngines.enqueue({ type: 'module.setEnabled', id: e, enabled: false });
    run(noEngines, 400);
    expect(combatOf(noEngines, 1).evasion).toBe(0);
  });

  it('an operator at the shield console recharges faster', () => {
    const layersAfter = (operated: boolean): number => {
      const sim = newGame(1, registry({ 'ship.dummy': dummy }));
      sim.enqueue({ type: 'debug.spawnEnemy', template: 'ship.dummy', x: 100, y: 50 });
      if (operated) {
        for (const id of sim.world.query(CrewC)) {
          if (sim.world.get(id, CrewC)!.role === 'role.engineer') sim.enqueue({ type: 'crew.setPriority', id, category: 'operating', value: 1 });
        }
      }
      run(sim, 400);
      combatOf(sim, 1).shield.layers = 0;
      combatOf(sim, 1).shield.timer = 0;
      run(sim, 20 * 11); // a layer per 10 s / SHIELD_REGEN_MULT unmanned, a bit under 7 s with an operator
      return combatOf(sim, 1).shield.layers;
    };
    expect(layersAfter(false)).toBe(1);
    expect(layersAfter(true)).toBe(2);
  });

  it('shields are down out of combat (stowed dishes) and up once combat or battle stations deploy them', () => {
    const sim = newGame(1, registry({ 'ship.dummy': dummy }));
    expect(combatOf(sim, 1).shield.layers).toBe(0); // from the first frame, before any tick
    run(sim, 400);
    expect(sim.sector.inCombat).toBe(false);
    expect(combatOf(sim, 1).shield).toMatchObject({ layers: 0, max: 0 });
    sim.enqueue({ type: 'combat.battleStations', on: true });
    run(sim, 20 * 30);
    expect(combatOf(sim, 1).shield.layers).toBeGreaterThan(0);
    sim.enqueue({ type: 'combat.battleStations', on: false });
    run(sim, 20 * 30);
    expect(combatOf(sim, 1).shield.max).toBe(0);
  });

  it('point defence intercepts some missiles', () => {
    const reg = registry({ 'ship.gun': gunShip('module.missileLauncher', ['role.gunner'], [withMissiles], 'hostile') });
    const sim = newGame(1, reg);
    sim.enqueue({ type: 'debug.spawnEnemy', template: 'ship.gun', x: 100, y: 50 });
    const fab = modulesOf(sim, 1, 'module.fabricator')[0] as number;
    aim(sim, 2, 1, fab);
    // Until the first interception (the two minutes and the share of missiles that get through are in combat.slow.test.ts).
    const events: SimEvent[] = [];
    for (let i = 0; i < 120 && !events.some((e) => e.type === 'projectile.intercepted'); i++) events.push(...run(sim, 20));
    expect(ofType(events, 'weapon.fired').length).toBeGreaterThanOrEqual(1);
    expect(ofType(events, 'projectile.intercepted').length).toBeGreaterThan(0);
  });
});

describe('enemy AI, endings', () => {
  it('the raider destroys an unprotected ship in a long run', () => {
    const victim = gunShip('module.burstLaser', ['role.gunner']);
    const reg = registry({ 'ship.victim': victim });
    const sim = newGame(3, reg, 'ship.victim');
    sim.enqueue({ type: 'debug.spawnEnemy', template: 'ship.raider', x: 100, y: 50 });
    // Up to 400 s; once the victim is a wreck and the fight has ended, a minute more shows that nothing repeats (a second combat.ended, a second kill).
    const events: SimEvent[] = [];
    for (let i = 0; i < 400 && !(shipById(sim, shipIds(sim)[0] as number)?.state === 'wreck' && !sim.sector.inCombat); i++) events.push(...run(sim, 20));
    events.push(...run(sim, 20 * 60));
    expect(shipById(sim, shipIds(sim)[0] as number)?.state).toBe('wreck');
    expect(ofType(events, 'ship.destroyed').map((e) => e.ship)).toEqual([nth(sim, 1)]);
    expect(ofType(events, 'module.destroyed').length).toBeGreaterThan(0);
    expect(ofType(events, 'combat.ended')).toHaveLength(1);
    for (const id of sim.world.query(CrewC)) {
      if (shipIdOf(sim, sim.world.get(id, PositionC)) === shipIds(sim)[0] as number) expect(sim.world.get(id, CrewC)!.activity).toBe('dead');
    }
    expect(shipGrid(sim, shipIds(sim)[0] as number)).toBeDefined();
  });

  it('the player flees by jumping: it needs a charged FTL drive and leaves the fight', () => {
    const sim = newGame(1, content);
    sim.enqueue({ type: 'debug.spawnEnemy', template: 'ship.raider', x: 100, y: 50 });
    sim.enqueue({ type: 'combat.flee', ship: nth(sim, 1) });
    const early = run(sim, 2);
    expect(early.some((e) => e.type === 'command.rejected' && e.reason === 'notCharged')).toBe(true);
    expect(sim.sector.state).toBe('active');
    run(sim, 20 * 25);
    expect(combatOf(sim, 1).ftl).toBeGreaterThan(5);
    combatOf(sim, 1).ftl = 40;
    sim.enqueue({ type: 'combat.flee', ship: nth(sim, 1) });
    const events = run(sim, 40);
    // The same lift and archive as `galaxy.jump`, but adrift: no route yet, and no fuel burned. Dropping goes back to the node fled from.
    const entered = ofType(events, 'galaxy.hyperspace');
    expect(entered).toHaveLength(1);
    const from = entered[0]!.route[0]!;
    expect(entered[0]!.route).toHaveLength(1);
    expect(ofType(events, 'ship.fled')).toEqual([]);
    expect(sim.sector).toMatchObject({ state: 'hyperspace', inCombat: false });
    expect(sim.galaxy.travel).toMatchObject({ phase: 'adrift' });
    expect(sim.archives.map((a) => a.node)).toEqual([from]);
    sim.enqueue({ type: 'galaxy.drop' });
    run(sim, 1);
    expect(sim.sector).toMatchObject({ state: 'deploying', node: from });
    sim.enqueue({ type: 'sector.deploy', x: 100, y: 60 });
    run(sim, 1);
    expect(combatOf(sim, 1).ftl).toBeLessThan(40);
  });

  it('a badly damaged raider with a charged drive retreats', () => {
    const sim = newGame(1, content);
    sim.enqueue({ type: 'debug.spawnEnemy', template: 'ship.raider', x: 100, y: 50 });
    run(sim, 400);
    for (const id of sim.world.query(ModuleC)) {
      const m = sim.world.get(id, ModuleC)!;
      if (shipIdOf(sim, m) === shipIds(sim)[1] as number) m.hp = m.def === 'module.reactor' ? 100 : m.def === 'module.vehicle_bay' ? 60 : 0; // bay hp tuned so integrity stays between wreck and flee
    }
    const g2 = shipGrid(sim, shipIds(sim)[1] as number)!;
    for (let y = g2.y0; y < g2.y0 + g2.height; y++) for (let x = g2.x0; x < g2.x0 + g2.width; x++) if (g2.get('struct', x, y) === 2) g2.set('hp', x, y, 80); // walls at about a third
    combatOf(sim, 2).ftl = 40;
    const events = run(sim, 100);
    expect(ofType(events, 'ship.fled').map((e) => e.ship)).toEqual([nth(sim, 2)]);
  });
});

describe('determinism and saves', () => {
  it('a fight is replayable, and a save taken with projectiles in flight reloads into the same fight', () => {
    const sim = withTargets(fightSim(5));
    for (let i = 0; i < 1000 && sim.world.query(ProjectileC).length === 0; i++) sim.step();
    expect(sim.world.query(ProjectileC).length).toBeGreaterThan(0);
    // The shorter run (the full ones are in combat.slow.test.ts): two builds step 400 ticks, one reloaded at tick 250, projectiles in flight from about tick 180.
    expectReplayable(() => withTargets(fightSim(5)), 400, { every: 100, saveAt: 250 });
  });
});

describe('skill XP at the consoles', () => {
  it('a gunner earns gunnery XP while a weapon charges at a manned console, and nobody does when it is unmanned', () => {
    const manned = duel('module.burstLaser', dummyNoShield);
    aim(manned, 1, 2);
    run(manned, 400);
    const gunner = manned.world.query(CrewC).find((i) => manned.world.get(i, CrewC)?.role === 'role.gunner') as number;
    const xp = manned.world.get(gunner, SkillXpC)?.xp.gunnery ?? 0;
    expect(xp).toBeGreaterThan(0);
    run(manned, 400);
    expect(manned.world.get(gunner, SkillXpC)?.xp.gunnery ?? 0).toBeGreaterThan(xp);
    expect(manned.world.get(gunner, SkillXpC)?.xp.shielding ?? 0).toBe(0);

    const empty = duel('module.burstLaser', dummyNoShield, { crew: [] });
    aim(empty, 1, 2);
    run(empty, 400);
    expect(empty.world.query(SkillXpC)).toHaveLength(0);
  });
});
