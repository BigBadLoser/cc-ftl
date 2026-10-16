import type { QueuedCommand } from './commands';
import { World, type WorldData } from './ecs';
import { Grid, type GridData } from './grid';
import type { ContentRegistry } from './registry';
import { Sim } from './sim';
import { SHIP_FIELDS } from './structure';
import { initAtmosphere } from './ship';

/** Current save format version. Bump it and add a migration whenever the shape changes. */
export const SAVE_VERSION = 3;

/** The persisted shape. Content is never saved, only referenced by ID inside components. */
export interface SaveData {
  version: number;
  seed: number;
  tick: number;
  rng: number;
  world: WorldData;
  grids: GridData[];
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
  sim.commands.setPending(data.pending);
  return sim;
}
