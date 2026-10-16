import type { QueuedCommand } from './commands';
import { World, type WorldData } from './ecs';
import { Grid, type GridData } from './grid';
import { Sim, type ContentRegistry } from './sim';

/** Current save format version. Bump it and add a migration whenever the shape changes. */
export const SAVE_VERSION = 1;

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
export const migrations: Record<number, (data: Record<string, unknown>) => Record<string, unknown>> = {};

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
