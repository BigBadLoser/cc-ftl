import { describe, expect, it } from 'vitest';
import { AllegianceC, CrewC, DeadC, DownedC, EquipC, FighterC, SurrenderedC, HealthC, PositionC, newGame, spawnCrew, type Sim, type SimEvent } from '../../sim';
import { content } from '../index';
import { shipIdOf, shipIds } from '../../sim/regions';

const run = (sim: Sim, n: number): SimEvent[] => {
  const out: SimEvent[] = [];
  for (let i = 0; i < n; i++) {
    sim.step();
    out.push(...sim.events.drain());
  }
  return out;
};
const ownShip = (sim: Sim): number => shipIds(sim)[0] as number;
const player = (sim: Sim): number[] => sim.world.query(CrewC).filter((c) => sim.world.get(c, AllegianceC)?.faction === 'player' && shipIdOf(sim, sim.world.get(c, PositionC)) === ownShip(sim));
const down = (sim: Sim, c: number): boolean => sim.world.has(c, DownedC) || sim.world.has(c, DeadC);

/** Land `n` hostile boarders (sidearms) on the player's ship. */
function land(sim: Sim, n: number): number[] {
  const boarders = spawnCrew(sim, ownShip(sim), Array(n).fill('role.security'));
  for (const b of boarders) {
    sim.world.add(b, AllegianceC, { faction: 'hostile' });
    sim.world.add(b, EquipC, { weapon: 'item.sidearm' });
  }
  return boarders;
}

describe('combat onboarding: undrafted crew vs boarders', () => {
  it('gunners arm themselves from storage in peacetime, so they can fight without a draft', () => {
    const sim = newGame(1, content);
    run(sim, 20 * 40);
    const gunner = player(sim).find((c) => sim.world.get(c, CrewC)?.role === 'role.gunner')!;
    expect(sim.world.get(gunner, EquipC)?.weapon).toBeTruthy();
  });

  it('an armed gunner fights a boarder undrafted and wins; the unarmed keep clear', () => {
    const sim = newGame(1, content);
    run(sim, 20 * 40);
    const [boarder] = land(sim, 1) as [number];
    const ev = run(sim, 20 * 90);
    const crewShots = ev.filter((e) => e.type === 'crew.attacked' && player(sim).includes(e.crew));
    expect(crewShots.length).toBeGreaterThan(0);
    expect(down(sim, boarder) || sim.world.has(boarder, SurrenderedC)).toBe(true); // downed, dead or surrendered
    expect(player(sim).filter((c) => !down(sim, c)).length).toBeGreaterThanOrEqual(4);
    // Ship clear: nobody is left in a fighting mode and crew are back on colony duty.
    expect(player(sim).every((c) => (sim.world.get(c, FighterC)?.mode ?? 'idle') === 'idle')).toBe(true);
  });

  it('two armed boarders against one gunner at least draw blood', () => {
    const sim = newGame(1, content);
    run(sim, 20 * 40);
    const boarders = land(sim, 2);
    const ev = run(sim, 20 * 30);
    expect(ev.some((e) => e.type === 'crew.hit' && boarders.includes(e.target))).toBe(true);
  });

  it('unarmed crew keep out of the open while boarders are aboard, then go back to work', () => {
    const sim = newGame(1, content);
    run(sim, 20 * 5);
    const boarders = land(sim, 1);
    const b = boarders[0] as number;
    sim.world.get(b, HealthC)!.hp = 1e9;
    sim.world.get(b, HealthC)!.max = 1e9;
    run(sim, 20 * 4);
    const fleeing = player(sim).filter((c) => sim.world.get(c, FighterC)?.mode === 'flee');
    const unarmed = player(sim).filter((c) => !sim.world.get(c, EquipC)?.weapon);
    expect(unarmed.length).toBeGreaterThanOrEqual(3);
    expect(unarmed.every((c) => fleeing.includes(c))).toBe(true); // seen or not
    // Once the intruder is gone they drop the flee mode and are free for jobs again.
    sim.world.remove(b, AllegianceC);
    sim.world.add(b, AllegianceC, { faction: 'player' });
    run(sim, 20 * 2);
    expect(player(sim).every((c) => (sim.world.get(c, FighterC)?.mode ?? 'idle') === 'idle')).toBe(true);
  });
});
