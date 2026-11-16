import { describe, expect, it } from 'vitest';
import { content } from '../index';
import { CrewC, PositionC, ShipC, Struct, deserialize, homeShip, newGame, serialize, shipGrid, type Sim } from '../../sim';
import { isCabled } from '../../sim/cable';
import type { ModuleDef } from '../../sim';
import { ModuleC } from '../../sim/modules/components';
import { footprintTiles } from '../../sim/modules/footprint';
import { ownerAt, shipIdOf } from '../../sim/regions';
import { hostileAct } from '../../sim/combat/provoke';
import { SuitC } from '../../sim/eva/components';
import { WeaponC } from '../../sim/combat/components';
import { mannedConsole } from '../../sim/combat/operators';

const MODS: Record<string, ModuleDef> = content.modules;

/** Ground turrets on an asteroid trading post (#514): guns and point defence out on the levelled rock, cabled to the base. */

function run(sim: Sim, n: number): { type: string; ship?: number }[] {
  const log: { type: string; ship?: number }[] = [];
  for (let i = 0; i < n; i++) {
    sim.step();
    log.push(...(sim.events.drain() as { type: string; ship?: number }[]));
  }
  return log;
}

/** The starter ship plus a surface trading outpost (a prefab base); returns the base and its ground turrets. */
function setup(seed = 1): { sim: Sim; base: number; turrets: number[] } {
  const sim = newGame(2, content);
  sim.enqueue({ type: 'debug.spawnOutpost', style: 'surface', kind: 'trading', seed });
  sim.step();
  const base = [...sim.world.query(ShipC)].find((id) => sim.world.get(id, ShipC)?.outpost)!;
  const turrets = [...sim.world.query(ModuleC)].filter((id) => {
    const m = sim.world.get(id, ModuleC)!;
    const def = MODS[m.def];
    return (def?.weapon || def?.pointDefense) && sim.sector.grid.get('struct', m.x, m.y) === Struct.Ground;
  });
  return { sim, base, turrets };
}

/**
 * Provoke the base into a fight. A neutral outpost is dormant, and a hostile act on a dormant base only wakes it (stations/alarm,
 * combat/provoke.ts); the next one turns it.
 */
function provoke(sim: Sim, base: number): void {
  hostileAct(sim, base, 'fired');
  hostileAct(sim, base, 'fired');
}

const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

