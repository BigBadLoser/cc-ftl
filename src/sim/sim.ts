import type { ContentRegistry } from './registry';
import { CommandQueue, type Command } from './commands';
import { World } from './ecs';
import { EventBuffer } from './events';
import { commandHandlers } from './handlers';
import type { Grid } from './grid';
import { pipeline } from './pipeline';
import { Rng } from './rng';
import { TICK_HZ } from './time';

export { TICK_HZ };

/** The whole simulation state. Mutated only by step(), driven by queued commands. */
export class Sim {
  /** Number of completed ticks; also the tick the next step() will run. */
  tick = 0;
  rng: Rng;
  world = new World();
  grids = new Map<number, Grid>();
  commands = new CommandQueue();
  events = new EventBuffer();

  constructor(
    /** World seed: drives galaxy generation; saved with the game. */
    readonly seed: number,
    readonly content: ContentRegistry = { ships: {}, roles: {}, species: {}, modules: {}, crewNames: [], items: {}, recipes: {}, structCosts: {} },
  ) {
    this.rng = new Rng(seed);
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
