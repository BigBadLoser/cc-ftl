import type { WorkCategory } from './crew/components';

/** Every way to change the sim from outside. Add new variants here. */
export type Command =
  | { type: 'noop' }
  | { type: 'debug.spawnMarker'; x: number; y: number }
  | { type: 'debug.setStruct'; gridId: number; x: number; y: number; kind: number }
  | { type: 'job.build'; gridId: number; x: number; y: number; struct: number }
  | { type: 'job.deconstruct'; gridId: number; x: number; y: number }
  | { type: 'job.cancel'; gridId: number; x: number; y: number }
  /** Blueprint a module; (x, y) is the top-left of the rotated footprint, rot = quarter turns clockwise. */
  | { type: 'job.buildModule'; gridId: number; x: number; y: number; def: string; rot: number }
  /** Deconstruct the module covering tile (x, y). */
  | { type: 'job.deconstructModule'; gridId: number; x: number; y: number }
  | { type: 'module.setPriority'; id: number; priority: number }
  | { type: 'module.setEnabled'; id: number; enabled: boolean }
  | { type: 'debug.ignite'; gridId: number; x: number; y: number }
  | { type: 'debug.setField'; gridId: number; x: number; y: number; field: string; value: number }
  | { type: 'crew.setPriority'; id: number; category: WorkCategory; value: number }
  | { type: 'crew.resetPriorities'; id: number }
  | { type: 'crew.draft'; id: number; drafted: boolean }
  | { type: 'crew.moveTo'; id: number; x: number; y: number }
  /** Queue a production order on a crafting module. `target`: batches ('count') or stock level ('keep'). */
  | { type: 'production.add'; moduleId: number; recipe: string; mode: 'count' | 'keep'; target: number }
  /** Remove the order at `index` of the module's list. */
  | { type: 'production.remove'; moduleId: number; index: number }
  /** Move the order at index `from` to index `to`. */
  | { type: 'production.reorder'; moduleId: number; from: number; to: number }
  /** Restrict a storage module to `items` (item ids), or null to accept everything. */
  | { type: 'storage.setFilter'; moduleId: number; items: string[] | null }
  | { type: 'debug.spawnItems'; gridId: number; x: number; y: number; item: string; count: number };

/** A command tagged with the tick at whose start it applies. */
export interface QueuedCommand {
  tick: number;
  cmd: Command;
}

/**
 * The single inbound channel. Commands are queued, then applied in enqueue order at the start
 * of their tick. A ring buffer keeps the last N applied commands for "copy repro".
 */
export class CommandQueue {
  private pending: QueuedCommand[] = [];
  private log: QueuedCommand[] = [];
  private logStart = 0;

  constructor(private readonly logSize = 2000) {}

  /** Queue a command to apply at the start of `tick`. */
  enqueue(cmd: Command, tick: number): void {
    this.pending.push({ tick, cmd });
  }

  /** Apply (in order) every queued command due at or before `tick`, logging each. */
  drain(tick: number, apply: (cmd: Command) => void): void {
    const due = this.pending.filter((q) => q.tick <= tick);
    this.pending = this.pending.filter((q) => q.tick > tick);
    for (const q of due) {
      apply(q.cmd);
      this.record({ tick, cmd: q.cmd });
    }
  }

  /** Applied commands, oldest first (at most logSize). */
  getLog(): readonly QueuedCommand[] {
    return [...this.log.slice(this.logStart), ...this.log.slice(0, this.logStart)];
  }

  /** Commands queued but not yet applied. */
  getPending(): readonly QueuedCommand[] {
    return this.pending;
  }

  /** Replace pending commands (used by save loading). */
  setPending(pending: QueuedCommand[]): void {
    this.pending = [...pending];
  }

  private record(q: QueuedCommand): void {
    if (this.log.length < this.logSize) {
      this.log.push(q);
    } else {
      this.log[this.logStart] = q;
      this.logStart = (this.logStart + 1) % this.logSize;
    }
  }
}
