import { describe, expect, it } from 'vitest';
import { stampShip } from '../combat/ships';
import { findPath } from '../crew/pathfind';
import { sightLine } from '../fight/los';
import { shipGrid } from '../regions';
import type { ContentRegistry } from '../registry';
import { Sim } from '../sim';
import { isEvaWalkable, isWalkable, Struct, writeStruct } from '../structure';

const content: ContentRegistry = { ships: {}, roles: {}, species: {}, modules: {}, crewNames: [], items: {}, recipes: {}, structCosts: {} };

// Two 3x3 rooms; the wall between them (x = 5) becomes rock.
const rows = [
  '...........',
  '.#########.',
  '.#___#___#.',
  '.#___#___#.',
  '.#___#___#.',
  '.#########.',
  '...........',
];

function make(kind: number): Sim {
  const sim = new Sim(5, content);
  stampShip(sim, { name: 't', rows }, { faction: 'player', state: 'prize', x: 0, y: 0 });
  const g = shipGrid(sim, 1)!;
  for (let y = 2; y <= 4; y++) writeStruct(g, 5, y, kind);
  return sim;
}
const avgO2 = (sim: Sim, x0: number): number => {
  const g = shipGrid(sim, 1)!;
  let sum = 0;
  for (let y = 2; y <= 4; y++) for (let x = x0; x < x0 + 3; x++) sum += g.get('o2', x, y);
  return sum / 9;
};

describe('rock in the systems', () => {
  it('is solid: not walkable, blocks paths and sight; no integrity', () => {
    for (const kind of [Struct.Rock, Struct.CoreRock]) {
      const sim = make(kind);
      const g = shipGrid(sim, 1)!;
      expect(isWalkable(kind)).toBe(false);
      expect(g.get('hp', 5, 3)).toBe(0);
      expect(findPath(sim, 1, { x: 3, y: 3 }, { x: 7, y: 3 })).toBeNull();
      expect(sightLine(sim, g, { x: 3, y: 3 }, { x: 7, y: 3 }).visible).toBe(false);
      expect(isEvaWalkable(g, 5, 3)).toBe(false);
    }
  });

  it('is airtight: venting one room leaves the room behind the rock at pressure', () => {
    const sim = make(Struct.Rock);
    sim.enqueue({ type: 'debug.setStruct', ship: 1, x: 1, y: 3, kind: Struct.Floor });
    for (let i = 0; i < 40 * 20; i++) sim.step();
    expect(avgO2(sim, 2)).toBeLessThan(5);
    expect(avgO2(sim, 6)).toBeGreaterThan(18);
    expect(shipGrid(sim, 1)!.get('o2', 5, 3)).toBe(0);
  });
});
