import { describe, expect, it } from 'vitest';
import { Sim } from './sim';
import type { ContentRegistry } from './registry';
import { playerCrew, playerCrewPackedOk, playerShips, playerShipsPackedOk, withPlayerAboard } from './story/world';
import { playerShip } from './trade/player';

const empty = { ships: {}, roles: {}, species: {}, modules: {}, crewNames: [], items: {}, recipes: {}, structCosts: {}, events: {} } as unknown as ContentRegistry;

describe('packed guard (#350)', () => {
  it('fails a player read while packed unless wrapped or packedOk', () => {
    const sim = new Sim(1, empty);
    expect(playerShips(sim).size).toBe(0); // in a node: no packet, no complaint
    sim.sector.state = 'hyperspace';
    sim.sector.packet = { ship: 0, w: 1, h: 1, tiles: {}, entities: [] };
    expect(() => playerShips(sim)).toThrow(/withPlayerAboard/);
    expect(() => playerCrew(sim)).toThrow(/playerCrew/);
    expect(() => playerShip(sim)).toThrow(/playerShip/);
    expect(playerShipsPackedOk(sim).size).toBe(0);
    expect(playerCrewPackedOk(sim)).toEqual([]);
    expect(withPlayerAboard(sim, () => playerShips(sim).size)).toBe(0);
  });
});
