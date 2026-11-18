import { describe, expect, it } from 'vitest';
import { content } from '../index';
import type { OreDef } from '../../sim/asteroids/types';
import { ShipC } from '../../sim/combat/components';
import { homeShip } from '../../sim/combat/shipQuery';
import { CrewC, PositionC } from '../../sim/crew/components';
import { generateOutpost } from '../../sim/outposts/gen';
import { shipGrid } from '../../sim/regions';
import { deserialize, serialize } from '../../sim/save';
import type { Sim } from '../../sim/sim';
import { Struct } from '../../sim/structure';
import { isCabled } from '../../sim/cable';
import { ModuleC } from '../../sim/modules/components';
import { footprintTiles } from '../../sim/modules/footprint';
import { groundPort, isGroundMount } from '../../sim/modules/groundMount';
import { ownerAt, shipIdOf } from '../../sim/regions';
import { hostileAct } from '../../sim/combat/provoke';
import { factionsHostile } from '../../sim/combat/factions';
import { SuitC } from '../../sim/eva/components';
import { WeaponC } from '../../sim/combat/components';
import { mannedConsole } from '../../sim/combat/operators';
import { MODS, provoke, run, setup, type Ev } from '../../../test/support/fixtures/groundTurrets';

/** Ground turrets on an asteroid trading post (#514): guns and point defence out on the levelled rock, cabled to the base. */

const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

describe('ground turrets', () => {
  it('one hostile act wakes a neutral outpost and turns it hostile (#526)', () => {
    const { sim, base } = setup();
    expect(factionsHostile(sim.world.get(base, ShipC)!.faction, 'player')).toBe(false);
    expect(sim.world.get(base, ShipC)!.dormant).not.toBeUndefined();
    hostileAct(sim, base, 'fired');
    const s = sim.world.get(base, ShipC)!;
    expect(s.dormant).toBeUndefined();
    expect(factionsHostile(s.faction, 'player')).toBe(true);
  });

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

  it('every ground turret is a 3x3 ground mount, and its cable starts square on at the middle of the side its rotation faces', () => {
    for (const seed of [1, 2, 3]) {
      const { sim, turrets } = setup(seed);
      expect(turrets.length).toBeGreaterThan(1);
      const g = sim.sector.grid;
      for (const id of turrets) {
        const m = sim.world.get(id, ModuleC)!;
        const def = MODS[m.def]!;
        expect(isGroundMount(def), m.def).toBe(true);
        expect(def.footprint).toEqual([3, 3]);
        expect(def.asset).toMatch(/\.ground$/);
        const port = groundPort(def, m);
        // The port tile beside the middle of the side is cabled; the other three sides' middles are not the cable's start.
        expect(isCabled(g, port.cable.x, port.cable.y), `${m.def}@${m.x},${m.y} r${m.rot}`).toBe(true);
        expect(port.side).toEqual({ x: m.x + 1 + port.dir.x, y: m.y + 1 + port.dir.y });
      }
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
    const log: Ev[] = [];
    let low = Infinity;
    for (let k = 0; k < 12; k++) {
      for (const id of sim.world.query(WeaponC, ModuleC)) if (shipIdOf(sim, sim.world.get(id, ModuleC)!) === me) sim.world.get(id, WeaponC)!.charge = 1;
      sim.enqueue({ type: 'combat.fireVolley', ship: me });
      for (let i = 0; i < 10 * 20; i++) {
        log.push(...run(sim, 1));
        low = Math.min(low, sim.world.get(gun, ModuleC)!.hp);
      }
      // (the volleys run on in groundTurrets.slow; here they stop once the aim has landed and a missile was shot down)
      if (low < MODS[sim.world.get(gun, ModuleC)!.def]!.maxHp && log.some((e) => e.type === 'projectile.intercepted' && e.ship === base)) break;
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
    m.hp = max - 2; // lightly damaged (half its hit points in groundTurrets.slow)
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

describe('detached modules', () => {
  it('every greenhouse standing apart on a farmRows base has a cable chain to a base wall (hull and cable make one piece)', () => {
    const ctx = { ores: Object.values(content.ores) as OreDef[], modules: content.modules, stations: content.stations };
    let rows = 0;
    for (let seed = 1; seed <= 8; seed++) {
      const t = generateOutpost('surface', seed, ctx, 'farming')?.template;
      if (!t?.apart) continue;
      rows++;
      const w = Math.max(...t.rows.map((r) => r.length)), h = t.rows.length;
      const solid = (x: number, y: number): boolean => (t.rows[y]?.[x] ?? '.') !== '.' || t.cable?.[y]?.[x] === '+';
      const seen = new Set<number>(), stack: number[] = [];
      const start = t.rows.join('').indexOf('_');
      const at = (i: number): [number, number] => [i % w, Math.floor(i / w)];
      const first = t.rows.flatMap((r, y) => [...r].map((c, x) => (c === '_' ? y * w + x : -1))).find((i) => i >= 0) as number;
      expect(start).toBeGreaterThanOrEqual(0);
      stack.push(first); seen.add(first);
      while (stack.length > 0) {
        const [x, y] = at(stack.pop() as number);
        for (const [dx, dy] of N4) { const j = (y + dy) * w + x + dx; if (x + dx >= 0 && x + dx < w && y + dy >= 0 && y + dy < h && !seen.has(j) && solid(x + dx, y + dy)) { seen.add(j); stack.push(j); } }
      }
      const floors = t.rows.flatMap((r, y) => [...r].map((c, x) => (c === '_' ? y * w + x : -1))).filter((i) => i >= 0);
      expect(floors.filter((i) => !seen.has(i)), `seed ${seed}: floor cut off from the base`).toEqual([]);
    }
    expect(rows).toBeGreaterThan(0);
  });
});
