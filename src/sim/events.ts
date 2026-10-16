import type { JobKind } from './crew/components';

/** Outbound notifications for UI and audio. */
export type SimEvent =
  | { type: 'debug.markerSpawned'; entity: number; x: number; y: number }
  | { type: 'crew.jobDone'; crew: number; kind: JobKind; gridId: number; x: number; y: number }
  /** A room caught fire (first burning tile in a room with no fire). */
  | { type: 'fire.started'; gridId: number; room: number; x: number; y: number }
  /** A room opened to space and started venting. */
  | { type: 'hull.breach'; gridId: number; room: number }
  /** Some enabled consumers lost power because demand exceeds supply. */
  | { type: 'power.shortage'; gridId: number; supply: number; demand: number }
  /** A room's average oxygen fell below the alert level (re-arms once it recovers). */
  | { type: 'o2.low'; gridId: number; room: number; o2: number }
  | { type: 'crew.downed'; crew: number }
  | { type: 'crew.died'; crew: number }
  | { type: 'crew.rescued'; crew: number; by: number }
  | { type: 'crew.fellAsleep'; crew: number }
  | { type: 'crew.wokeUp'; crew: number }
  /** A crew member deposited items into a storage module (`to` 'storage') or onto a job (`to` 'job'). */
  | { type: 'item.hauled'; crew: number; item: string; count: number; gridId: number; x: number; y: number; to: 'floor' | 'storage' | 'job' }
  /** A job lacks materials and no stock exists to fetch (debounced per job). */
  | { type: 'job.missingMaterials'; job: number; gridId: number; x: number; y: number; item: string }
  /** A crafting module finished a batch; outputs lie at (x, y). */
  | { type: 'production.done'; module: number; recipe: string; gridId: number; x: number; y: number }
  /** A loose stack has no storage to go to (debounced per stack). */
  | { type: 'storage.full'; gridId: number; x: number; y: number; item: string }
  /** A command failed validation and was ignored. `reason` is a short machine-readable code. */
  | { type: 'command.rejected'; command: string; reason: string };

/**
 * The single outbound channel. Systems emit during a tick; the app drains after the tick.
 * Events are NEVER read by sim logic. Anything the sim needs later belongs in components or grids.
 */
export class EventBuffer {
  private buffer: SimEvent[] = [];

  /** Record an event. */
  emit(e: SimEvent): void {
    this.buffer.push(e);
  }

  /** Return all buffered events and clear the buffer. */
  drain(): SimEvent[] {
    const out = this.buffer;
    this.buffer = [];
    return out;
  }
}
