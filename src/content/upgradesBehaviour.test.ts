import { describe, expect, it } from 'vitest';
import type { ModuleDef } from '../sim/registry';
import { CombatC, CrewC, HealthC, ModuleC, PositionC, ProjectileC, ShipC, StorageC, WeaponC, newGame, playerShip, type Sim } from '../sim';
import { applyEffects, type Impact } from '../sim/combat/effects';
import { fitError } from '../sim/upgrades/fit';
import { moduleNameOf, weaponDefOf, weaponShortOf } from '../sim/upgrades/stats';
import { shipGrid, shipIdOf } from '../sim/regions';
import { footprintTiles } from '../sim/modules/footprint';
import { origin } from '../sim/crew/helpers';
import { shipStoreCount } from '../sim/items/stock';
import { takeStock } from '../sim/combat/ammo';
import { storageAdd } from '../sim/items/storage';
import { Struct } from '../sim/structure';
import { TICK_HZ } from '../sim/time';
import { content } from '.';

const WEAPON_OF = {
  'item.upg_prism': 'module.burstLaser', 'item.upg_focus': 'module.burstLaser', 'item.upg_frag': 'module.massDriver', 'item.upg_rail': 'module.massDriver',
  'item.upg_nuke': 'module.missileLauncher', 'item.upg_chain': 'module.ionCannon', 'item.upg_thermite': 'module.incendiaryLauncher',
} as const;
const ITEMS = Object.keys(WEAPON_OF) as (keyof typeof WEAPON_OF)[];

/** The player's burst laser turned into the module `def` (same trick as the flak tests), with `upgrade` fitted. */
function gunSetup(def: string, upgrade?: string, seed = 3): { sim: Sim; gun: number; ship: number } {
  const sim = newGame(seed, content);
  const ship = playerShip(sim);
  const gun = sim.world.query(WeaponC, ModuleC).find((id) => sim.world.get(id, ModuleC)?.def === 'module.burstLaser' && shipIdOf(sim, sim.world.get(id, ModuleC)) === ship) as number;
  const m = sim.world.get(gun, ModuleC) as { def: string; upgrade?: string };
  m.def = def;
  if (upgrade) m.upgrade = upgrade;
  for (const id of sim.world.query(WeaponC)) (sim.world.get(id, WeaponC) as { mode: string }).mode = id === gun ? 'auto' : 'hold'; // only this gun fires
  return { sim, gun, ship };
}

const stockShip = (sim: Sim, ship: number, item: string, n: number): void => {
  const store = sim.world.query(StorageC, ModuleC).find((id) => shipIdOf(sim, sim.world.get(id, ModuleC)) === ship) as number;
  expect(storageAdd(sim, store, item, n)).toBe(n);
};

let lastEnemy: { ec: { shield: { layers: number; timer: number; max: number } }; layers: number };

/** An enemy ship in range, evasion off, shields at `layers`, targeted by the player's ship. */
function withEnemy(sim: Sim, ship: number, layers: number): number {
  const before = new Set(sim.world.query(ShipC));
  sim.enqueue({ type: 'debug.spawnGenerated', faction: 'faction.scrapper', depth: 6, seed: 5, cx: 120, cy: 60 });
  sim.step();
  const enemy = sim.world.query(ShipC).find((s) => !before.has(s)) as number;
  for (let t = 0; t < 10 * TICK_HZ; t++) sim.step();
  const ec = sim.world.get(enemy, CombatC) as { evasion: number; shield: { layers: number; timer: number; max: number } };
  ec.evasion = 0;
  ec.shield.layers = layers;
  (sim.world.get(ship, CombatC) as { target: unknown }).target = { ship: enemy, moduleId: 0 };
  lastEnemy = { ec, layers };
  return enemy;
}

/** Visit every tile of a ship's rectangle (sector coordinates). */
function eachTile(grid: NonNullable<ReturnType<typeof shipGrid>>, f: (x: number, y: number) => boolean | void): void {
  for (let y = grid.y0; y < grid.y0 + grid.height; y++) for (let x = grid.x0; x < grid.x0 + grid.width; x++) if (f(x, y)) return;
}