describe('ground turrets', () => {
  it('a prefab outpost stands its guns and point defence on the ground, each cabled to a hull wall and the base\'s', () => {
    const { sim, base, turrets } = setup();
    const defs = turrets.map((id) => MODS[sim.world.get(id, ModuleC)!.def]!);
    expect(defs.filter((d) => d.weapon).length).toBeGreaterThanOrEqual(1);
    expect(defs.filter((d) => d.pointDefense)).toHaveLength(1);
    const g = sim.sector.grid;
    for (const id of turrets) {
      const m = sim.world.get(id, ModuleC)!;
      const tiles = footprintTiles(MODS[m.def]!, m.x, m.y, m.rot);
      expect(tiles.every((t) => g.get('struct', t.x, t.y) === Struct.Ground && ownerAt(sim, t.x, t.y) === base)).toBe(true);
      expect(shipIdOf(sim, m)).toBe(base);
      // A cable from beside it, every tile the base's, run out a few tiles over the ground to one of the base's walls.
      const wire = tiles.flatMap((t) => N4.map(([dx, dy]) => ({ x: t.x + dx, y: t.y + dy }))).find((c) => isCabled(g, c.x, c.y));
      expect(wire).toBeDefined();
      const run = [wire!], seen = new Set([`${wire!.x},${wire!.y}`]);
      for (let k = 0; k < run.length; k++) for (const [dx, dy] of N4) {
        const c = { x: run[k]!.x + dx, y: run[k]!.y + dy };
        if (!seen.has(`${c.x},${c.y}`) && isCabled(g, c.x, c.y)) { seen.add(`${c.x},${c.y}`); run.push(c); }
      }
      expect(run.every((c) => ownerAt(sim, c.x, c.y) === base)).toBe(true);
      expect(run.length).toBeGreaterThanOrEqual(3);
      expect(run.some((c) => N4.some(([dx, dy]) => g.get('struct', c.x + dx, c.y + dy) === Struct.Wall && ownerAt(sim, c.x + dx, c.y + dy) === base))).toBe(true);
    }
  });

  it('in a fight the turrets draw the base\'s power, run out and fire from the command room\'s console', () => {
    const { sim, base, turrets } = setup();
    provoke(sim, base);
    const log = run(sim, 30 * 20);
    expect(sim.sector.inCombat).toBe(true);
    for (const id of turrets) expect(sim.world.get(id, ModuleC)!.powered, sim.world.get(id, ModuleC)!.def).toBe(true);
    expect(mannedConsole(sim, base, 'weapons')).not.toBeNull();
    const fired = log.filter((e) => e.type === 'weapon.fired' && e.ship === base) as { weaponId?: number; module?: number }[];
    expect(fired.length).toBeGreaterThan(0);
  });

  it('the enemy aims at a turret and damages it; the point-defence turret shoots down missiles', () => {
    const { sim, base, turrets } = setup();
    provoke(sim, base);
    const gun = turrets.find((id) => MODS[sim.world.get(id, ModuleC)!.def]?.weapon)!;
    const me = homeShip(sim);
    run(sim, 20); // the fight is on (the player's guns take the base as their target), then the aim at the turret
    sim.enqueue({ type: 'combat.setTarget', ship: me, weaponId: null, targetShip: base, targetModuleId: gun });
    const log: { type: string; ship?: number }[] = [];
    let low = Infinity;
    for (let k = 0; k < 12; k++) {
      for (const id of sim.world.query(WeaponC, ModuleC)) if (shipIdOf(sim, sim.world.get(id, ModuleC)!) === me) sim.world.get(id, WeaponC)!.charge = 1;
      sim.enqueue({ type: 'combat.fireVolley', ship: me });
      for (let i = 0; i < 10 * 20; i++) {
        log.push(...run(sim, 1));
        low = Math.min(low, sim.world.get(gun, ModuleC)!.hp);
      }
    }
    expect(log.some((e) => e.type === 'projectile.hit' && e.ship === base && (e as { moduleId?: number }).moduleId === gun)).toBe(true);
    expect(low).toBeLessThan(MODS[sim.world.get(gun, ModuleC)!.def]!.maxHp);
    expect(log.some((e) => e.type === 'projectile.intercepted' && e.ship === base)).toBe(true);
  });

  it('a damaged turret is mended by a crew member who suits up and walks out over the ground', () => {
    const { sim, turrets } = setup();
    const id = turrets[0]!;
    const m = sim.world.get(id, ModuleC)!;
    const max = MODS[m.def]!.maxHp;
    m.hp = Math.round(max / 2);
    let suited = false;
    for (let i = 0; i < 240 * 20 && m.hp < max; i++) {
      sim.step();
      sim.events.drain();
      for (const c of sim.world.query(CrewC, PositionC)) {
        const p = sim.world.get(c, PositionC)!;
        if (sim.world.has(c, SuitC) && sim.sector.grid.get('struct', Math.round(p.x), Math.round(p.y)) === Struct.Ground) suited = true;
      }
    }
    expect(m.hp).toBe(max);
    expect(suited).toBe(true);
  });

  it('save and load keeps the cable', () => {
    const { sim, base } = setup();
    run(sim, 20);
    const b = deserialize(serialize(sim), content);
    const cabled = (s: Sim): number => {
      const g = shipGrid(s, base)!;
      let n = 0;
      for (let y = g.y0; y < g.y0 + g.height; y++) for (let x = g.x0; x < g.x0 + g.width; x++) if (isCabled(g, x, y)) n++;
      return n;
    };
    expect(cabled(sim)).toBeGreaterThan(0);
    expect(cabled(b)).toBe(cabled(sim));
    expect(serialize(b)).toBe(serialize(sim));
  });
});
