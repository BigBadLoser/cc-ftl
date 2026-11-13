import { describe, expect, it } from 'vitest';
import { ModuleC, homeShip, newGame, shipGrid, type ModuleDef } from '../../sim';
import { ROOM_KINDS, roomKind, roomKindOfModule } from '../../sim/roomKind';
import { roomTiles } from '../../sim/roomIndex';
import { content } from '../index';

/** Room kinds (sim/roomKind.ts): what a room is for, from the role flags of the modules standing in it. */

const def = (over: Partial<ModuleDef>): ModuleDef => ({ name: 'x', asset: 'x', footprint: [1, 1], solid: false, power: 0, flammability: 0, maxHp: 1, buildWork: 1, ...over }) as ModuleDef;

describe('room kind', () => {
  it('a module votes by its role flags; fixtures (a light) do not vote', () => {
    expect(roomKindOfModule(def({ bed: true }))).toBe('Quarters');
    expect(roomKindOfModule(def({ bed: true, medical: true }))).toBe('Medbay');
    expect(roomKindOfModule(def({ console: 'helm' }))).toBe('Bridge');
    expect(roomKindOfModule(def({ power: 20 }))).toBe('Engineering');
    expect(roomKindOfModule(def({ galley: true }))).toBe('Mess');
    expect(roomKindOfModule(def({ power: -1, light: { radius: 4, level: 200 } }))).toBeNull();
  });

  it('a mixed room takes the most defining kind: the order puts Bridge and Medbay before Quarters, and Quarters before Storage', () => {
    const at = (k: (typeof ROOM_KINDS)[number]): number => ROOM_KINDS.indexOf(k);
    expect(at('Bridge')).toBeLessThan(at('Quarters'));
    expect(at('Medbay')).toBeLessThan(at('Quarters'));
    expect(at('Quarters')).toBeLessThan(at('Storage'));
  });

  it('the starter ship: every room has a kind, a bed room is Quarters, and unfurnished rooms are a Corridor or a Room', () => {
    const sim = newGame(1, content, 'ship.starter', false);
    for (let i = 0; i < 40; i++) sim.step();
    const grid = shipGrid(sim, homeShip(sim))!;
    const kinds = new Map<number, string>();
    for (const room of roomTiles(grid).keys()) kinds.set(room, roomKind(sim, grid, room));
    expect(kinds.size).toBeGreaterThan(3);
    const bedRooms = new Set<number>();
    for (const id of sim.world.query(ModuleC)) {
      const m = sim.world.get(id, ModuleC)!;
      if (sim.content.modules[m.def]?.bed && !sim.content.modules[m.def]?.medical) bedRooms.add(grid.get('room', m.x, m.y));
    }
    expect(bedRooms.size).toBeGreaterThan(0);
    for (const r of bedRooms) expect(['Quarters', 'Bridge', 'Medbay', 'Engineering', 'Weapons', 'Lab', 'Airlock']).toContain(kinds.get(r));
    expect([...bedRooms].some((r) => kinds.get(r) === 'Quarters')).toBe(true);
  });
});
