import { describe, expect, it } from 'vitest';
import {
  CombatC, CrewC, IonC, JobC, ModuleC, PositionC, ProjectileC, ShipC, StorageC, WeaponC, aimDirection, deserialize, newGame, turretPosition, serialize, shipEntityOf, shipOf,
  type ContentRegistry, type ShipTemplate, type Sim, type SimEvent,
} from '../../sim';
import { content } from '../index';

type Mod = NonNullable<ShipTemplate['modules']>[number];

/** A 14x9 test hull: reactor, weapons console (chair at (7, 2)), one weapon bay, a clear lane, optional extras. */
function gunShip(weapon: string, crew: string[], extra: Mod[] = [], faction?: 'hostile'): ShipTemplate {
  return {
    name: 'Gun', crew, ...(faction ? { faction } : {}),
    rows: [
      '##############', '#____________#', '#____________#', '#____________#', '#____________#', '#____________#',
      '#____________#', '#____________#', '##############',
    ],
    modules: [
      { def: 'module.reactor', x: 1, y: 1, rot: 0 },
      { def: 'module.weaponsConsole', x: 6, y: 1, rot: 0 },
      { def: weapon, x: 9, y: 1, rot: 0 },
      ...extra,
    ],
  };
}
/** The raider with no crew: a passive target that still has power, shields and walls. */
const dummy: ShipTemplate = { ...content.ships['ship.raider'], crew: [] };
const dummyNoShield: ShipTemplate = {
  ...dummy, modules: dummy.modules!.filter((m) => m.def !== 'module.shieldGenSmall'),
};
const withMissiles: Mod = { def: 'module.storage', x: 5, y: 6, rot: 2, stock: [{ item: 'item.missile', count: 20 }] };

function registry(ships: Record<string, ShipTemplate>): ContentRegistry {
  return { ...content, ships: { ...content.ships, ...ships } };
}
const run = (sim: Sim, n: number): SimEvent[] => {
  const out: SimEvent[] = [];
  for (let i = 0; i < n; i++) {
    sim.step();
    out.push(...sim.events.drain());
  }
  return out;
};
const ofType = <T extends SimEvent['type']>(events: SimEvent[], type: T): Extract<SimEvent, { type: T }>[] =>
  events.filter((e): e is Extract<SimEvent, { type: T }> => e.type === type);
const modulesOf = (sim: Sim, gridId: number, def: string): number[] =>
  sim.world.query(ModuleC).filter((i) => sim.world.get(i, ModuleC)!.gridId === gridId && sim.world.get(i, ModuleC)!.def === def);
const combatOf = (sim: Sim, gridId: number) => sim.world.get(shipEntityOf(sim, gridId), CombatC)!;
const aim = (sim: Sim, from: number, to: number, moduleId = 0): void =>
  sim.enqueue({ type: 'combat.setTarget', shipGridId: from, weaponId: null, targetGridId: to, targetModuleId: moduleId });

/** Player gun ship (grid 1) facing a hostile target template (grid 2). */
function duel(weapon: string, target: ShipTemplate, opts: { crew?: string[]; extra?: Mod[]; seed?: number } = {}): Sim {
  const reg = registry({ 'ship.gun': gunShip(weapon, opts.crew ?? ['role.gunner'], opts.extra), 'ship.target': target });
  const sim = newGame(opts.seed ?? 1, reg, 'ship.gun');
  sim.enqueue({ type: 'debug.spawnEnemy', template: 'ship.target', x: 100, y: 50 });
  sim.step(); // the enemy exists now, so tests can look up its module ids
  sim.events.drain();
  return sim;
}

