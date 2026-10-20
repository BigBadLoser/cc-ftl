import { describe, expect, it } from 'vitest';
import { BodyC, ModuleC, ShipC, StorageC, footprintTiles, generateShip, newGame, stampShip, type FactionDef, type ModuleDef, type ShipTemplate, type Sim } from '../../sim';
import { ContainerC } from '../../sim/containers/components';
import { applyRuin } from '../../sim/combat/derelict';
import { applyEffects } from '../../sim/combat/effects';
import { ruin } from '../../sim/shipgen/ruin';
import { Struct } from '../../sim/structure';
import { content } from '../index';
import { factions } from './index';

const defs = content.modules as Record<string, ModuleDef>;
const civ = factions['faction.civilian'] as FactionDef;
const freighterOnly: FactionDef = { ...civ, hullFamilies: (civ.hullFamilies ?? []).filter((h) => h.id === 'freighter') };
const freighter = (seed: number) => generateShip(freighterOnly, 'faction.civilian', seed, 0, defs);
const boxes = (t: ShipTemplate) => (t.modules ?? []).filter((m) => defs[m.def]?.container);

/** A freighter stamped as a prize at (40, 40) of a fresh game. */
function stamped(seed: number): { sim: Sim; ship: number } {
  const sim = newGame(1, content);
  const ship = stampShip(sim, freighter(seed).template, { faction: 'hostile', x: 300, y: 40, state: 'prize' });
  return { sim, ship };
}

describe('cargo containers', () => {
  it('generated freighters carry valid containers clamped on beam frames, with stock, no walk-in pods', () => {
    for (let seed = 1; seed <= 8; seed++) {
      const g = freighter(seed);
      expect(g.problems, `seed ${seed}`).toEqual([]);
      const ks = boxes(g.template);
      expect(ks.length, `seed ${seed}`).toBeGreaterThanOrEqual(4);
      for (const m of ks) {
        for (const t of footprintTiles(defs[m.def] as ModuleDef, m.x, m.y, m.rot)) expect(g.template.rows[t.y]?.[t.x]).toBe('=');
      }
      expect(ks.some((m) => m.stock?.length)).toBe(true);
      // No container rooms: cargo rooms left are the crew body's own stores, not 3x3 pods.
      expect(g.rooms.filter((r) => r.role === 'cargo').length).toBeLessThan(ks.length);
    }
  });

  it('is deterministic: the same seed gives the same freighter and the same ruin', () => {
    expect(JSON.stringify(freighter(5).template)).toBe(JSON.stringify(freighter(5).template));
    const a = ruin(freighter(5).template, 5, { defs, intensity: 0.8, cause: 'combat' });
    const b = ruin(freighter(5).template, 5, { defs, intensity: 0.8, cause: 'combat' });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('container.detach makes a drifting body with the same stock and frees its tiles', () => {
    const { sim, ship } = stamped(3);
    const id = sim.world.query(ContainerC).find((i) => (sim.world.get(i, StorageC)?.stacks.length ?? 0) > 0)!;
    expect(id).toBeDefined();
    const m = { ...sim.world.get(id, ModuleC)! };
    const stock = JSON.stringify(sim.world.get(id, StorageC)!.stacks);
    const tiles = footprintTiles(defs[m.def] as ModuleDef, m.x, m.y, m.rot);
    expect(tiles.every((t) => sim.sector.grid.get('struct', t.x, t.y) === Struct.Beam && sim.sector.grid.get('module', t.x, t.y) === id)).toBe(true);
    sim.enqueue({ type: 'container.detach', id });
    sim.step();
    const ev = sim.events.drain();
    expect(ev.some((e) => e.type === 'container.detached' && e.container === id && e.ship === ship)).toBe(true);
    expect(sim.world.has(id, ModuleC)).toBe(false);
    expect(sim.world.get(id, ContainerC)!.state).toBe('drifting');
    expect(JSON.stringify(sim.world.get(id, StorageC)!.stacks)).toBe(stock);
    for (const t of tiles) {
      expect(sim.sector.grid.get('struct', t.x, t.y)).toBe(Struct.Space);
      expect(sim.sector.grid.get('ship', t.x, t.y)).toBe(0);
      expect(sim.sector.grid.get('module', t.x, t.y)).toBe(0);
    }
    const b0 = { ...sim.world.get(id, BodyC)! };
    for (let i = 0; i < 60; i++) sim.step();
    const b1 = sim.world.get(id, BodyC)!;
    expect(Math.hypot(b1.x - b0.x, b1.y - b0.y)).toBeGreaterThan(0.05);
    // A second detach is refused.
    sim.events.drain();
    sim.enqueue({ type: 'container.detach', id });
    sim.step();
    expect(sim.events.drain().some((e) => e.type === 'command.rejected' && e.command === 'container.detach')).toBe(true);
  });

  it('containers take module damage; a destroyed one loses its stock', () => {
    const { sim, ship } = stamped(3);
    const id = sim.world.query(ContainerC).find((i) => (sim.world.get(i, StorageC)?.stacks.length ?? 0) > 0)!;
    const m = sim.world.get(id, ModuleC)!;
    const hit = { shipId: ship, x: m.x, y: m.y, projectile: 0, weapon: 'weapon.test' };
    applyEffects(sim, hit, [{ type: 'moduleDamage', amount: 10 }]);
    expect(m.hp).toBe((defs[m.def] as ModuleDef).maxHp - 10);
    expect(sim.world.get(id, StorageC)!.stacks.length).toBeGreaterThan(0);
    applyEffects(sim, hit, [{ type: 'moduleDamage', amount: 9999 }]);
    expect(m.hp).toBe(0);
    expect(sim.world.get(id, ContainerC)!.hp).toBe(0);
    expect(sim.world.get(id, StorageC)!.stacks).toEqual([]);
  });

  it('ruins tear some containers off as drifting bodies near the wreck, others stay sealed, breached or destroyed', () => {
    let torn = 0;
    let clamped = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const g = freighter(seed);
      const r = ruin(g.template, seed, { defs, intensity: 0.8, cause: 'combat' });
      const ks = r.meta.containers;
      expect(ks.length).toBeGreaterThan(0);
      for (const k of ks.filter((q) => q.fate !== 'torn')) expect(defs[r.template.modules?.[k.index as number]?.def ?? '']?.container).toBe(true);
      torn += ks.filter((k) => k.fate === 'torn').length;
      clamped += ks.filter((k) => k.fate !== 'torn').length;
      if (!ks.some((k) => k.fate === 'torn')) continue;
      const sim = newGame(1, content);
      const ship = stampShip(sim, r.template, { faction: 'hostile', x: 300, y: 60, state: 'prize' });
      applyRuin(sim, ship, r.template, r.meta);
      const bodies = sim.world.query(ContainerC, BodyC).filter((i) => sim.world.get(i, ContainerC)!.state === 'drifting');
      expect(bodies.length).toBe(ks.filter((k) => k.fate === 'torn').length);
      const s = sim.world.get(ship, ShipC)!;
      for (const b of bodies.map((i) => sim.world.get(i, BodyC)!)) {
        expect(b.x).toBeGreaterThan(s.x - 20);
        expect(b.x).toBeLessThan(s.x + s.width + 20);
        expect(b.y).toBeGreaterThan(s.y - 20);
        expect(b.y).toBeLessThan(s.y + s.height + 20);
      }
    }
    expect(torn).toBeGreaterThan(0);
    expect(clamped).toBeGreaterThan(0);
  });
});
