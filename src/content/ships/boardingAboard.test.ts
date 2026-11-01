import { describe, expect, it } from 'vitest';
import { CrewC, DeadC, HealthC, playerCrewAboard, type Sim } from '../../sim';
import { applyEffects } from '../../sim/combat/effects';
import { shipGrid } from '../../sim/regions';
import { content } from '../index';
import { dockParty, nth, setup } from './boardingFixture';

const alive = (sim: Sim, c: number): boolean => sim.world.has(c, CrewC) && !sim.world.has(c, DeadC);

describe('player crew on a hostile ship', () => {
  it('lists their rooms and tiles, empty for the player ship and once they are gone', () => {
    const sim = setup();
    const { party, shuttle } = dockParty(sim);
    const view = playerCrewAboard(sim, nth(sim, 2));
    expect(view.crew).toEqual([...party].sort((a, b) => a - b));
    expect(view.tiles.length).toBeGreaterThan(0);
    const grid = shipGrid(sim, nth(sim, 2))!;
    for (const t of view.tiles) expect(grid.inBounds(t.x, t.y)).toBe(true);
    expect(view.rooms.every((r) => r > 0)).toBe(true);
    expect(playerCrewAboard(sim, nth(sim, 1))).toEqual({ crew: [], tiles: [], rooms: [] });
    for (const c of party) sim.world.add(c, DeadC, { tick: 0 });
    expect(playerCrewAboard(sim, nth(sim, 2)).crew).toEqual([]);
    void shuttle;
  });

  it('are hurt by tile-hit damage on that ship like anyone else (friendly fire is on)', () => {
    const sim = setup();
    const { party } = dockParty(sim);
    const at = playerCrewAboard(sim, nth(sim, 2)).tiles[0]!;
    const hp = party.map((c) => sim.world.get(c, HealthC)!.hp);
    const effects = content.weapons['weapon.burstLaser']!.effects;
    expect(effects.some((e) => e.type === 'crewDamage')).toBe(true);
    applyEffects(sim, { shipId: nth(sim, 2), x: at.x, y: at.y, projectile: 0, weapon: 'weapon.burstLaser' }, effects);
    const hurt = party.filter((c, i) => sim.world.get(c, HealthC)!.hp < hp[i]!);
    expect(hurt.length).toBeGreaterThan(0);
    for (const c of party) expect(alive(sim, c)).toBe(true);
  });
});
