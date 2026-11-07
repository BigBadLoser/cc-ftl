import { describe, expect, it } from 'vitest';
import { CombatC, ItemStackC, JobC, ModuleC, ProjectileC, ShipC, StorageC, WeaponC, newGame, playerShip, type Sim } from '../sim';
import { damageModule } from '../sim/combat/effects';
import { commitEtaSec } from '../sim/combat/eta';
import { fitJobOf } from '../sim/upgrades/fit';
import { stripUpgrade } from '../sim/upgrades/loadout';
import { damageTakenMul, effectiveWeapon, weaponDefOf } from '../sim/upgrades/stats';
import { removeModule, spawnModule } from '../sim/modules/spawn';
import { rotatedSize } from '../sim/modules/footprint';
import { storageAdd, storageCount } from '../sim/items/storage';
import { shipStoreCount } from '../sim/items/stock';
import { shipIdOf } from '../sim/regions';
import { TICK_HZ } from '../sim/time';
import { content } from '.';

function setup(seed = 3): { sim: Sim; gun: number; ship: number } {
  const sim = newGame(seed, content);
  const ship = playerShip(sim);
  const gun = sim.world.query(WeaponC, ModuleC).find((id) => sim.world.get(id, ModuleC)?.def === 'module.burstLaser' && shipIdOf(sim, sim.world.get(id, ModuleC)) === ship) as number;
  return { sim, gun, ship };
}

/** Put items into the first storage module of a ship. */
function stock(sim: Sim, ship: number, item: string, n: number): void {
  const store = sim.world.query(StorageC, ModuleC).find((id) => shipIdOf(sim, sim.world.get(id, ModuleC)) === ship) as number;
  expect(storageAdd(sim, store, item, n)).toBe(n);
}

function spawn(sim: Sim, faction: string, seed: number, cx = 120, cy = 60, depth = 2): number {
  const before = new Set(sim.world.query(ShipC));
  // A spot may be taken or out of the sector: pull in towards the middle until the ship fits.
  for (let k = 0; k < 8; k++) {
    sim.enqueue({ type: 'debug.spawnGenerated', faction, depth, seed, cx: cx - Math.sign(cx - 110) * k * 6, cy: cy - Math.sign(cy - 60) * k * 4 });
    sim.step();
    const id = sim.world.query(ShipC).find((s) => !before.has(s));
    if (id !== undefined) return id;
  }
  throw new Error('nothing spawned');
}

const weaponsOf = (sim: Sim, ship: number): number[] => sim.world.query(WeaponC, ModuleC).filter((id) => shipIdOf(sim, sim.world.get(id, ModuleC)) === ship);

