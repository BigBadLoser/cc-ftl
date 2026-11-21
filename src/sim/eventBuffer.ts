import type { SimEvent } from './events';

/**
 * The single outbound channel. Systems emit during a tick; the app drains after the tick.
 * Events are NEVER read by sim logic. Anything the sim needs later belongs in components or grids.
 */
export class EventBuffer {
  private buffer: SimEvent[] = [];
  private stamps = new WeakMap<SimEvent, number>();

  /** `clock` reads the tick an event is emitted in (see `tickOf`). */
  constructor(private readonly clock: () => number = () => 0) {}

  /** Record an event. */
  emit(e: SimEvent): void {
    this.stamps.set(e, this.clock());
    this.buffer.push(e);
  }

  /** The tick an event was emitted in (a drained event keeps its stamp), or `fallback` for an event this buffer never saw. */
  tickOf(e: SimEvent, fallback: number): number {
    return this.stamps.get(e) ?? fallback;
  }

  /** Return all buffered events and clear the buffer. */
  drain(): SimEvent[] {
    const out = this.buffer;
    this.buffer = [];
    return out;
  }
}
