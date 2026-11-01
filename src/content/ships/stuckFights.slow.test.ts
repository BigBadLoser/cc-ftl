import { describe, expect, it } from 'vitest';
import { ShipC, newGame, type ContentRegistry, type ShipTemplate, type Sim } from '../../sim';
import { shipIds } from '../../sim/regions';
import { content } from '../index';

/**
 * Stuck fights (issue #225), part 1: ship-wide fire aims at what still stands, so a big ship with the guns left on the ship wrecks in bounded
 * time. `npx vitest run src/content/ships/stuckFights.slow.test.ts --disableConsoleIntercept` prints the times to kill.
 */
type Mod = NonNullable<ShipTemplate['modules']>[number];

/** The player's gun ship: two bays of the weapon, a reactor and a weapons console. */
function gunShip(weapon: string): ShipTemplate {
  return {
    name: 'Gun', crew: ['role.gunner'],
    rows: ['##############', '#____________#', '#____________#', '#____________#', '#____________#', '#____________#', '#____________#', '#____________#', '##############'],
    modules: [
      { def: 'module.reactor', x: 1, y: 1, rot: 0 },
      { def: 'module.weaponsConsole', x: 6, y: 1, rot: 0 },
      { def: weapon, x: 9, y: 1, rot: 0 },
      { def: weapon, x: 9, y: 5, rot: 0 },
    ],
  };
}

/** A big crewless hulk (44 x 14): a reactor and storage crates spread over the deck, so ship-centre fire alone could never reach them all. */
function bigHulk(): ShipTemplate {
  const W = 44;
  const H = 14;
  const rows = Array.from({ length: H }, (_, y) => (y === 0 || y === H - 1 ? '#'.repeat(W) : `#${'_'.repeat(W - 2)}#`));
  const modules: Mod[] = [{ def: 'module.reactor', x: 2, y: 2, rot: 0 }];
  for (let y = 2; y < H - 2; y += 3) for (let x = 6; x < W - 2; x += 4) modules.push({ def: 'module.storage', x, y, rot: 0 });
  return { name: 'Hulk', crew: [], rows, modules };
}

function fight(weapon: string, target: ShipTemplate, seed = 1): Sim {
  const reg: ContentRegistry = { ...content, ships: { ...content.ships, 'ship.gun': gunShip(weapon), 'ship.target': target } };
  const sim = newGame(seed, reg, 'ship.gun');
  sim.enqueue({ type: 'debug.spawnEnemy', template: 'ship.target', x: 100, y: 50 });
  sim.step();
  const [me, them] = shipIds(sim) as [number, number];
  sim.enqueue({ type: 'combat.setTarget', ship: me, weaponId: null, targetShip: them, targetModuleId: 0 });
  return sim;
}

/** Seconds until the enemy ship is a wreck, or null within `maxSec`. */
function timeToWreck(sim: Sim, maxSec: number): number | null {
  const them = shipIds(sim)[1]!;
  for (let i = 0; i < maxSec * 20; i++) {
    sim.step();
    sim.events.drain();
    if (sim.world.get(them, ShipC)?.state === 'wreck') return i / 20;
  }
  return null;
}

describe('ship-wide fire wears a ship down (issue #225)', () => {
  it('a big ship with the guns left on the ship (no module picked) wrecks within 8 minutes', () => {
    const sim = fight('module.burstLaser', bigHulk());
    const t = timeToWreck(sim, 8 * 60);
    console.log(`big hulk, two burst lasers, ship-wide: ${t === null ? 'no wreck in 8 min' : `${t.toFixed(0)} s`}`);
    expect(t).not.toBeNull();
  });

  it('the raider (no shields, no crew) still goes down to ship-wide fire', () => {
    const raider = content.ships['ship.raider'];
    const target: ShipTemplate = { ...raider, crew: [], modules: raider.modules!.filter((m) => m.def !== 'module.shieldGen') };
    const sim = fight('module.burstLaser', target);
    const t = timeToWreck(sim, 8 * 60);
    console.log(`raider, two burst lasers, ship-wide: ${t === null ? 'no wreck in 8 min' : `${t.toFixed(0)} s`}`);
    expect(t).not.toBeNull();
  });
});