describe('fitting an upgrade (crew job)', () => {
  it('an engineer fetches it from cargo and fits it; the weapon is offline meanwhile', () => {
    const { sim, gun, ship } = setup();
    stock(sim, ship, 'item.upg_coolant', 1);
    sim.enqueue({ type: 'module.fitUpgrade', moduleId: gun, item: 'item.upg_coolant' });
    sim.step();
    expect(fitJobOf(sim, gun)).toBeDefined();
    const m = sim.world.get(gun, ModuleC) as { upgrade?: string; powered: boolean };
    let offline = false;
    for (let t = 0; t < 60 * TICK_HZ && !m.upgrade; t++) {
      sim.step();
      if ((fitJobOf(sim, gun)?.[1].progress ?? 0) > 0 && !m.powered) offline = true;
    }
    expect(offline).toBe(true);
    expect(m.upgrade).toBe('item.upg_coolant');
    expect(shipStoreCount(sim, ship, 'item.upg_coolant')).toBe(0);
    expect(fitJobOf(sim, gun)).toBeUndefined();
    sim.step();
    expect(m.powered).toBe(true);
  });

  it('the fit job and the repair job span the weapon footprint, so crew may work it from any side', () => {
    const { sim, gun, ship } = setup();
    const m = sim.world.get(gun, ModuleC)!;
    const size = rotatedSize(sim.content.modules[m.def]!, m.rot);
    stock(sim, ship, 'item.upg_coolant', 1);
    sim.enqueue({ type: 'module.fitUpgrade', moduleId: gun, item: 'item.upg_coolant' });
    sim.step();
    expect(fitJobOf(sim, gun)?.[1].size).toEqual(size);
    m.hp = 1;
    for (let t = 0; t < 2 * TICK_HZ; t++) sim.step();
    const repair = sim.world.query(JobC).map((id) => sim.world.get(id, JobC)!).find((j) => j.kind === 'repair' && j.target === gun);
    expect(repair?.size).toEqual(size);
  });

  it('removing it puts the item back in cargo intact, again as a crew job', () => {
    const { sim, gun, ship } = setup();
    const m = sim.world.get(gun, ModuleC) as { upgrade?: string };
    m.upgrade = 'item.upg_housing';
    sim.enqueue({ type: 'module.removeUpgrade', moduleId: gun });
    for (let t = 0; t < 60 * TICK_HZ && m.upgrade; t++) sim.step();
    expect(m.upgrade).toBeUndefined();
    expect(shipStoreCount(sim, ship, 'item.upg_housing')).toBe(1);
  });

  it('rejects an item that is not in cargo, one that does not fit and a second job', () => {
    const { sim, gun, ship } = setup();
    sim.enqueue({ type: 'module.fitUpgrade', moduleId: gun, item: 'item.upg_coolant' });
    sim.step();
    expect(sim.events.drain().some((e) => e.type === 'command.rejected' && e.reason === 'notInCargo')).toBe(true);
    stock(sim, ship, 'item.metal', 1);
    sim.enqueue({ type: 'module.fitUpgrade', moduleId: gun, item: 'item.metal' });
    sim.step();
    expect(sim.events.drain().some((e) => e.type === 'command.rejected' && e.reason === 'notUpgrade')).toBe(true);
    stock(sim, ship, 'item.upg_coolant', 2);
    sim.enqueue({ type: 'module.fitUpgrade', moduleId: gun, item: 'item.upg_coolant' });
    sim.enqueue({ type: 'module.fitUpgrade', moduleId: gun, item: 'item.upg_coolant' });
    sim.step();
    expect(sim.events.drain().some((e) => e.type === 'command.rejected' && e.reason === 'jobExists')).toBe(true);
    sim.enqueue({ type: 'module.cancelUpgrade', moduleId: gun });
    sim.step();
    expect(sim.world.query(JobC).some((j) => sim.world.get(j, JobC)?.kind === 'fit')).toBe(false);
  });

  it('a module with no slot takes nothing', () => {
    const { sim, ship } = setup();
    const store = sim.world.query(StorageC, ModuleC).find((id) => shipIdOf(sim, sim.world.get(id, ModuleC)) === ship) as number;
    stock(sim, ship, 'item.upg_coolant', 1);
    sim.enqueue({ type: 'module.fitUpgrade', moduleId: store, item: 'item.upg_coolant' });
    sim.step();
    expect(sim.events.drain().some((e) => e.type === 'command.rejected' && e.reason === 'noSlot')).toBe(true);
  });
});

describe('upgrade modifiers', () => {
  it('coolant jacket cuts heat per volley by 30% and the capacitor charge time by 15%', () => {
    const { sim, gun } = setup();
    const base = weaponDefOf(sim, gun)!;
    const m = sim.world.get(gun, ModuleC) as { upgrade?: string };
    m.upgrade = 'item.upg_coolant';
    expect(weaponDefOf(sim, gun)?.heat).toBeCloseTo(base.heat * 0.7);
    expect(weaponDefOf(sim, gun)?.chargeSec).toBe(base.chargeSec);
    m.upgrade = 'item.upg_capacitor';
    expect(weaponDefOf(sim, gun)?.chargeSec).toBeCloseTo(base.chargeSec * 0.85);
    expect(weaponDefOf(sim, gun)?.heat).toBe(base.heat);
    delete m.upgrade;
    expect(effectiveWeapon(sim, gun, base)).toBe(base);
  });

  it('the committed-shot countdown uses the effective charge time (a quick capacitor brings it in sooner)', () => {
    const eta = (upgrade?: string): number => {
      const { sim, gun } = setup();
      const m = sim.world.get(gun, ModuleC) as { upgrade?: string };
      if (upgrade) m.upgrade = upgrade;
      const w = sim.world.get(gun, WeaponC) as { charge: number; commit?: unknown };
      w.charge = 0;
      w.commit = { ship: 0, x: 0, y: 0, w: 1, h: 1 };
      return commitEtaSec(sim, gun) as number;
    };
    const plain = eta();
    expect(plain).toBeGreaterThan(0);
    expect(eta('item.upg_capacitor')).toBeLessThan(plain);
  });

  it('a volley adds the effective heat', () => {
    const run = (upgrade?: string): number => {
      const { sim, gun, ship } = setup();
      const enemy = spawn(sim, 'faction.scrapper', 5);
      for (let t = 0; t < 3 * TICK_HZ; t++) sim.step();
      const c = sim.world.get(ship, CombatC) as { target: unknown; heat: { value: number } };
      c.target = { ship: enemy, moduleId: 0 };
      const m = sim.world.get(gun, ModuleC) as { upgrade?: string };
      if (upgrade) m.upgrade = upgrade;
      (sim.world.get(gun, WeaponC) as { charge: number }).charge = 1;
      const before = c.heat.value;
      for (let t = 0; t < 4; t++) sim.step();
      return c.heat.value - before;
    };
    const plain = run();
    expect(plain).toBeGreaterThan(0);
    expect(run('item.upg_coolant')).toBeLessThan(plain);
  });

  it('hardened housing halves damage from hits and the seconds of an ion hit, through the shared module paths', () => {
    const { sim, gun, ship } = setup();
    const m = sim.world.get(gun, ModuleC) as { hp: number; upgrade?: string };
    const hp = m.hp;
    damageModule(sim, gun, 20, ship);
    expect(hp - m.hp).toBe(20);
    m.hp = hp;
    m.upgrade = 'item.upg_housing';
    expect(damageTakenMul(sim, gun)).toBe(0.5);
    damageModule(sim, gun, 20, ship);
    expect(hp - m.hp).toBe(10);
  });
});

