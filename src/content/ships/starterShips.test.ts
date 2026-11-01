import { describe, expect, it } from 'vitest';
import type { ModuleDef, ShipTemplate } from '../../sim';
import { CrewC, ModuleC, PositionC, homeShip, hullLoad, newGame, shipGrid, type Sim } from '../../sim';
import { validateTemplate } from '../../sim/shipgen';
import { content } from '../index';
import { starterShips } from './starterShips';

const mods: Record<string, ModuleDef> = content.modules;
const ships: Record<string, ShipTemplate> = content.ships;
const run = (sim: Sim, n: number): void => { for (let i = 0; i < n; i++) sim.step(); };
const defsOf = (sim: Sim, f: (d: ModuleDef) => boolean): number =>
  sim.world.query(ModuleC).filter((id) => f(mods[sim.world.get(id, ModuleC)!.def]!)).length;

describe.each(starterShips)('starter ship $name', (s) => {
  it('is a valid template: on the floor, reachable, powered, sealed, with a helm, engines and an airlock', () => {
    expect(validateTemplate(s.template, mods)).toEqual([]);
    expect(s.template.modules!.some((m) => m.def === 'module.airlock')).toBe(true);
  });

  it('builds with its crew, every module powered, every room lit and breathable, and survives a minute without losses', () => {
    const sim = newGame(1, content, s.id);
    run(sim, 20 * 60);
    expect(sim.world.query(CrewC)).toHaveLength(s.template.crew!.length);
    const mods = sim.world.query(ModuleC).map((i) => sim.world.get(i, ModuleC)!);
    expect(mods.filter((m) => !m.powered).map((m) => m.def)).toEqual([]);
    const g = shipGrid(sim, homeShip(sim))!;
    const room = g.load('room');
    const dark: number[] = [];
    for (let i = 0; i < room.length; i++) if (room[i] !== 0 && (g.load('light')[i] as number) < 40) dark.push(i);
    expect(dark.map((i) => `${i % g.width},${Math.floor(i / g.width)}`)).toEqual([]);
    const o2 = g.load('o2');
    for (const r of new Set(room)) {
      if (r === 0) continue;
      const tiles: number[] = [];
      room.forEach((v, i) => { if (v === r) tiles.push(i); });
      expect(tiles.reduce((a, i) => a + (o2[i] as number), 0) / tiles.length, `room ${r} air`).toBeGreaterThan(18);
    }
    expect(sim.events.drain().some((e) => e.type === 'crew.died' || e.type === 'crew.downed')).toBe(false);
  });

  it('has power and life support for its crew, beds for each, a galley and a pilot console', () => {
    const sim = newGame(1, content, s.id);
    const crew = s.template.crew!.length;
    expect(defsOf(sim, (d) => !!d.bed)).toBeGreaterThanOrEqual(crew);
    expect(defsOf(sim, (d) => !!d.galley)).toBeGreaterThanOrEqual(1);
    expect(defsOf(sim, (d) => d.console === 'helm')).toBe(1);
    expect(defsOf(sim, (d) => (d.o2PerSec ?? 0) > 0)).toBeGreaterThanOrEqual(2);
    expect(s.template.crew).toContain('role.pilot');
    expect(s.template.crew).toContain('role.engineer');
  });

  it('keeps its crew aboard and moving: each stands on the ship after a short run', () => {
    const sim = newGame(1, content, s.id);
    run(sim, 20 * 20);
    const g = shipGrid(sim, homeShip(sim))!;
    for (const id of sim.world.query(CrewC)) {
      const p = sim.world.get(id, PositionC)!;
      expect(g.get('room', Math.floor(p.x), Math.floor(p.y))).not.toBe(0);
    }
  });

  it('fits its engines (hull area within jump capacity) and ships as listed, with a blurb', () => {
    const sim = newGame(1, content, s.id);
    const load = hullLoad(sim, homeShip(sim));
    expect(load.over, `${load.tiles} tiles on ${load.capacity}`).toBe(0);
    expect(load.ratio).toBeLessThan(0.85);
    expect(ships[s.id]).toBe(s.template);
    expect(s.blurb.length).toBeGreaterThan(20);
  });
});

/** What makes each ship itself: its kit, counted from the template. */
describe('starter ship identities', () => {
  const kit = (id: string) => {
    const t = starterShips.find((x) => x.id === id)!.template;
    const n = (pred: (d: ModuleDef) => boolean): number => t.modules!.filter((m) => pred(mods[m.def]!)).length;
    return { t, n, def: (d: string): number => t.modules!.filter((m) => m.def === d).length, gunners: t.crew!.filter((r) => r === 'role.gunner').length };
  };

  it('Wayfarer is balanced: one weapon, one shield, a shuttle, four crew with one of each role', () => {
    const k = kit('ship.wayfarer');
    expect(k.n((d) => !!d.weapon)).toBe(1);
    expect(k.n((d) => !!d.shieldGen)).toBe(1);
    expect(k.def('module.vehicle_bay')).toBe(1);
    expect(k.t.crew).toEqual(['role.engineer', 'role.gunner', 'role.pilot', 'role.medic']);
  });

  it('Prospector mines: a pod bay with its pod, a refinery, ore bins, one light gun, a Mk I shield, three crew', () => {
    const k = kit('ship.prospector');
    expect(k.t.modules!.find((m) => m.def === 'module.pod_bay')?.vehicle).toBe('vehicle.mining_pod');
    expect(k.def('module.refinery')).toBe(1);
    expect(k.def('module.storage_ore') + k.def('module.storage_ore_large')).toBeGreaterThanOrEqual(2);
    expect(k.n((d) => !!d.weapon)).toBe(1);
    expect(k.def('module.shieldGen')).toBe(1);
    expect(k.t.crew).toHaveLength(3);
    expect(k.def('module.vehicle_bay')).toBe(0);
  });

  it('Lancer fights: three weapons, a Mk II shield, two gunners, a small hold, no shuttle bay', () => {
    const k = kit('ship.lancer');
    expect(k.n((d) => !!d.weapon)).toBe(3);
    expect(k.def('module.shieldGen.mk2')).toBe(1);
    expect(k.gunners).toBe(2);
    expect(k.t.crew).toHaveLength(4);
    expect(k.n((d) => !!d.storage)).toBeLessThanOrEqual(4);
    expect(k.def('module.vehicle_bay')).toBe(0);
  });
});
