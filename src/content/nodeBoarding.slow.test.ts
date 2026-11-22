import { describe, expect, it } from 'vitest';
import { ShipC, WeaponC } from '../sim/combat/components';
import { PositionC } from '../sim/crew/components';
import { AllegianceC } from '../sim/fight/components';
import { isHostile, isInvader } from '../sim/fight/relations';
import { engagements } from '../sim/galaxy/engagements';
import { ModuleC } from '../sim/modules/components';
import { shipIdOf } from '../sim/regions';
import type { Sim } from '../sim/sim';
import { TICK_HZ } from '../sim/time';
import { BoarderC } from '../sim/vehicles/components';
import { eventsOf } from '../../test/support/sim';
import { run } from '../../test/support/run';
import { fight, shipOf } from '../../test/support/content';
import { expectReplayable } from '../../test/support/world';

/**
 * NPCs board each other as they board the player (#603; ARCHITECTURE.md "One answer per question": one system for each thing, whoever acts). A raider
 * clan ship (boarding doctrine) meets a trader in the player's node; the player stands well with the raiders, so both are neutral to the player and
 * nothing but the fight between them is going on. The trader's guns are taken out so the party gets across.
 */
function raid(): { sim: Sim; raider: number; trader: number; fa: ReturnType<typeof fight>['fa']; fb: ReturnType<typeof fight>['fb'] } {
  const { sim, fa, fb } = fight(['raiders', 'raider'], ['traders', 'trader'], { raiders: 10 });
  const raider = shipOf(fa);
  const trader = shipOf(fb);
  for (const m of sim.world.query(WeaponC, ModuleC)) if (shipIdOf(sim, sim.world.get(m, ModuleC) as { x: number; y: number }) === trader) sim.world.remove(m, WeaponC);
  (sim.world.get(raider, BoarderC) as { afterTicks: number }).afterTicks = 0; // the party goes as soon as the fight starts
  return { sim, raider, trader, fa, fb };
}

const party = (sim: Sim, raider: number): number[] => sim.world.query(AllegianceC).filter((c) => sim.world.get(c, AllegianceC)?.ship === raider);
const onShip = (sim: Sim, crew: number): number => shipIdOf(sim, sim.world.get(crew, PositionC));

describe('a boarding party in a fight between NPC ships', () => {
  it('docks at the foe it is fighting, its crew and the defenders fight, and taking the bridge takes the ship for the captor\'s fleet', () => {
    const { sim, raider, trader, fa, fb } = raid();
    expect(sim.world.get(raider, ShipC)?.faction).toBe('neutral');
    expect(sim.world.get(trader, ShipC)?.faction).toBe('neutral');
    const landed = run(sim, 90 * TICK_HZ, { until: (s) => party(s, raider).some((c) => onShip(s, c) === trader) });
    expect(eventsOf(landed, 'vehicle.docked')).toMatchObject([{ ship: trader }]);
    const aboard = party(sim, raider).filter((c) => onShip(sim, c) === trader);
    expect(aboard.length).toBeGreaterThan(0);
    const [boarder] = aboard as [number];
    expect(isInvader(sim, boarder)).toBe(true);
    const defender = sim.world.query(AllegianceC, PositionC).find((c) => onShip(sim, c) === trader && sim.world.get(c, AllegianceC)?.ship === undefined) as number;
    expect(isHostile(sim, boarder, defender)).toBe(true);
    const blows = eventsOf(run(sim, 10 * TICK_HZ), 'crew.attacked');
    expect(blows.some((b) => aboard.includes(b.crew))).toBe(true);
    expect(blows.some((b) => !aboard.includes(b.crew) && aboard.includes(b.target))).toBe(true);

    // The party wins and holds the bridge: the ship is taken. It joins the captor's fleet, the fight ends as taken, the news says so.
    const out = run(sim, 90 * TICK_HZ, { until: (s) => engagements(s).length === 0 });
    expect(eventsOf(out, 'engagement.ended')).toMatchObject([{ winner: 0, stats: false, taken: true }]);
    expect(fa.ships.map((c) => [c.faction, c.ship])).toEqual([['raiders', raider], ['raiders', trader]]);
    expect(fb.ships).toEqual([]);
    expect(sim.galaxy.ports[fb.home]?.queue).toEqual([{ faction: 'traders', role: 'trader', size: 'small' }]);
    expect(sim.galaxy.news.filter((n) => n.kind === 'taken')).toMatchObject([{ who: fa.ships[0]?.name, foe: 'traders trader', faction: 'raiders' }]);
    expect(sim.galaxy.news.some((n) => n.kind === 'destroyed' || n.kind === 'driven')).toBe(false);
    expect(sim.world.get(trader, ShipC)?.state).toBe('active');
  });

  it('plays the same on a replay and across a save', () => {
    expectReplayable(() => raid().sim, 30 * TICK_HZ, { saveAt: 20 * TICK_HZ });
  });
});