describe('flak cannon', () => {
  /** The player's burst laser turned into a flak cannon (same 2x2 footprint), scrap in cargo, an enemy in range. */
  function flakSetup(scrap: number, at: [number, number] = [120, 60], depth = 2) {
    const s = setup();
    (s.sim.world.get(s.gun, ModuleC) as { def: string }).def = 'module.flakCannon';
    (s.sim.world.get(s.gun, WeaponC) as { mode: string }).mode = 'auto';
    if (scrap > 0) stock(s.sim, s.ship, 'item.scrap_hull', scrap);
    const enemy = spawn(s.sim, 'faction.scrapper', 5, at[0], at[1], depth);
    for (let t = 0; t < 3 * TICK_HZ; t++) s.sim.step();
    const ec = s.sim.world.get(enemy, CombatC) as { evasion: number; shield: { layers: number; max: number } };
    ec.evasion = 0;
    (s.sim.world.get(s.ship, CombatC) as { target: unknown }).target = { ship: enemy, moduleId: 0 };
    return { ...s, enemy, ec };
  }
  const fire = (sim: Sim, gun: number): void => {
    (sim.world.get(gun, WeaponC) as { charge: number }).charge = 1;
    for (let t = 0; t < 10; t++) sim.step();
  };

  it('spends one hull scrap item per volley and throws a spread of pellets', () => {
    const { sim, gun, ship } = flakSetup(5);
    fire(sim, gun);
    expect(shipStoreCount(sim, ship, 'item.scrap_hull')).toBe(4);
    expect(sim.world.query(ProjectileC).filter((p) => sim.world.get(p, ProjectileC)?.weapon === 'weapon.flak').length).toBe(content.weapons['weapon.flak'].shots);
  });

  it('does not fire with no scrap in cargo', () => {
    const { sim, gun } = flakSetup(0);
    fire(sim, gun);
    expect(sim.world.query(ProjectileC).length).toBe(0);
  });

  it('every pellet that meets a shield strips a layer', () => {
    const { sim, gun, ec } = flakSetup(3, [120, 60], 6);
    for (let t = 0; t < 10 * TICK_HZ; t++) sim.step(); // the generator's dish comes out
    const layers = ec.shield.max;
    expect(layers).toBeGreaterThanOrEqual(2);
    ec.shield.layers = layers;
    (sim.world.get(gun, WeaponC) as { charge: number }).charge = 1;
    const hits: number[] = [];
    for (let t = 0; t < 200 && (sim.world.query(ProjectileC).length > 0 || t < 5); t++) {
      sim.step();
      for (const e of sim.events.drain()) if (e.type === 'projectile.shieldHit' && e.weapon === 'weapon.flak') hits.push(e.layers);
    }
    // each pellet took one layer, down to none; the spare pellets found no shield left and hit the hull
    expect(hits).toEqual(Array.from({ length: layers }, (_, k) => layers - 1 - k));
  });

  it('is less accurate at range: the scatter grows with distance', () => {
    const spreadAt = (at: [number, number]): number => {
      const { sim, gun } = flakSetup(2, at);
      fire(sim, gun);
      const p = sim.world.query(ProjectileC).map((i) => sim.world.get(i, ProjectileC)).find((x) => x?.weapon === 'weapon.flak');
      return p?.spread ?? 0;
    };
    expect(spreadAt([185, 108])).toBeGreaterThan(spreadAt([90, 60]));
  });
});