/** Leave the ship exactly `n` missiles. */
function setMissiles(sim: Sim, ship: number, n: number): void {
  takeStock(sim, ship, 'item.missile', 1e6);
  if (n > 0) stockShip(sim, ship, 'item.missile', n);
}

/** Fire one volley now and run until its shots have resolved; the events it made and the shots launched. */
function volley(sim: Sim, gun: number, pin?: { ec: { shield: { layers: number; timer: number } }; layers: number }): { events: ReturnType<Sim['events']['drain']>; shots: number } {
  sim.events.drain();
  (sim.world.get(gun, WeaponC) as { charge: number }).charge = 1;
  const events: ReturnType<Sim['events']['drain']> = [];
  let shots = 0;
  const mine = new Set<number>();
  for (let t = 0; t < 30 * TICK_HZ; t++) {
    if (pin) Object.assign(pin.ec.shield, { layers: pin.layers, timer: 0 }); // no regeneration mid-volley
    sim.step();
    for (const e of sim.events.drain()) {
      if (e.type === 'weapon.fired' && e.weaponId === gun) {
        shots++;
        mine.add(e.projectile);
      }
      if (e.type === 'weapon.fired' || !('projectile' in e) || mine.has(e.projectile)) events.push(e);
    }
    if (t > 5 && sim.world.query(ProjectileC).length === 0 && (sim.world.get(gun, WeaponC)?.shotsLeft ?? 0) === 0) break;
  }
  return { events, shots };
}
const hitsAndShields = (events: ReturnType<Sim['events']['drain']>): { hit: number; shield: number } => ({
  hit: events.filter((e) => e.type === 'projectile.hit').length, shield: events.filter((e) => e.type === 'projectile.shieldHit').length,
});

describe('behaviour upgrades: items and fitting', () => {
  it('each is a priced upgrade item that fits only its own weapon type', () => {
    for (const item of ITEMS) {
      const def = content.items[item];
      expect(def.price, item).toBeGreaterThan(0);
      expect(def.upgrade?.slot).toBe('weapon');
      for (const [other, mod] of Object.entries(WEAPON_OF)) {
        const { sim, gun } = gunSetup(mod);
        const err = fitError(sim, gun, item);
        // a fit error also complains the item is not in cargo; the type check comes first
        if (other === item || mod === WEAPON_OF[item]) expect(err, `${item} on ${mod}`).not.toBe('wontFit');
        else expect(err, `${item} on ${mod}`).toBe('wontFit');
      }
    }
  });

  it('the researched ones have a blueprint, a recipe and research; the nuke has none and is contraband', () => {
    for (const item of ITEMS.filter((i) => i !== 'item.upg_nuke')) {
      const recipe = Object.values(content.recipes).find((r) => r.outputs.some((o) => o.item === item));
      expect(recipe?.station, item).toBe('module.fabricator');
      expect(Object.values(content.research).some((r) => r.unlocks.includes((recipe as { blueprint?: string }).blueprint as string)), item).toBe(true);
    }
    expect(Object.values(content.recipes).some((r) => r.outputs.some((o) => o.item === 'item.upg_nuke'))).toBe(false);
    expect(content.items['item.upg_nuke'].tags).toContain('contraband');
  });

  it('the nuke is sold only on the black market; the rest are on shelves; factions carry only fitting items', () => {
    const traders = Object.values(content.trade.traders as Record<string, { stock?: { item: string }[] }>);
    expect(traders.some((t) => t.stock?.some((s) => s.item === 'item.upg_nuke'))).toBe(false);
    expect(Object.values(content.blackMarkets).some((b) => b.stock.some((s) => s.item === 'item.upg_nuke'))).toBe(true);
    for (const item of ITEMS.filter((i) => i !== 'item.upg_nuke')) expect(traders.some((t) => t.stock?.some((s) => s.item === item)), item).toBe(true);
    const carried = new Set((Object.values(content.factions) as { upgrades?: { item: string }[] }[]).flatMap((f) => (f.upgrades ?? []).map((u) => u.item)));
    expect(carried.has('item.upg_nuke')).toBe(false);
    for (const item of ITEMS.filter((i) => i !== 'item.upg_nuke')) expect(carried.has(item), item).toBe(true);
  });
});

