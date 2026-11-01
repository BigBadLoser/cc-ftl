import { expect } from 'vitest';
import { content } from '../../../src/content';
import type { ContentRegistry, ModuleDef, ShipTemplate } from '../../../src/sim';
import type { Variant } from '../templates';
import { variants as lancer } from './lancer';
import { variants as prospector } from './prospector';
import { variants as wayfarer } from './wayfarer';

/** The starter ships' kit rules (src/content/ships/starterShips.test.ts) for the hand-drawn variants' tests. */
export const mods: Record<string, ModuleDef> = content.modules;
export const count = (t: ShipTemplate, f: (d: ModuleDef, id: string) => boolean): number => t.modules!.filter((m) => f(mods[m.def]!, m.def)).length;

export const SHIPS: { ship: string; variants: Variant[]; kit: (t: ShipTemplate) => void }[] = [
  { ship: 'wayfarer', variants: wayfarer, kit: (t) => {
    expect(count(t, (d) => !!d.weapon)).toBe(1);
    expect(count(t, (d) => !!d.shieldGen)).toBe(1);
    expect(count(t, (_, id) => id === 'module.vehicle_bay')).toBe(1);
    expect(t.crew).toEqual(['role.engineer', 'role.gunner', 'role.pilot', 'role.medic']);
  } },
  { ship: 'prospector', variants: prospector, kit: (t) => {
    expect(t.modules!.find((m) => m.def === 'module.pod_bay')?.vehicle).toBe('vehicle.mining_pod');
    expect(count(t, (_, id) => id === 'module.refinery')).toBe(1);
    expect(count(t, (_, id) => id.startsWith('module.storage_ore'))).toBeGreaterThanOrEqual(2);
    expect(count(t, (d) => !!d.weapon)).toBe(1);
    expect(count(t, (_, id) => id === 'module.shieldGen')).toBe(1);
    expect(count(t, (_, id) => id === 'module.vehicle_bay')).toBe(0);
    expect(t.crew).toHaveLength(3);
  } },
  { ship: 'lancer', variants: lancer, kit: (t) => {
    expect(count(t, (d) => !!d.weapon)).toBe(3);
    expect(count(t, (_, id) => id === 'module.shieldGen.mk2')).toBe(1);
    expect(t.crew!.filter((r) => r === 'role.gunner')).toHaveLength(2);
    expect(t.crew).toHaveLength(4);
    expect(count(t, (d) => !!d.storage && !d.container)).toBeLessThanOrEqual(4);
    expect(count(t, (_, id) => id === 'module.vehicle_bay')).toBe(0);
  } },
];

/** A content registry with the variant registered as `ship.variant`. */
export const withShip = (t: ShipTemplate): ContentRegistry => ({ ...content, ships: { ...content.ships, 'ship.variant': t } });