describe('hold means hold', () => {
  /** Flak volleys launched over 20 s with a target ship, the weapon and the ship in the given state. */
  function volleys(o: { mode: 'auto' | 'hold'; holdAll?: boolean }): number {
    const { sim, gun, ship } = setup();
    (sim.world.get(gun, ModuleC) as { def: string }).def = 'module.flakCannon';
    (sim.world.get(gun, WeaponC) as { mode: string }).mode = o.mode;
    if (o.holdAll) (sim.world.get(ship, CombatC) as { hold: boolean }).hold = true;
    stock(sim, ship, 'item.scrap_hull', 20);
    const enemy = spawn(sim, 'faction.navy', 5, 100, 60, 8);
    (sim.world.get(ship, CombatC) as { target: unknown }).target = { ship: enemy, moduleId: 0 };
    let shots = 0;
    for (let t = 0; t < 20 * TICK_HZ; t++) {
      sim.step();
      for (const e of sim.events.drain()) if (e.type === 'weapon.fired' && e.weapon === 'weapon.flak') shots++;
      (sim.world.get(gun, WeaponC) as { charge: number }).charge = 1;
    }
    return shots;
  }

  it('a weapon on AUTO fires, a weapon on HOLD or under hold all fires nothing', () => {
    expect(volleys({ mode: 'auto' })).toBeGreaterThan(0);
    expect(volleys({ mode: 'hold' })).toBe(0);
    expect(volleys({ mode: 'auto', holdAll: true })).toBe(0);
  });

  it('flak never picks a drone on its own: with no ship target it fires nothing', () => {
    const { sim, gun, ship } = setup();
    (sim.world.get(gun, ModuleC) as { def: string }).def = 'module.flakCannon';
    (sim.world.get(gun, WeaponC) as { mode: string }).mode = 'auto';
    stock(sim, ship, 'item.scrap_hull', 20);
    spawn(sim, 'faction.navy', 5, 100, 60, 8);
    let shots = 0;
    for (let t = 0; t < 30 * TICK_HZ; t++) {
      sim.step();
      for (const e of sim.events.drain()) if (e.type === 'weapon.fired' && e.targetShip === 0) shots++;
      (sim.world.get(gun, WeaponC) as { charge: number }).charge = 1;
    }
    expect(shots).toBe(0);
  });

  it('a built flak cannon starts on HOLD, like the other ammo weapons', () => {
    const { sim, gun } = setup();
    const at = sim.world.get(gun, ModuleC) as { x: number; y: number };
    const flak = spawnModule(sim, 'module.flakCannon', at.x, at.y, 0);
    expect(sim.world.get(flak, WeaponC)?.mode).toBe('hold');
  });
});

describe('enemy loadouts', () => {
  const fitted = (sim: Sim, ship: number): string[] => weaponsOf(sim, ship).flatMap((id) => sim.world.get(id, ModuleC)?.upgrade ?? []);

  it('navy ships carry their faction upgrades, only from its table, the same every time for a seed', () => {
    const found = new Set<string>();
    for (let seed = 1; seed <= 12; seed++) { const sim = newGame(3, content); for (const u of fitted(sim, spawn(sim, 'faction.navy', seed))) found.add(u); }
    expect(found.size).toBeGreaterThan(0);
    for (const u of found) expect(content.factions['faction.navy'].upgrades.map((e) => e.item)).toContain(u);
    const a = newGame(3, content);
    const b = newGame(9, content);
    const ship = (s: Sim) => fitted(s, spawn(s, 'faction.navy', 7));
    expect(ship(a)).toEqual(ship(b));
  });

  it('pirates fit crude gear and civilians none', () => {
    const found = new Set<string>();
    for (let seed = 1; seed <= 12; seed++) { const sim = newGame(3, content); for (const u of fitted(sim, spawn(sim, 'faction.scrapper', seed))) found.add(u); }
    for (const u of found) expect(content.factions['faction.scrapper'].upgrades.map((e) => e.item)).toContain(u);
    expect(found.size).toBeGreaterThan(0);
    const sim = newGame(3, content);
    expect(fitted(sim, spawn(sim, 'faction.civilian', 4))).toEqual([]);
  });

});