describe('prism splitter and heavy focus (burst laser)', () => {
  it('prism: five shots each 40% weaker, +50% heat', () => {
    const { sim, gun } = gunSetup('module.burstLaser');
    const base = weaponDefOf(sim, gun)!;
    (sim.world.get(gun, ModuleC) as { upgrade?: string }).upgrade = 'item.upg_prism';
    const d = weaponDefOf(sim, gun)!;
    expect(d.shots).toBe(5);
    expect(base.shots).toBe(3);
    expect(d.heat).toBeCloseTo(base.heat * 1.5);
    const dmg = (w: typeof base, type: string) => (w.effects.find((e) => e.type === type) as { amount: number }).amount;
    for (const t of ['hullDamage', 'moduleDamage', 'crewDamage']) expect(dmg(d, t)).toBeCloseTo(dmg(base, t) * 0.6, 0);
  });

  it('prism launches five projectiles in a volley', () => {
    const { sim, gun, ship } = gunSetup('module.burstLaser', 'item.upg_prism');
    withEnemy(sim, ship, 0);
    expect(volley(sim, gun, lastEnemy).shots).toBe(5);
  });

  it('focus: two shots, each passing one shield layer, charging slower', () => {
    const { sim, gun, ship } = gunSetup('module.burstLaser');
    const base = weaponDefOf(sim, gun)!;
    (sim.world.get(gun, ModuleC) as { upgrade?: string }).upgrade = 'item.upg_focus';
    const d = weaponDefOf(sim, gun)!;
    expect(d.shots).toBe(2);
    expect(d.shield.pierce).toBe(1);
    expect(d.chargeSec).toBeGreaterThan(base.chargeSec);
    withEnemy(sim, ship, 1);
    const r = hitsAndShields(volley(sim, gun, lastEnemy).events);
    expect(r).toEqual({ hit: 2, shield: 0 }); // one layer: both shots pass it
  });

  it('focus is stopped by two layers, as the plain laser is by one', () => {
    const { sim, gun, ship } = gunSetup('module.burstLaser', 'item.upg_focus');
    withEnemy(sim, ship, 2);
    const r = hitsAndShields(volley(sim, gun, lastEnemy).events);
    expect(r.shield).toBeGreaterThanOrEqual(1);
  });
});

