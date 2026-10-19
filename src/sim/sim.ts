import type { ContentRegistry } from './registry';
import { CommandQueue, type Command } from './commands';
import { World } from './ecs';
import { EventBuffer } from './events';
import { commandHandlers } from './handlers';
import { GridMap, newSectorGrid } from './gridMap';
import type { Sector } from './combat/components';
import { pipeline } from './pipeline';
import { Rng } from './rng';
import { newStory, type StoryState } from './story/state';
import { newTrade, type TradeState } from './trade/types';
import { TICK_HZ } from './time';
import { SECTOR_HEIGHT, SECTOR_WIDTH } from './tuning';

export { TICK_HZ };

/** The whole simulation state. Mutated only by step(), driven by queued commands. */
export class Sim {
  /** Number of completed ticks; also the tick the next step() will run. */
  tick = 0;
  rng: Rng;
  world = new World();
  /** Grid id -> window onto `sector.grid` in the grid's local coordinates (sector refactor: goes away in step 7). */
  grids = new GridMap(() => this.sector.grid);
  commands = new CommandQueue();
  events = new EventBuffer();
  /** Event system state: flags, reputation, the open decision, queue (see story/). */
  story: StoryState;
  /** Trade state: the player's credits, hails, offers and deals (see trade/). NPC wallets and stock are `TraderC` components. */
  trade: TradeState;
  sector: Sector = { grid: newSectorGrid(), width: SECTOR_WIDTH, height: SECTOR_HEIGHT, inCombat: false };

  constructor(
    /** World seed: drives galaxy generation; saved with the game. */
    readonly seed: number,
    readonly content: ContentRegistry = { ships: {}, roles: {}, species: {}, modules: {}, crewNames: [], items: {}, recipes: {}, structCosts: {} },
  ) {
    this.rng = new Rng(seed);
    this.story = newStory(seed);
    this.trade = newTrade();
  }

  /** Queue a command to apply at the start of the next tick. */
  enqueue(cmd: Command): void {
    this.commands.enqueue(cmd, this.tick);
  }

  /** Advance one tick: apply commands, run the pipeline in order, increment the counter. */
  step(): void {
    this.commands.drain(this.tick, (cmd) => this.apply(cmd));
    for (const system of pipeline) system(this);
    this.tick++;
  }

  private apply(cmd: Command): void {
    (commandHandlers[cmd.type] as (sim: Sim, cmd: Command) => void)(this, cmd);
  }
}
