/** Shared setup for the ship-combat tests: a small gun ship, a passive dummy target, duels and a raider fight. */
import { CombatC } from '../../../src/sim/combat/components';
import { spawnCrew } from '../../../src/sim/combat/ships';
import { StorageC } from '../../../src/sim/items/components';
import { ModuleC } from '../../../src/sim/modules/components';
import { newGame } from '../../../src/sim/newGame';
import type { ContentRegistry, ShipTemplate } from '../../../src/sim/registry';
import { shipIdOf } from '../../../src/sim/regions';
import type { Sim } from '../../../src/sim/sim';
import { content } from '../content';
import { nth } from '../sim';

export type Mod = NonNullable<ShipTemplate['modules']>[number];

/** A 14x9 test hull: reactor, weapons console (chair at (6, 2)), one weapon bay, a clear lane, optional extras. */
export function gunShip(weapon: string, crew: string[], extra: Mod[] = [], faction?: 'hostile'): ShipTemplate {
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
export const dummy: ShipTemplate = { ...content.ships['ship.raider'], crew: [] };
export const dummyNoShield: ShipTemplate = {
  ...dummy, modules: dummy.modules!.filter((m) => m.def !== 'module.shieldGen'),
};
export const withMissiles: Mod = { def: 'module.storage', x: 5, y: 6, rot: 2, stock: [{ item: 'item.missile', count: 20 }] };

export function registry(ships: Record<string, ShipTemplate>): ContentRegistry {
  return { ...content, ships: { ...content.ships, ...ships } };
}
export const modulesOf = (sim: Sim, n: number, def: string): number[] =>
  sim.world.query(ModuleC).filter((i) => shipIdOf(sim, sim.world.get(i, ModuleC)) === nth(sim, n) && sim.world.get(i, ModuleC)!.def === def);
export const combatOf = (sim: Sim, n: number) => sim.world.get(nth(sim, n), CombatC)!;
export const aim = (sim: Sim, from: number, to: number, moduleId = 0): void =>
  sim.enqueue({ type: 'combat.setTarget', ship: nth(sim, from), weaponId: null, targetShip: nth(sim, to), targetModuleId: moduleId });

/** Player gun ship (grid 1) facing a hostile target template (grid 2). */
export function duel(weapon: string, target: ShipTemplate, opts: { crew?: string[]; extra?: Mod[]; seed?: number } = {}): Sim {
  const reg = registry({ 'ship.gun': gunShip(weapon, opts.crew ?? ['role.gunner'], opts.extra), 'ship.target': target });
  const sim = newGame(opts.seed ?? 1, reg, 'ship.gun');
  sim.enqueue({ type: 'debug.spawnEnemy', template: 'ship.target', x: 100, y: 50 });
  sim.step(); // the enemy exists now, so tests can look up its module ids
  sim.events.drain();
  return sim;
}

export function countAmmo(sim: Sim, crate: number): number {
  const s = sim.world.get(crate, StorageC)!;
  return s.stacks.filter((x) => x.item === 'item.missile').reduce((n, x) => n + x.count, 0);
}

/** The player's own ship against a raider, weapons free. */
export const fightSim = (seed: number): Sim => {
  const sim = newGame(seed, content);
  sim.enqueue({ type: 'debug.spawnEnemy', template: 'ship.raider', x: 100, y: 50 });
  sim.enqueue({ type: 'combat.setHold', ship: nth(sim, 1), hold: false });
  return sim;
};
/** Aim the player's weapons at the raider's reactor. */
export const withTargets = (sim: Sim): Sim => {
  sim.enqueue({ type: 'combat.setTarget', ship: nth(sim, 1), weaponId: null, targetShip: nth(sim, 2), targetModuleId: modulesOf(sim, 2, 'module.reactor')[0] as number });
  return sim;
};

/** The incendiary duel: a hostile fire-launcher ship (grid 2) shoots the player's fabricator, shield generator off, three hands on the hoses. */
export function arsonSim(): Sim {
  const reg = registry({ 'ship.arson': gunShip('module.incendiaryLauncher', ['role.gunner'], [], 'hostile') });
  const sim = newGame(1, reg);
  sim.enqueue({ type: 'debug.spawnEnemy', template: 'ship.arson', x: 100, y: 50 });
  sim.enqueue({ type: 'module.setEnabled', id: modulesOf(sim, 1, 'module.shieldGen')[0] as number, enabled: false });
  const fab = modulesOf(sim, 1, 'module.fabricator')[0] as number;
  sim.step(); // the raider exists once the spawn command has run: commands name it by ship id
  spawnCrew(sim, nth(sim, 1), ['role.engineer', 'role.engineer']); // three hands on the hoses: with crew no longer walking to the locker at the start (they carry sidearms), two lose the race on seed 1
  aim(sim, 2, 1, fab);
  return sim;
}