describe('frag slug and rail coil (mass driver)', () => {
  it('frag: no shield pierce (one layer stops it), a wider and harder blast', () => {
    const plain = gunSetup('module.massDriver');
    const base = weaponDefOf(plain.sim, plain.gun)!;
    expect(base.shield.pierce).toBe(1);
    const { sim, gun, ship } = gunSetup('module.massDriver', 'item.upg_frag');
    const d = weaponDefOf(sim, gun)!;
    expect(d.shield.pierce).toBe(0);
    const eff = (w: typeof d, type: string) => w.effects.find((e) => e.type === type) as { amount: number; radius?: number };
    expect(eff(d, 'hullDamage').radius).toBeGreaterThan(eff(base, 'hullDamage').radius ?? 0);
    expect(eff(d, 'moduleDamage').amount).toBeGreaterThan(eff(base, 'moduleDamage').amount);
    expect(eff(d, 'crewDamage').amount).toBeGreaterThan(eff(base, 'crewDamage').amount);
    withEnemy(sim, ship, 1);
    expect(hitsAndShields(volley(sim, gun, lastEnemy).events)).toEqual({ hit: 0, shield: 1 });
  });

  it('frag damages walls two tiles from the impact; the plain slug does not', () => {
    const wallsLost = (upgrade?: string): number => {
      const { sim, gun, ship } = gunSetup('module.massDriver', upgrade);
      const enemy = withEnemy(sim, ship, 0);
      const grid = shipGrid(sim, enemy)!;
      let spot: { x: number; y: number } | undefined;
      eachTile(grid, (x, y) => {
        if ([0, 1, 2].every((d) => grid.inBounds(x + d, y) && grid.get('struct', x + d, y) === Struct.Wall && grid.get('module', x + d, y) === 0)) return !!(spot = { x, y });
      });
      expect(spot).toBeDefined();
      const before = grid.get('hp', (spot as { x: number }).x + 2, (spot as { y: number }).y);
      applyEffects(sim, { shipId: enemy, x: (spot as { x: number }).x, y: (spot as { y: number }).y, projectile: 0, weapon: 'weapon.massDriver' }, weaponDefOf(sim, gun)!.effects);
      return before - grid.get('hp', (spot as { x: number }).x + 2, (spot as { y: number }).y);
    };
    expect(wallsLost()).toBe(0);
    expect(wallsLost('item.upg_frag')).toBeGreaterThan(0);
  });

  it('rail: pierces two layers, flies much faster, runs very hot', () => {
    const plain = gunSetup('module.massDriver');
    const base = weaponDefOf(plain.sim, plain.gun)!;
    const { sim, gun, ship } = gunSetup('module.massDriver', 'item.upg_rail');
    const d = weaponDefOf(sim, gun)!;
    expect(d.shield.pierce).toBe(2);
    expect(d.speed).toBeGreaterThan(base.speed * 2);
    expect(d.heat).toBeGreaterThan(base.heat * 2);
    withEnemy(sim, ship, 2);
    expect(hitsAndShields(volley(sim, gun, lastEnemy).events)).toEqual({ hit: 1, shield: 0 });
  });

  it('a plain slug is stopped by two layers where the rail coil is not', () => {
    const { sim, gun, ship } = gunSetup('module.massDriver');
    withEnemy(sim, ship, 2);
    expect(hitsAndShields(volley(sim, gun, lastEnemy).events)).toEqual({ hit: 0, shield: 1 });
  });
});

describe('nuclear warhead (missiles)', () => {
  it('spends two missiles a shot: one missile is not enough, two fire, and the shot reports its ammo', () => {
    const { sim, gun, ship } = gunSetup('module.missileLauncher', 'item.upg_nuke');
    withEnemy(sim, ship, 0);
    setMissiles(sim, ship, 1);
    expect(volley(sim, gun).shots).toBe(0);
    expect(shipStoreCount(sim, ship, 'item.missile')).toBe(1);
    setMissiles(sim, ship, 3);
    const r = volley(sim, gun);
    expect(r.shots).toBe(1);
    expect(shipStoreCount(sim, ship, 'item.missile')).toBe(1);
    expect(r.events.find((e) => e.type === 'weapon.fired')).toMatchObject({ ammo: 2 });
  });

  it('a plain missile spends one', () => {
    const { sim, gun, ship } = gunSetup('module.missileLauncher');
    withEnemy(sim, ship, 0);
    setMissiles(sim, ship, 3);
    expect(volley(sim, gun).events.find((e) => e.type === 'weapon.fired')).toMatchObject({ ammo: 1 });
    expect(shipStoreCount(sim, ship, 'item.missile')).toBe(2);
  });

  it('the blast is huge: harder everywhere, and fire across it', () => {
    const { sim, gun, ship } = gunSetup('module.missileLauncher', 'item.upg_nuke');
    const base = weaponDefOf(gunSetup('module.missileLauncher').sim, gun)!;
    const d = weaponDefOf(sim, gun)!;
    const eff = (w: typeof d, type: string) => w.effects.find((e) => e.type === type) as { amount: number; radius?: number } | undefined;
    for (const t of ['hullDamage', 'moduleDamage', 'crewDamage']) {
      expect(eff(d, t)!.amount).toBeGreaterThan(eff(base, t)!.amount * 1.5);
      expect(eff(d, t)!.radius ?? 0).toBeGreaterThan(eff(base, t)!.radius ?? 0);
    }
    expect(eff(d, 'ignite')?.radius ?? 0).toBeGreaterThanOrEqual(2);
    const enemy = withEnemy(sim, ship, 0);
    const grid = shipGrid(sim, enemy)!;
    const fires = (effects: typeof d.effects): number => {
      // a floor tile with floor all round, so the blast has room
      let floor = { x: 0, y: 0 };
      eachTile(grid, (x, y) => {
        const open = [-3, 0, 3].every((d) => [-3, 0, 3].every((e) => grid.inBounds(x + d, y + e) && grid.get('struct', x + d, y + e) === Struct.Floor));
        return open && !!(floor = { x, y });
      });
      eachTile(grid, (x, y) => void grid.set('fire', x, y, 0));
      applyEffects(sim, { shipId: enemy, x: floor.x, y: floor.y, projectile: 0, weapon: 'weapon.missile' } as Impact, effects);
      let n = 0;
      eachTile(grid, (x, y) => void (grid.get('fire', x, y) > 0 && n++));
      return n;
    };
    expect(fires(d.effects)).toBeGreaterThan(fires(base.effects));
  });
});