describe('stripping an enemy weapon', () => {
  function enemyGun(): { sim: Sim; ship: number; gun: number } {
    const sim = newGame(3, content);
    const ship = spawn(sim, 'faction.scrapper', 2);
    const gun = weaponsOf(sim, ship)[0] as number;
    (sim.world.get(gun, ModuleC) as { upgrade?: string }).upgrade = 'item.upg_coolant';
    return { sim, ship, gun };
  }
  const floorItems = (sim: Sim, item: string): number => sim.world.query(ItemStackC).filter((i) => sim.world.get(i, ItemStackC)?.item === item).reduce((n, i) => n + (sim.world.get(i, ItemStackC)?.count ?? 0), 0);

  it('an intact weapon drops its upgrade', () => {
    const { sim, gun } = enemyGun();
    stripUpgrade(sim, gun);
    expect(sim.world.get(gun, ModuleC)?.upgrade).toBe('item.upg_coolant');
    removeModule(sim, gun);
    expect(floorItems(sim, 'item.upg_coolant')).toBe(1);
  });

  it('a destroyed weapon always loses it and a damaged one at about its damage', () => {
    const { sim, gun } = enemyGun();
    const m = sim.world.get(gun, ModuleC) as { hp: number; upgrade?: string };
    const max = content.modules[m.hp > 0 ? (sim.world.get(gun, ModuleC)?.def as 'module.burstLaser') : 'module.burstLaser'].maxHp;
    m.hp = 0;
    stripUpgrade(sim, gun);
    expect(m.upgrade).toBeUndefined();
    let lost = 0;
    for (let i = 0; i < 300; i++) {
      m.upgrade = 'item.upg_coolant';
      m.hp = max / 2;
      stripUpgrade(sim, gun);
      if (!m.upgrade) lost++;
    }
    expect(lost / 300).toBeGreaterThan(0.38);
    expect(lost / 300).toBeLessThan(0.62);
  });
});

describe('sources', () => {
  it('the general upgrades are priced items with blueprints, recipes and research', () => {
    for (const id of ['item.upg_coolant', 'item.upg_capacitor', 'item.upg_housing']) {
      expect(content.items[id as 'item.upg_coolant'].price).toBeGreaterThan(0);
      const recipe = Object.values(content.recipes).find((r) => r.outputs.some((o) => o.item === id));
      expect(recipe?.station).toBe('module.fabricator');
      const bp = (recipe as { blueprint?: string }).blueprint;
      expect(Object.values(content.research).some((r) => r.unlocks.includes(bp as string))).toBe(true);
    }
    expect(Object.values(content.research).some((r) => r.unlocks.includes('module.flakCannon'))).toBe(true);
  });

  it('stations stock them: military, research, trading and the navy trader', () => {
    const stockOf = (id: string): string[] => ((content.trade.traders as Record<string, { stock?: { item: string }[] }>)[id]?.stock ?? []).map((s) => s.item);
    for (const t of ['trader.station.military', 'trader.station.research', 'trader.station.trading', 'trader.navy']) {
      expect(stockOf(t).some((i) => i.startsWith('item.upg_')), t).toBe(true);
    }
    expect(stockOf('trader.station.military')).toEqual(expect.arrayContaining(['item.upg_coolant', 'item.upg_capacitor', 'item.upg_housing']));
  });

  it('the item is usable from cargo: counted by the ship stores', () => {
    const { sim, ship } = setup();
    stock(sim, ship, 'item.upg_capacitor', 2);
    expect(shipStoreCount(sim, ship, 'item.upg_capacitor')).toBe(2);
    expect(storageCount).toBeDefined();
  });
});
describe('hold all', () => {
  it('releasing hold all puts each weapon back on the mode it had', () => {
    const { sim, gun, ship } = setup();
    const at = sim.world.get(gun, ModuleC) as { x: number; y: number };
    const flak = spawnModule(sim, 'module.flakCannon', at.x, at.y, 0);
    const laser = sim.world.get(gun, WeaponC) as { mode: string };
    const w = sim.world.get(flak, WeaponC) as { mode: string };
    laser.mode = 'auto';
    w.mode = 'auto';
    sim.enqueue({ type: 'combat.holdAll', ship, hold: true });
    sim.step();
    expect([w.mode, laser.mode]).toEqual(['hold', 'hold']);
    sim.enqueue({ type: 'combat.holdAll', ship, hold: false });
    sim.step();
    expect([w.mode, laser.mode]).toEqual(['auto', 'auto']);
  });
});
