import { describe, expect, it } from 'vitest';
import { CrewC, HealthC, PositionC } from '../crew/components';
import { DownedC } from '../crew/components';
import { Sim } from '../sim';
import { CREW_MAX_HP } from '../tuning';
import type { Faction } from '../combat/components';
import { StationCrewC, WantedC } from '../stations/components';
import { AlienC } from '../aliens/components';
import { AllegianceC, SurrenderedC } from './components';
import { isPlayerFoe, playerFoes } from './relations';

function person(sim: Sim, faction: Faction): number {
  const id = sim.world.createEntity();
  sim.world.add(id, CrewC, { name: 'T', role: 'role.civ', species: 'species.human', appearanceSeed: 1, activity: 'idle' });
  sim.world.add(id, PositionC, { x: 1, y: 1, toX: 1, toY: 1, progress: 0, facing: 0 });
  sim.world.add(id, HealthC, { hp: CREW_MAX_HP, max: CREW_MAX_HP });
  sim.world.add(id, AllegianceC, { faction });
  return id;
}

describe('isPlayerFoe', () => {
  const make = () => new Sim(1, { ships: {}, roles: {}, species: {}, modules: {}, crewNames: [], items: {}, recipes: {}, structCosts: {} });

  it('is false for the player side, neutral crew and with no player crew at all', () => {
    const sim = make();
    const raider = person(sim, 'hostile');
    expect(isPlayerFoe(sim, raider)).toBe(false); // nobody of the player's to be hostile to
    const mine = person(sim, 'player');
    const trader = person(sim, 'neutral');
    expect(isPlayerFoe(sim, mine)).toBe(false);
    expect(isPlayerFoe(sim, trader)).toBe(false);
    expect(isPlayerFoe(sim, raider)).toBe(true);
  });

  it('drops a boarder who surrenders or is downed', () => {
    const sim = make();
    person(sim, 'player');
    const a = person(sim, 'hostile');
    const b = person(sim, 'hostile');
    const c = person(sim, 'hostile');
    sim.world.add(a, SurrenderedC, { tick: 0 });
    sim.world.add(b, DownedC, { stabilized: false, bed: 0 } as never);
    expect(playerFoes(sim)).toEqual([c]);
  });

  it('counts station crew only once the player is wanted there; aliens always', () => {
    const sim = make();
    const mine = person(sim, 'player');
    const guard = person(sim, 'neutral');
    sim.world.add(guard, StationCrewC, { station: 7 });
    const alien = person(sim, 'alien');
    sim.world.add(alien, AlienC, {} as never);
    expect(isPlayerFoe(sim, guard)).toBe(false);
    expect(isPlayerFoe(sim, alien)).toBe(true);
    sim.world.add(mine, WantedC, { station: 7 });
    expect(isPlayerFoe(sim, guard)).toBe(true);
    sim.world.get(mine, WantedC)!.station = 8;
    expect(isPlayerFoe(sim, guard)).toBe(false);
  });
});
