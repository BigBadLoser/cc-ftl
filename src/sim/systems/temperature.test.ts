import { describe, expect, it } from 'vitest';
import { stampShip } from '../combat/ships';
import { ShipC } from '../combat/components';
import { CrewC, HealthC, NeedsC, PathC, PositionC, PrioritiesC, type Priorities } from '../crew/components';
import { ModuleC, type Module } from '../modules/components';
import { spawnModule } from '../modules/spawn';
import type { ContentRegistry, ModuleDef } from '../registry';
import { shipGrid } from '../regions';
import { addRoomHeat, roomTemp, tempAt } from '../roomTemp';
import { deserialize, serialize } from '../save';
import { Sim } from '../sim';
import { Struct } from '../structure';
import { CREW_MAX_HP, NORMAL_TEMP, SPACE_TEMP } from '../tuning';

const mod = (o: Partial<ModuleDef>): ModuleDef => ({
  name: 'm', asset: 'm', footprint: [1, 1], solid: false, power: 0, flammability: 0, maxHp: 100, buildWork: 20, ...o,
});
const content: ContentRegistry = {
  ships: {}, roles: {},
  species: { 'species.human': { name: 'H', moveSpeed: 2.5, workSpeed: 1, restDecay: 0.6 } },
  modules: { reactor: mod({ heatPerSec: 40 }) },
  crewNames: [], items: {}, recipes: {}, structCosts: {},
};

// Two 3x2 rooms (west: x 2..4, east: x 6..8) with a wall between them at x 5; a door in the north wall of the west room at (3, 1).
const rows = ['...........', '.####D#####.', '.#___#___#.', '.#___#___#.', '.#########.', '...........'];
const WEST = { x: 3, y: 2 };
const EAST = { x: 7, y: 2 };

function make(): { sim: Sim; ship: number } {
  const sim = new Sim(5, content);
  const ship = stampShip(sim, { name: 't', rows }, { faction: 'player', state: 'active', x: 0, y: 0 });
  sim.step(); // the rooms pass labels the hull
  return { sim, ship };
}
const room = (sim: Sim, ship: number, at: { x: number; y: number }): number => (shipGrid(sim, ship)!).get('room', at.x, at.y);
const run = (sim: Sim, ticks: number): void => { for (let i = 0; i < ticks; i++) sim.step(); };

function crewAt(sim: Sim, at: { x: number; y: number }): number {
  const id = sim.world.createEntity();
  const p = 4;
  sim.world.add(id, CrewC, { name: 'T', role: 'r', species: 'species.human', appearanceSeed: 1, activity: 'idle' });
  sim.world.add(id, PositionC, { x: at.x, y: at.y, toX: at.x, toY: at.y, progress: 0, facing: 0 });
  sim.world.add(id, PathC, { steps: [] });
  sim.world.add(id, PrioritiesC, { firefighting: 0, medical: p, operating: p, repair: p, construction: p, hauling: p, refining: p, crafting: p, research: p, cooking: p, patrol: p } as Priorities);
  sim.world.add(id, NeedsC, { rest: 100 });
  sim.world.add(id, HealthC, { hp: CREW_MAX_HP, max: CREW_MAX_HP });
  return id;
}

