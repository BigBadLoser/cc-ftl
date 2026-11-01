import { describe, expect, it } from 'vitest';
import { CommandQueue, type Command } from '../sim';
import type { UiSignal } from '../ui/api';
import { createSignalFeed } from './signals';

describe('signal feed', () => {
  it('reports each command once, pending or applied, and ignores ones queued before it started', () => {
    const q = new CommandQueue();
    q.enqueue({ type: 'noop' }, 0);
    const feed = createSignalFeed(q);
    const got: UiSignal[] = [];
    feed.listen((s) => got.push(s));
    const a: Command = { type: 'combat.vent', ship: 1 };
    const b: Command = { type: 'combat.flee', ship: 1 };
    q.enqueue(a, 0);
    feed.poll(); // a pending
    q.drain(0, () => {});
    q.enqueue(b, 1);
    q.drain(1, () => {}); // b applied between polls
    feed.poll();
    feed.poll();
    expect(got.map((s) => (s.kind === 'command' ? s.command.type : ''))).toEqual(['combat.vent', 'combat.flee']);
    feed.events([{ type: 'combat.started' } as never]);
    expect(got.at(-1)).toEqual({ kind: 'event', event: { type: 'combat.started' } });
  });
});
