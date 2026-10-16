/** Outbound notifications for UI and audio. */
export type SimEvent = { type: 'debug.markerSpawned'; entity: number; x: number; y: number };

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