describe('room temperature', () => {
  it('labels two rooms and starts them at the normal temperature', () => {
    const { sim, ship } = make();
    const a = room(sim, ship, WEST);
    const b = room(sim, ship, EAST);
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(0);
    expect(a).not.toBe(b);
    expect(roomTemp(sim, ship, a)).toBe(NORMAL_TEMP);
  });

  it('heat added to a room warms the whole room, spread over its tiles, and leaves the other room alone', () => {
    const { sim, ship } = make();
    const a = room(sim, ship, WEST);
    const g = shipGrid(sim, ship)!;
    addRoomHeat(sim, ship, g, a, 60);
    expect(roomTemp(sim, ship, a)).toBeCloseTo(NORMAL_TEMP + 60 / 6, 5);
    expect(roomTemp(sim, ship, room(sim, ship, EAST))).toBe(NORMAL_TEMP);
    expect(tempAt(sim, ship, g, 2, 3)).toBeCloseTo(NORMAL_TEMP + 10, 5); // any tile of the room reads the room's value
  });

  it('a running reactor warms its room, and only its room', () => {
    const { sim, ship } = make();
    const id = spawnModule(sim, 'reactor', 7, 3, 0);
    (sim.world.get(id, ModuleC) as Module).powered = true;
    run(sim, 400);
    expect(roomTemp(sim, ship, room(sim, ship, EAST))).toBeGreaterThan(30);
    expect(roomTemp(sim, ship, room(sim, ship, WEST))).toBe(NORMAL_TEMP);
  });

  it('relaxes toward normal and settles at normal (the entry is dropped)', () => {
    const { sim, ship } = make();
    const a = room(sim, ship, WEST);
    addRoomHeat(sim, ship, shipGrid(sim, ship)!, a, 600);
    const hot = roomTemp(sim, ship, a);
    run(sim, 200);
    const later = roomTemp(sim, ship, a);
    expect(later).toBeLessThan(hot);
    expect(later).toBeGreaterThan(NORMAL_TEMP);
    run(sim, 20000);
    expect(roomTemp(sim, ship, a)).toBe(NORMAL_TEMP);
    expect(sim.world.get(ship, ShipC)!.roomTemp?.[a]).toBeUndefined();
  });

  it('a breach makes its room cold, toward space temperature, while the sealed room stays warm', () => {
    const { sim, ship } = make();
    shipGrid(sim, ship)!.set('struct', 1, 3, Struct.Space); // the west hull of the west room
    run(sim, 20 * 60);
    const cold = roomTemp(sim, ship, room(sim, ship, WEST));
    expect(cold).toBeLessThan(0);
    expect(cold).toBeGreaterThan(SPACE_TEMP);
    expect(roomTemp(sim, ship, room(sim, ship, EAST))).toBe(NORMAL_TEMP);
  });

  it('a room that has lost its air (vacuum) cools even with an intact hull', () => {
    const { sim, ship } = make();
    const g = shipGrid(sim, ship)!;
    for (const [x, y] of [[6, 2], [7, 2], [8, 2], [6, 3], [7, 3], [8, 3]] as const) g.set('o2', x, y, 0);
    run(sim, 20 * 60);
    expect(roomTemp(sim, ship, room(sim, ship, EAST))).toBeLessThan(0);
  });

  it('tiles outside any room read normal temperature (a door), and airless tiles read space temperature', () => {
    const { sim, ship } = make();
    const g = shipGrid(sim, ship)!;
    expect(g.get('room', 5, 1)).toBe(0);
    addRoomHeat(sim, ship, g, room(sim, ship, WEST), 600);
    expect(tempAt(sim, ship, g, 5, 1)).toBe(NORMAL_TEMP);
    expect(tempAt(sim, ship, g, 0, 0)).toBe(SPACE_TEMP);
  });

  it('hurts crew standing in a hot room and in a cold room, and not in a normal one', () => {
    const { sim, ship } = make();
    const g = shipGrid(sim, ship)!;
    const hotCrew = crewAt(sim, WEST);
    const coldCrew = crewAt(sim, EAST);
    addRoomHeat(sim, ship, g, room(sim, ship, WEST), 6 * 100); // +100 C in the west room (hotCrew)
    addRoomHeat(sim, ship, g, room(sim, ship, EAST), -6 * 90); // -70 C in the east room
    run(sim, 100);
    expect(sim.world.get(hotCrew, HealthC)!.hp).toBeLessThan(CREW_MAX_HP);
    expect(sim.world.get(coldCrew, HealthC)!.hp).toBeLessThan(CREW_MAX_HP);
  });

  it('does not hurt crew in a normal-temperature room', () => {
    const { sim } = make();
    const id = crewAt(sim, WEST);
    run(sim, 100);
    expect(sim.world.get(id, HealthC)!.hp).toBe(CREW_MAX_HP);
  });

  it('keeps a room\'s temperature when a wall splits it, and averages when a wall is removed', () => {
    const { sim, ship } = make();
    const g = shipGrid(sim, ship)!;
    const a = room(sim, ship, WEST);
    addRoomHeat(sim, ship, g, a, 600); // +100 C
    g.set('struct', 3, 3, Struct.Wall); // splits nothing yet (3x2 room, one tile walled)
    run(sim, 2);
    const t = tempAt(sim, ship, g, 2, 2);
    expect(t).toBeGreaterThan(100);
    // Knock the dividing wall out: the two rooms merge at the size-weighted mean of (hot west, normal east).
    const eastBefore = room(sim, ship, EAST);
    expect(eastBefore).not.toBe(room(sim, ship, WEST));
    g.set('struct', 5, 2, Struct.Floor);
    g.set('struct', 5, 3, Struct.Floor);
    run(sim, 2);
    const merged = room(sim, ship, WEST);
    expect(room(sim, ship, EAST)).toBe(merged);
    expect(roomTemp(sim, ship, merged)).toBeGreaterThan(NORMAL_TEMP + 20);
    expect(roomTemp(sim, ship, merged)).toBeLessThan(t);
  });

  it('survives a save and load', () => {
    const { sim, ship } = make();
    addRoomHeat(sim, ship, shipGrid(sim, ship)!, room(sim, ship, WEST), 300);
    run(sim, 10);
    const before = roomTemp(sim, ship, room(sim, ship, WEST));
    const loaded = deserialize(serialize(sim), content);
    expect(roomTemp(loaded, ship, room(loaded, ship, WEST))).toBeCloseTo(before, 6);
    run(sim, 50);
    run(loaded, 50);
    expect(roomTemp(loaded, ship, room(loaded, ship, WEST))).toBe(roomTemp(sim, ship, room(sim, ship, WEST)));
  });
});