describe('combat start and consoles', () => {
  it('starts combat and crew man their consoles by skill', () => {
    const sim = newGame(1, content);
    sim.enqueue({ type: 'debug.spawnEnemy', template: 'ship.raider', x: 100, y: 50 });
    const events = run(sim, 400);
    expect(ofType(events, 'combat.started')).toHaveLength(1);
    expect(sim.sector.inCombat).toBe(true);
    const manned = (gridId: number, def: string): string | undefined => {
      const [m] = modulesOf(sim, gridId, def) as [number];
      const job = sim.world.query(JobC).map((j) => sim.world.get(j, JobC)!).find((j) => j.kind === 'operate' && j.target === m);
      return job && job.reservedBy ? sim.world.get(job.reservedBy, CrewC)!.role : undefined;
    };
    expect(manned(1, 'module.weaponsConsole')).toBe('role.gunner');
    expect(manned(1, 'module.helm')).toBe('role.pilot');
    expect(manned(1, 'module.shieldConsole')).toBeUndefined(); // engineers and the medic do not volunteer
    expect(manned(2, 'module.weaponsConsole')).toBe('role.gunner');
    expect(manned(2, 'module.helm')).toBe('role.pilot');
    expect(sim.world.query(ShipC)).toHaveLength(2);
    expect(shipOf(sim, 2)?.state).toBe('active');
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
    sim.enqueue({ type: 'combat.setHold', gridId: 1, hold: true });
    expect(ofType(run(sim, 600), 'weapon.fired')).toHaveLength(0);
    const [laser] = modulesOf(sim, 1, 'module.burstLaser') as [number];
    expect(sim.world.get(laser, WeaponC)!.charge).toBe(1);
    sim.enqueue({ type: 'combat.fireVolley', gridId: 1 });
    expect(ofType(run(sim, 40), 'weapon.fired')).toHaveLength(3);
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
    const events = run(sim, 700);
    expect(ofType(events, 'projectile.shieldHit').length).toBeGreaterThanOrEqual(1);
    expect(combatOf(sim, 2).shield.layers).toBe(0);
    // Recharge: one layer after rechargeSec (12 s) without further volleys (hold fire).
    sim.enqueue({ type: 'combat.setHold', gridId: 1, hold: true });
    run(sim, 2);
    const weapon = modulesOf(sim, 1, 'module.burstLaser')[0] as number;
    sim.world.get(weapon, WeaponC)!.charge = 0;
    sim.world.get(weapon, WeaponC)!.shotsLeft = 0;
    run(sim, 20 * 13);
    expect(combatOf(sim, 2).shield.layers).toBe(1);
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
      const g = sim.grids.get(2)!;
      let sum = 0;
      let n = 0;
      for (let y = 1; y <= 5; y++) for (let x = 1; x <= 12; x++) { sum += g.get('o2', x, y); n++; }
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
    const events = run(sim, 20 * 25);
    expect(ofType(events, 'projectile.shieldHit')).toHaveLength(0);
    expect(ofType(events, 'projectile.hit').length + ofType(events, 'projectile.miss').length).toBeGreaterThan(0);
  });

  it('missile bypasses shields and consumes ammo', () => {
    const sim = duel('module.missileLauncher', dummy, { extra: [withMissiles] });
    aim(sim, 1, 2);
    const crate = modulesOf(sim, 1, 'module.storage')[0] as number;
    const stock = (): number => countAmmo(sim, crate);
    expect(stock()).toBe(20);
    const events = run(sim, 20 * 30);
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
    const reg = registry({ 'ship.arson': gunShip('module.incendiaryLauncher', ['role.gunner'], [], 'hostile') });
    const sim = newGame(1, reg);
    sim.enqueue({ type: 'debug.spawnEnemy', template: 'ship.arson', x: 100, y: 50 });
    const gen = modulesOf(sim, 1, 'module.shieldGen')[0] as number;
    sim.enqueue({ type: 'module.setEnabled', id: gen, enabled: false });
    const fab = modulesOf(sim, 1, 'module.fabricator')[0] as number;
    aim(sim, 2, 1, fab);
    const events = run(sim, 20 * 60);
    expect(ofType(events, 'fire.started').length).toBeGreaterThan(0);
    expect(events.some((e) => e.type === 'crew.jobDone' && e.kind === 'extinguish')).toBe(true);
    // Stop the arsonist and let the crew finish.
    sim.enqueue({ type: 'module.setEnabled', id: modulesOf(sim, 2, 'module.incendiaryLauncher')[0] as number, enabled: false });
    run(sim, 20 * 60);
    expect(sim.grids.get(1)!.raw('fire').some((f) => f > 0)).toBe(false);
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
      const c = unpiloted.world.get(id, CrewC)!;
      if (c.role === 'role.pilot') unpiloted.enqueue({ type: 'crew.setPriority', id, category: 'operating', value: 0 });
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
      run(sim, 20 * 17);
      return combatOf(sim, 1).shield.layers;
    };
    expect(layersAfter(false)).toBe(1);
    expect(layersAfter(true)).toBe(2);
  });

  it('point defence intercepts some missiles', () => {
    const reg = registry({ 'ship.gun': gunShip('module.missileLauncher', ['role.gunner'], [withMissiles], 'hostile') });
    const sim = newGame(1, reg);
    sim.enqueue({ type: 'debug.spawnEnemy', template: 'ship.gun', x: 100, y: 50 });
    const fab = modulesOf(sim, 1, 'module.fabricator')[0] as number;
    aim(sim, 2, 1, fab);
    const events = run(sim, 20 * 120);
    const fired = ofType(events, 'weapon.fired').length;
    expect(fired).toBeGreaterThanOrEqual(10);
    const intercepted = ofType(events, 'projectile.intercepted').length;
    expect(intercepted).toBeGreaterThan(0);
    expect(intercepted).toBeLessThan(fired);
  });
});

