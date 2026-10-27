import type { ContentRegistry } from './registry';
import { CommandQueue, type Command } from './commands';
import { World } from './ecs';
import { EventBuffer } from './events';
import { commandHandlers } from './handlers';
import { newSectorGrid } from './stamp';
import type { Sector } from './combat/components';
import type { SectorArchive } from './sector/archive';
import { pipeline } from './pipeline';
import { Rng } from './rng';
import { newStory, type StoryState } from './story/state';
import { advanceTravel } from './galaxy/hyperspace';
import { newGalaxy, START_NODE } from './galaxy/state';
import type { GalaxyState } from './galaxy/types';
import { newTrade, type TradeState } from './trade/types';
import { newYard, type YardState } from './yard/types';
import { TICK_HZ } from './time';
import { SECTOR_HEIGHT, SECTOR_WIDTH } from './tuning';

export { TICK_HZ };

/** The whole simulation state. Mutated only by step(), driven by queued commands. */
export class Sim {
  /** Number of completed ticks; also the tick the next step() will run. */
  tick = 0;
  rng: Rng;
  world = new World();
  commands = new CommandQueue();
  events = new EventBuffer();
  /** Event system state: flags, reputation, the open decision, queue (see story/). */
  story: StoryState;
  /** Trade state: the player's credits, hails, offers and deals (see trade/). NPC wallets and stock are `TraderC` components. */
  trade: TradeState;
  /** Starmap state: current node, generated chunks, discovery, contacts (see galaxy/). */
  galaxy: GalaxyState;
  sector: Sector = { grid: newSectorGrid(), width: SECTOR_WIDTH, height: SECTOR_HEIGHT, inCombat: false, node: START_NODE, state: 'active' };
  /** Sectors the player left, frozen (see sector/archive.ts). Every one is kept (user decision, 2026-10-21). */
  archives: SectorArchive[] = [];
  /** Shipyard hull-expansion orders (yard/). */
  yard: YardState = newYard();

  constructor(
    /** World seed: drives galaxy generation; saved with the game. */
    readonly seed: number,
    readonly content: ContentRegistry = { ships: {}, roles: {}, species: {}, modules: {}, crewNames: [], items: {}, recipes: {}, structCosts: {} },
  ) {
    this.rng = new Rng(seed);
    this.story = newStory(seed);
    this.trade = newTrade();
    this.galaxy = newGalaxy(seed);
  }

  /** Queue a command to apply at the start of the next tick. */
  enqueue(cmd: Command): void {
    this.commands.enqueue(cmd, this.tick);
  }

  /** Advance one tick: apply commands, run the pipeline in order (unless deploying), increment the counter. */
  step(): void {
    this.commands.drain(this.tick, (cmd) => this.apply(cmd));
    // While the player's ship waits to deploy, the node is frozen: only a successful `sector.deploy` resumes it.
    if (this.sector.state === 'active') for (const system of pipeline) system(this);
    else if (this.sector.state === 'hyperspace') advanceTravel(this);
    this.tick++;
  }

  private apply(cmd: Command): void {
    (commandHandlers[cmd.type] as (sim: Sim, cmd: Command) => void)(this, cmd);
  }
}
