import { describe, expect, it } from 'vitest';
import { AllegianceC, CrewC, PositionC, newGame, type Sim } from '../sim';
import { grant } from '../sim/consent/guests';
import { canDraft, fightsBareHanded, isLodger, onStationRoll, roleOf } from '../sim/consent/roles';
import { ForHireC, StationCrewC } from '../sim/stations/components';
import { playerShip } from '../sim/trade/player';
import { playerCrew } from '../sim/story/world';
import { content } from '.';

/** A new person on the first crew member's tile, on the given side. */
function person(sim: Sim, faction: 'rogue' | 'neutral'): number {
  const at = sim.world.get(playerCrew(sim)[0]!, PositionC)!;
  const before = new Set(sim.world.query(CrewC));
  sim.enqueue({ type: 'debug.spawnCrew', ship: playerShip(sim), x: at.x, y: at.y, role: 'role.engineer', faction });
  sim.step();
  return sim.world.query(CrewC).find((c) => !before.has(c))!;
}

describe('roleOf: what a person is to the ship they stand on', () => {
  it('tells each kind apart, and the helpers read off it', () => {
    const sim = newGame(3, content);
    const ship = playerShip(sim);
    const crew = playerCrew(sim)[0]!;
    expect(roleOf(sim, crew)).toBe('crew');

    const boarder = person(sim, 'rogue');
    expect(roleOf(sim, boarder)).toBe('other');

    const visitor = person(sim, 'neutral');
    grant(sim, ship, { by: 'visit', faction: 'neutral', crew: [visitor] });
    expect(roleOf(sim, visitor)).toBe('other'); // leave to be aboard, no bed

    const passenger = person(sim, 'neutral');
    grant(sim, ship, { by: 'passage', faction: 'neutral', crew: [passenger], lodge: true, work: true });
    expect(roleOf(sim, passenger)).toBe('passenger');
    expect(roleOf(sim, passenger, ship)).toBe('passenger');

    const guest = person(sim, 'neutral');
    grant(sim, ship, { by: 'aid', faction: 'neutral', crew: [guest], lodge: true });
    expect(roleOf(sim, guest)).toBe('guest');

    const staff = person(sim, 'neutral');
    sim.world.add(staff, StationCrewC, { station: 1 });
    expect(roleOf(sim, staff)).toBe('station');

    const hire = person(sim, 'neutral');
    sim.world.add(hire, StationCrewC, { station: 1 });
    sim.world.add(hire, ForHireC, { key: 'k', cost: 1, station: 1 });
    expect(roleOf(sim, hire)).toBe('recruit');

    const bare = (id: number) => fightsBareHanded(roleOf(sim, id));
    expect([crew, boarder, visitor].map(bare)).toEqual([true, true, true]);
    expect([passenger, guest, staff, hire].map(bare)).toEqual([false, false, false, false]);
    expect([staff, hire, passenger].map((id) => onStationRoll(roleOf(sim, id)))).toEqual([true, true, false]);
    expect([passenger, guest, crew].map((id) => isLodger(roleOf(sim, id)))).toEqual([true, true, false]);
    expect([passenger, guest, crew, boarder].map((id) => canDraft(roleOf(sim, id)))).toEqual([false, false, true, true]);
    expect(sim.world.get(crew, AllegianceC)?.faction).toBe('player');
  });
});