describe('enemy AI, endings', () => {
  it('the raider destroys an unprotected ship in a long run', () => {
    const victim = gunShip('module.burstLaser', ['role.gunner']);
    const reg = registry({ 'ship.victim': victim });
    const sim = newGame(3, reg, 'ship.victim');
    sim.enqueue({ type: 'debug.spawnEnemy', template: 'ship.raider', x: 100, y: 50 });
    const events = run(sim, 20 * 400);
    expect(shipOf(sim, 1)?.state).toBe('wreck');
    expect(ofType(events, 'ship.destroyed').map((e) => e.gridId)).toEqual([1]);
    expect(ofType(events, 'module.destroyed').length).toBeGreaterThan(0);
    expect(ofType(events, 'combat.ended')).toHaveLength(1);
    for (const id of sim.world.query(CrewC)) {
      if (sim.world.get(id, PositionC)!.gridId === 1) expect(sim.world.get(id, CrewC)!.activity).toBe('dead');
    }
    expect(sim.grids.has(1)).toBe(true);
  });

  it('flee needs a charged FTL drive and takes the ship out of the fight', () => {
    const sim = newGame(1, content);
    sim.enqueue({ type: 'debug.spawnEnemy', template: 'ship.raider', x: 100, y: 50 });
    sim.enqueue({ type: 'combat.flee', gridId: 1 });
    const early = run(sim, 2);
    expect(early.some((e) => e.type === 'command.rejected' && e.reason === 'notCharged')).toBe(true);
    run(sim, 20 * 25);
    expect(combatOf(sim, 1).ftl).toBeGreaterThan(5);
    combatOf(sim, 1).ftl = 40;
    sim.enqueue({ type: 'combat.flee', gridId: 1 });
    const events = run(sim, 40);
    expect(ofType(events, 'ship.fled')).toEqual([{ type: 'ship.fled', gridId: 1 }]);
    expect(shipOf(sim, 1)?.state).toBe('fled');
    expect(ofType(events, 'combat.ended')).toHaveLength(1);
    expect(sim.sector.inCombat).toBe(false);
  });

  it('a badly damaged raider with a charged drive retreats', () => {
    const sim = newGame(1, content);
    sim.enqueue({ type: 'debug.spawnEnemy', template: 'ship.raider', x: 100, y: 50 });
    run(sim, 400);
    for (const id of sim.world.query(ModuleC)) {
      const m = sim.world.get(id, ModuleC)!;
      if (m.gridId === 2) m.hp = m.def === 'module.reactor' ? 100 : 0;
    }
    const g2 = sim.grids.get(2)!;
    for (let y = 0; y < g2.height; y++) for (let x = 0; x < g2.width; x++) if (g2.get('struct', x, y) === 2) g2.set('hp', x, y, 80); // walls at about a third
    combatOf(sim, 2).ftl = 40;
    const events = run(sim, 100);
    expect(ofType(events, 'ship.fled').map((e) => e.gridId)).toEqual([2]);
  });
});

function countAmmo(sim: Sim, crate: number): number {
  const s = sim.world.get(crate, StorageC)!;
  return s.stacks.filter((x) => x.item === 'item.missile').reduce((n, x) => n + x.count, 0);
}

describe('determinism, saves, performance', { timeout: 30000 }, () => {
  const fightSim = (seed: number): Sim => {
    const sim = newGame(seed, content);
    sim.enqueue({ type: 'debug.spawnEnemy', template: 'ship.raider', x: 100, y: 50 });
    sim.enqueue({ type: 'combat.setHold', gridId: 1, hold: false });
    return sim;
  };
  const withTargets = (sim: Sim): Sim => {
    aim(sim, 1, 2, modulesOf(sim, 2, 'module.reactor')[0] as number);
    return sim;
  };

  it('same seed and commands give an identical save after 2400 ticks of combat', () => {
    const go = (): string => {
      const sim = withTargets(fightSim(9));
      const events = run(sim, 2400);
      expect(ofType(events, 'weapon.fired').length).toBeGreaterThan(3);
      return serialize(sim);
    };
    expect(go()).toBe(go());
  });

  it('round-trips a save taken with projectiles in flight', () => {
    const sim = withTargets(fightSim(5));
    for (let i = 0; i < 4000 && sim.world.query(ProjectileC).length === 0; i++) sim.step();
    expect(sim.world.query(ProjectileC).length).toBeGreaterThan(0);
    const json = serialize(sim);
    const loaded = deserialize(json, content);
    expect(serialize(loaded)).toBe(json);
    run(sim, 600);
    run(loaded, 600);
    expect(serialize(loaded)).toBe(serialize(sim));
  });

  it('runs 2000 ticks of a two-ship fight in under 3 seconds', () => {
    const sim = withTargets(fightSim(2));
    const start = performance.now();
    run(sim, 2000);
    expect(performance.now() - start).toBeLessThan(3000);
  });
});