describe('chain coil (ion cannon)', () => {
  /** The player's ship with one crew member and a module tile within 4 tiles of it; impact on that module. */
  function arcSetup(upgrade?: string) {
    const { sim, gun, ship } = gunSetup('module.ionCannon', upgrade);
    const crew = sim.world.query(CrewC, HealthC, PositionC).find((id) => shipIdOf(sim, sim.world.get(id, PositionC)) === ship) as number;
    const m = sim.world.get(gun, ModuleC)!;
    const at = footprintTiles((content.modules as Record<string, ModuleDef>)[m.def]!, m.x, m.y, m.rot)[0]!;
    Object.assign(sim.world.get(crew, PositionC)!, { x: at.x + 2, y: at.y, toX: at.x + 2, toY: at.y }); // two tiles from the hit
    (sim.world.get(ship, CombatC) as { shield: { layers: number } }).shield.layers = 0;
    const o = origin(sim.world.get(crew, PositionC)!);
    return { sim, gun, ship, crew, at, near: Math.max(Math.abs(at.x - o.x), Math.abs(at.y - o.y)) };
  }
  const hp = (sim: Sim, crew: number): number => sim.world.get(crew, HealthC)!.hp;

  it('+40% heat and an arc effect', () => {
    const { sim, gun } = arcSetup('item.upg_chain');
    const base = weaponDefOf(arcSetup().sim, gun)!;
    const d = weaponDefOf(sim, gun)!;
    expect(d.heat).toBeCloseTo(base.heat * 1.4);
    expect(d.effects.some((e) => e.type === 'arc')).toBe(true);
    expect(base.effects.some((e) => e.type === 'arc')).toBe(false);
  });

  it('arcs from the hit module into crew nearby; the plain ion bolt does not touch them', () => {
    for (const [upgrade, hurt] of [[undefined, false], ['item.upg_chain', true]] as const) {
      const { sim, gun, ship, crew, at, near } = arcSetup(upgrade);
      if (hurt) expect(near).toBeLessThanOrEqual(4);
      const before = hp(sim, crew);
      sim.events.drain();
      applyEffects(sim, { shipId: ship, x: at.x, y: at.y, projectile: 0, weapon: 'weapon.ion' }, weaponDefOf(sim, gun)!.effects);
      expect(hp(sim, crew) < before, String(upgrade)).toBe(hurt);
      expect(sim.events.drain().some((e) => e.type === 'projectile.arc')).toBe(hurt);
    }
  });

  it('a shield that drains the bolt takes the arc with it, and an empty tile makes none', () => {
    const { sim, gun, ship, crew, at } = arcSetup('item.upg_chain');
    const effects = weaponDefOf(sim, gun)!.effects;
    const before = hp(sim, crew);
    (sim.world.get(ship, CombatC) as { shield: { layers: number } }).shield.layers = 1;
    applyEffects(sim, { shipId: ship, x: at.x, y: at.y, projectile: 0, weapon: 'weapon.ion' }, effects);
    expect(hp(sim, crew)).toBe(before);
    (sim.world.get(ship, CombatC) as { shield: { layers: number } }).shield.layers = 0;
    applyEffects(sim, { shipId: ship, x: -1, y: -1, projectile: 0, weapon: 'weapon.ion' }, [{ type: 'arc', amount: 99, radius: 99 }]);
    expect(hp(sim, crew)).toBe(before);
  });
});

