/** Every way to change the sim from outside. Add new variants here. */
export type Command =
  | { type: 'noop' }
  | { type: 'debug.spawnMarker'; x: number; y: number };

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
