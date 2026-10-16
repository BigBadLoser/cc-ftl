import { describe, expect, it } from 'vitest';
import { CommandQueue, type Command } from './commands';

describe('CommandQueue', () => {
  it('applies in enqueue order at their tick', () => {
    const q = new CommandQueue();
    q.enqueue({ type: 'debug.spawnMarker', x: 1, y: 1 }, 0);
    q.enqueue({ type: 'noop' }, 1);
    q.enqueue({ type: 'debug.spawnMarker', x: 2, y: 2 }, 0);
    const applied: Command[] = [];
    q.drain(0, (c) => applied.push(c));
    expect(applied.map((c) => c.type)).toEqual(['debug.spawnMarker', 'debug.spawnMarker']);
    expect(q.getPending()).toHaveLength(1);
    q.drain(1, (c) => applied.push(c));
    expect(applied).toHaveLength(3);
  });

  it('logs applied commands with tick numbers', () => {
    const q = new CommandQueue();
    q.enqueue({ type: 'noop' }, 5);
    q.drain(5, () => {});
    expect(q.getLog()).toEqual([{ tick: 5, cmd: { type: 'noop' } }]);
  });

  it('keeps only the last N in the ring buffer, oldest first', () => {
    const q = new CommandQueue(3);
    for (let t = 0; t < 5; t++) {
      q.enqueue({ type: 'debug.spawnMarker', x: t, y: 0 }, t);
      q.drain(t, () => {});
    }
    expect(q.getLog().map((l) => l.tick)).toEqual([2, 3, 4]);
  });
});
