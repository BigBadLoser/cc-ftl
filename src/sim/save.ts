import type { QueuedCommand } from './commands';
import type { Sector } from './combat/components';
import { World, type WorldData } from './ecs';
import type { GridRect } from './gridMap';
import type { ContentRegistry } from './registry';
import { SectorGrid, type SectorGridData } from './sectorGrid';
import { Sim } from './sim';
import { newStory, type StoryState } from './story/state';
import { newTrade, type TradeState } from './trade/types';

/**
 * Current save format version. Bump it whenever the shape changes. Saves are not migrated (user decision, 2026-10-19:
 * this is a prototype): a save of any other version is refused and the game starts fresh.
 * v13 (sector grid step 2): the sector's tiles are one `SectorGrid` (`sector.grid`, chunks), `grids` keeps only each
 * grid's window rectangle.
 * v14 (step 8): vehicles keep position, heading and altitude in `BodyC`; `VehicleC.homeShip` and `hover` are ShipC ids;
 * `EvaFloatC.sx/sy` is the hatch point in sector tiles.
 * v15 (step 6, the coordinate flip): every component position (crew, paths, modules, jobs, items, ...) is a sector tile;
 * the shape is unchanged but the meaning is not, so v14 saves are refused.
 * v16 (step 7a): `ItemStack` drops `gridId` (the owning ship is read from the `ship` layer at the stack's tile).
 */
export const SAVE_VERSION = 18;

/** The persisted shape. Content is never saved, only referenced by ID inside components. */
export interface SaveData {
  version: number;
  seed: number;
  tick: number;
  rng: number;
  world: WorldData;
  /** Each grid's window onto the sector grid, sorted by id. */
  grids: GridRect[];
  sector: Omit<Sector, 'grid'> & { grid: SectorGridData };
  /** Event system state. Optional: saves from before it existed load with a fresh one (no version bump needed). */
  story?: StoryState;
  /** Trade state. Optional like `story`: older saves load with an empty one. */
  trade?: TradeState;
  pending: QueuedCommand[];
}

/** Serialize the sim to a JSON string. */
export function serialize(sim: Sim): string {
  const data: SaveData = {
    version: SAVE_VERSION,
    seed: sim.seed,
    tick: sim.tick,
    rng: sim.rng.getState(),
    world: sim.world.serialize(),
    grids: sim.grids.rects(),
    sector: { ...sim.sector, grid: sim.sector.grid.serialize() },
    story: sim.story,
    trade: sim.trade,
    pending: [...sim.commands.getPending()],
  };
  return JSON.stringify(data);
}

/** Check raw save data is of SAVE_VERSION. Older and newer saves are refused: there are no migrations. */
export function migrate(raw: Record<string, unknown>): Record<string, unknown> {
  const version = raw['version'];
  if (version !== SAVE_VERSION) throw new Error(`Save version ${String(version)} is not ${SAVE_VERSION}; old saves are not migrated`);
  return raw;
}

/** Rebuild a Sim from a JSON save. Throws on a save of another version. */
export function deserialize(json: string, content: ContentRegistry): Sim {
  const data = migrate(JSON.parse(json) as Record<string, unknown>) as unknown as SaveData;
  const sim = new Sim(data.seed, content);
  sim.tick = data.tick;
  sim.rng.setState(data.rng);
  sim.world = World.deserialize(data.world);
  sim.sector = { ...data.sector, grid: SectorGrid.deserialize(0, data.sector.grid) };
  sim.grids.restore(data.grids);
  sim.story = { ...newStory(data.seed), ...data.story };
  sim.trade = { ...newTrade(), ...data.trade };
  sim.commands.setPending(data.pending);
  return sim;
}
