import type { QueuedCommand } from './commands';
import type { Sector } from './combat/components';
import { World, type WorldData } from './ecs';
import { Grid, type GridData } from './grid';
import type { ContentRegistry } from './registry';
import { Sim } from './sim';
import { SHIP_FIELDS, Struct, STRUCT_MAX_HP } from './structure';
import { PLAYER_START, SECTOR_HEIGHT, SECTOR_WIDTH } from './tuning';
import { hullSum } from './combat/hull';
import { initAtmosphere } from './ship';

/** Current save format version. Bump it and add a migration whenever the shape changes. */
export const SAVE_VERSION = 5;

/** The persisted shape. Content is never saved, only referenced by ID inside components. */
export interface SaveData {
  version: number;
  seed: number;
  tick: number;
  rng: number;
  world: WorldData;
  grids: GridData[];
  sector: Sector;
  pending: QueuedCommand[];
}

/** Migrations keyed by the version they upgrade FROM; each returns data for version + 1. */
export const migrations: Record<number, (data: Record<string, unknown>) => Record<string, unknown>> = {
  // v1 -> v2 (ship systems): ship grids gain atmosphere, fire, light, door and module fields.
  // Air and temperature start at normal values; everything else starts empty.
  1: (data) => {
    const grids = (data['grids'] as GridData[]).map((g) => {
      if (!g.fields['struct']) return g;
      const grid = Grid.deserialize(g);
      for (const [name, type] of Object.entries(SHIP_FIELDS)) grid.addField(name, type);
      for (let y = 0; y < grid.height; y++) {
        for (let x = 0; x < grid.width; x++) initAtmosphere(grid, x, y);
      }
      return grid.serialize();
    });
    return { ...data, grids };
  },
  // v2 -> v3 (economy): ship grids gain the `item` field; crew gain a 'crafting' priority. Existing jobs have
  // no `needs`, so they count as fully delivered; no storage or items exist yet.
  2: (data) => {
    const grids = (data['grids'] as GridData[]).map((g) => {
      if (!g.fields['struct']) return g;
      const grid = Grid.deserialize(g);
      grid.addField('item', SHIP_FIELDS.item);
      return grid.serialize();
    });
    const world = data['world'] as WorldData;
    for (const entry of world.stores['priorities'] ?? []) (entry[1] as Record<string, number>)['crafting'] = 3;
    return { ...data, grids };
  },
  // v3 -> v4 (combat): ship grids gain wall/door integrity `hp`; every ship grid gets a ship entity (player
  // faction, placed at the start position) with combat state; the save gains the sector.
  3: (data) => {
    const world = data['world'] as WorldData;
    let nextId = world.nextId;
    const ships: [number, unknown][] = [];
    const combats: [number, unknown][] = [];
    const grids = (data['grids'] as GridData[]).map((g) => {
      if (!g.fields['struct']) return g;
      const grid = Grid.deserialize(g);
      grid.addField('hp', SHIP_FIELDS.hp);
      for (let y = 0; y < grid.height; y++) {
        for (let x = 0; x < grid.width; x++) {
          const kind = grid.get('struct', x, y);
          if (kind === Struct.Wall || kind === Struct.Door) grid.set('hp', x, y, STRUCT_MAX_HP);
        }
      }
      const id = nextId++;
      world.alive.push(id);
      ships.push([id, {
        gridId: g.id, name: 'Ship', faction: 'player', state: 'active', x: PLAYER_START.x, y: PLAYER_START.y,
        width: grid.width, height: grid.height, hullMax: hullSum(grid), integrity: 1,
      }]);
      combats.push([id, {
        hold: false, volley: false, target: null, doctrine: 'random', ftl: 0,
        shield: { layers: 0, max: 0, timer: 0 }, evasion: 0, aiTimer: 0,
      }]);
      return grid.serialize();
    });
    world.nextId = nextId;
    world.stores['ship'] = ships;
    world.stores['combat'] = combats;
    const sector: Sector = { width: SECTOR_WIDTH, height: SECTOR_HEIGHT, inCombat: false };
    return { ...data, grids, sector };
  },
  // v4 -> v5 (art rework): weapons gain the turret `aim`. Module footprints were resized in the same change
  // (consoles 1x1 -> chairs inside 2x2/3x2, bigger engines and weapons); the game had no persisted saves yet, so
  // only the component shape is migrated and old ship layouts are not converted.
  4: (data) => {
    const world = data['world'] as WorldData;
    for (const entry of world.stores['weapon'] ?? []) (entry[1] as Record<string, unknown>)['aim'] = 0;
    return data;
  },
};

/** Serialize the sim to a JSON string. */
export function serialize(sim: Sim): string {
  const data: SaveData = {
    version: SAVE_VERSION,
    seed: sim.seed,
    tick: sim.tick,
    rng: sim.rng.getState(),
    world: sim.world.serialize(),
    grids: [...sim.grids.values()].sort((a, b) => a.id - b.id).map((g) => g.serialize()),
    sector: sim.sector,
    pending: [...sim.commands.getPending()],
  };
  return JSON.stringify(data);
}

/** Migrate raw save data up to SAVE_VERSION. */
export function migrate(raw: Record<string, unknown>): Record<string, unknown> {
  let data = raw;
  let version = data['version'] as number;
  if (version > SAVE_VERSION) throw new Error(`Save version ${version} is newer than ${SAVE_VERSION}`);
  while (version < SAVE_VERSION) {
    const fn = migrations[version];
    if (!fn) throw new Error(`No migration from save version ${version}`);
    data = fn(data);
    version++;
    data['version'] = version;
  }
  return data;
}

/** Rebuild a Sim from a JSON save, migrating older versions. */
export function deserialize(json: string, content: ContentRegistry): Sim {
  const data = migrate(JSON.parse(json) as Record<string, unknown>) as unknown as SaveData;
  const sim = new Sim(data.seed, content);
  sim.tick = data.tick;
  sim.rng.setState(data.rng);
  sim.world = World.deserialize(data.world);
  for (const g of data.grids) sim.grids.set(g.id, Grid.deserialize(g));
  sim.sector = data.sector;
  sim.commands.setPending(data.pending);
  return sim;
}
