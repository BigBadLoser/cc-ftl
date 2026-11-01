import type { Command, QueuedCommand, SimEvent } from '../sim';
import type { UiSignal } from '../ui/api';

/** The command queue as the feed reads it: what is pending and what has applied (read-only). */
export interface CommandSource {
  getPending(): readonly QueuedCommand[];
  getLog(): readonly QueuedCommand[];
}

export interface SignalFeed {
  listen(fn: (s: UiSignal) => void): () => void;
  /** Sim events drained after a tick. */
  events(events: readonly SimEvent[]): void;
  /** Once a frame: every command issued since the last poll, in order, whoever queued it and whether or not it has applied yet. */
  poll(): void;
}

/**
 * What the lessons engine listens to: sim events and issued commands. Commands are read from the queue (pending, then the applied log) rather
 * than tapped where they are issued, since input, the controller and the UI all enqueue; a command is reported once, as soon as it is queued,
 * so an aim made while a lesson has the game paused still counts.
 */
export function createSignalFeed(commands: CommandSource): SignalFeed {
  const subs = new Set<(s: UiSignal) => void>();
  const seen = new WeakSet<Command>();
  for (const q of commands.getLog()) seen.add(q.cmd);
  for (const q of commands.getPending()) seen.add(q.cmd);
  const emit = (s: UiSignal) => {
    for (const fn of [...subs]) fn(s);
  };
  return {
    listen(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
    events(events) {
      if (!subs.size) return;
      for (const event of events) emit({ kind: 'event', event });
    },
    poll() {
      // The applied log, newest back to the first command already reported (queue order is issue order), then what is still pending.
      const log = commands.getLog();
      let i = log.length;
      while (i > 0 && !seen.has(log[i - 1]!.cmd)) i--;
      const fresh = [...log.slice(i).map((q) => q.cmd), ...commands.getPending().map((q) => q.cmd).filter((c) => !seen.has(c))];
      for (const c of fresh) {
        seen.add(c);
        if (subs.size) emit({ kind: 'command', command: c });
      }
    },
  };
}
