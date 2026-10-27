import { describe, expect, it } from 'vitest';
import { CombatC, ProjectileC, ShipC, WeaponC, ModuleC, newGame, type ContentRegistry, type Sim, type SimEvent } from '../../sim';
import { content } from '../index';
import { shipGrid, shipIds } from '../../sim/regions';
import { Struct } from '../../sim/structure';

const nth = (sim: Sim, n: number): number => shipIds(sim)[n - 1] as number;
/** A raider with no crew, shields or engines: it cannot repair, block or dodge, so every shot lands. */
const target = {
  ...content.ships['ship.raider'], crew: [],
  modules: content.ships['ship.raider'].modules!.filter((m) => m.def !== 'module.shieldGen' && m.def !== 'module.engine'),
};
function duel(): Sim {
  const reg: ContentRegistry = { ...content, ships: { ...content.ships, 'ship.target': target } };
  const sim = newGame(1, reg);
  sim.enqueue({ type: 'debug.spawnEnemy', template: 'ship.target', x: 20, y: 90 });
  sim.step();
  sim.events.drain();
  return sim;
}
/** A floor tile of the enemy's interior with no module on it. */
function emptyFloor(sim: Sim): { x: number; y: number } {
  const g = shipGrid(sim, nth(sim, 2))!;
  for (let y = g.y0; y < g.y0 + g.height; y++)
    for (let x = g.x0; x < g.x0 + g.width; x++) if (g.get('struct', x, y) === Struct.Floor && g.get('module', x, y) === 0) return { x, y };
  throw new Error('no empty floor');
}
const aimAt = (sim: Sim, tile: { x: number; y: number }, weaponId: number | null = null, moduleId = 0): void =>
  sim.enqueue({ type: 'combat.setTarget', ship: nth(sim, 1), weaponId, targetShip: nth(sim, 2), targetModuleId: moduleId, targetTile: tile });

describe('combat.setTarget with a tile', () => {
  it('stores the tile on the ship-wide target or on one weapon, and keeps it as the modules change', () => {
    const sim = duel();
    const tile = emptyFloor(sim);
    aimAt(sim, tile);
    const w = sim.world.query(WeaponC)[0] as number;
    aimAt(sim, tile, w);
    sim.step();
    expect(sim.world.get(nth(sim, 1), CombatC)!.target).toEqual({ ship: nth(sim, 2), moduleId: 0, tile });
    expect(sim.world.get(w, WeaponC)!.target).toEqual({ ship: nth(sim, 2), moduleId: 0, tile });
    for (const m of sim.world.query(ModuleC)) sim.world.get(m, ModuleC)!.hp = Math.min(sim.world.get(m, ModuleC)!.hp, 1);
    for (let i = 0; i < 5; i++) sim.step();
    expect(sim.world.get(nth(sim, 1), CombatC)!.target?.tile).toEqual(tile);
  });

  it('rejects a tile in space, off the ship, or combined with a module', () => {
    const sim = duel();
    const enemy = sim.world.get(nth(sim, 2), ShipC)!;
    const g = shipGrid(sim, nth(sim, 2))!;
    const space = (() => { for (let x = g.x0; x < g.x0 + g.width; x++) for (let y = g.y0; y < g.y0 + g.height; y++) if (g.get('struct', x, y) === Struct.Space) return { x, y }; return null; })();
    const bad = [{ x: enemy.x - 5, y: enemy.y }, { x: enemy.x + 0.5, y: enemy.y + 1 }, ...(space ? [space] : [])];
    for (const t of bad) aimAt(sim, t);
    const mod = sim.world.query(ModuleC).find((m) => sim.world.get(m, ModuleC)!.x >= enemy.x)!;
    aimAt(sim, emptyFloor(sim), null, mod);
    const events = [] as SimEvent[];
    sim.step();
    events.push(...sim.events.drain());
    expect(events.filter((e) => e.type === 'command.rejected')).toHaveLength(bad.length + 1);
    expect(sim.world.get(nth(sim, 1), CombatC)!.target).toBeNull();
  });

  it('fires at the tile and the hits land near it, spread by the weapon', { timeout: 120000 }, () => {
    const sim = duel();
    const tile = emptyFloor(sim);
    aimAt(sim, tile);
    sim.enqueue({ type: 'combat.setHold', ship: nth(sim, 1), hold: false });
    const aimed: { x: number; y: number }[] = [];
    const hits: { x: number; y: number }[] = [];
    for (let t = 0; t < 3000 && hits.length < 30; t++) {
      sim.step();
      for (const e of sim.events.drain()) if (e.type === 'projectile.hit' && e.ship === nth(sim, 2)) hits.push({ x: e.x, y: e.y });
      for (const p of sim.world.query(ProjectileC)) aimed.push({ x: sim.world.get(p, ProjectileC)!.x1, y: sim.world.get(p, ProjectileC)!.y1 });
    }
    expect(hits.length).toBeGreaterThanOrEqual(30);
    for (const a of aimed) expect(a).toEqual({ x: tile.x + 0.5, y: tile.y + 0.5 });
    const dist = hits.map((h) => Math.hypot(h.x - tile.x, h.y - tile.y));
    expect(Math.max(...dist)).toBeLessThanOrEqual(8); // gaussian spread of 1 tile: never far
    expect(dist.filter((d) => d <= 2).length / dist.length).toBeGreaterThan(0.7);
    expect(dist.some((d) => d > 0)).toBe(true); // spread: not every hit exactly on the tile
  });
});