describe('thermite (incendiary)', () => {
  it('real hull damage on top of the ignite: two hits breach a wall, and it burns', () => {
    const run = (upgrade?: string): { hp: number; struct: number } => {
      const { sim, gun, ship } = gunSetup('module.incendiaryLauncher', upgrade);
      const enemy = withEnemy(sim, ship, 0);
      const grid = shipGrid(sim, enemy)!;
      let w = { x: 0, y: 0 };
      eachTile(grid, (x, y) => grid.get('struct', x, y) === Struct.Wall && !!(w = { x, y }));
      const start = grid.get('hp', w.x, w.y);
      const hit = () => applyEffects(sim, { shipId: enemy, x: w.x, y: w.y, projectile: 0, weapon: 'weapon.incendiary' }, weaponDefOf(sim, gun)!.effects);
      hit();
      const first = start - grid.get('hp', w.x, w.y);
      hit();
      return { hp: first, struct: grid.get('struct', w.x, w.y) };
    };
    const plain = run();
    const hot = run('item.upg_thermite');
    expect(plain.hp).toBeLessThanOrEqual(6);
    expect(plain.struct).toBe(Struct.Wall);
    expect(hot.hp).toBeGreaterThan(plain.hp * 10);
    expect(hot.struct).not.toBe(Struct.Wall); // two hits breach
    const { sim, gun } = gunSetup('module.incendiaryLauncher', 'item.upg_thermite');
    const base = gunSetup('module.incendiaryLauncher').sim;
    expect(weaponDefOf(sim, gun)!.heat).toBeGreaterThan(weaponDefOf(base, gun)!.heat);
    expect(weaponDefOf(sim, gun)!.effects.some((e) => e.type === 'ignite')).toBe(true);
  });
});

describe('behaviour upgrades rename the weapon', () => {
  const NAMES: Record<string, [string, string]> = {
    'item.upg_prism': ['Prism laser', 'Prism'], 'item.upg_focus': ['Lance laser', 'Lance'], 'item.upg_frag': ['Frag driver', 'Frag'], 'item.upg_rail': ['Railgun', 'Rail'],
    'item.upg_nuke': ['Nuke launcher', 'Nuke'], 'item.upg_chain': ['Arc cannon', 'Arc'], 'item.upg_thermite': ['Thermite cannon', 'Thermite'],
  };
  it('the effective weapon def and the player-facing names carry the variant; removing the upgrade restores them', () => {
    for (const item of ITEMS) {
      const { sim, gun } = gunSetup(WEAPON_OF[item]);
      const moduleName = (content.modules as Record<string, ModuleDef>)[WEAPON_OF[item]]!.name;
      const plain = [weaponDefOf(sim, gun)!.name, weaponDefOf(sim, gun)!.shortName, moduleNameOf(sim, gun), weaponShortOf(sim, gun)];
      expect(plain[2], item).toBe(moduleName);
      const m = sim.world.get(gun, ModuleC) as { upgrade?: string };
      m.upgrade = item;
      const [name, short] = NAMES[item]!;
      expect(weaponDefOf(sim, gun)).toMatchObject({ name, shortName: short });
      expect(moduleNameOf(sim, gun), item).toBe(name);
      expect(weaponShortOf(sim, gun), item).toBe(short);
      expect((content.modules as Record<string, ModuleDef>)[WEAPON_OF[item]]!.name, 'module def untouched').toBe(moduleName);
      delete m.upgrade;
      expect([weaponDefOf(sim, gun)!.name, weaponDefOf(sim, gun)!.shortName, moduleNameOf(sim, gun), weaponShortOf(sim, gun)]).toEqual(plain);
    }
  });

  it('general upgrades keep the weapon name', () => {
    const { sim, gun } = gunSetup('module.burstLaser');
    const before = moduleNameOf(sim, gun);
    for (const item of ['item.upg_coolant', 'item.upg_capacitor', 'item.upg_housing']) {
      (sim.world.get(gun, ModuleC) as { upgrade?: string }).upgrade = item;
      expect(moduleNameOf(sim, gun), item).toBe(before);
    }
  });
});
