import { describe, expect, it } from 'vitest';
import { content } from '../content';
import { newGame, type Sim } from '../sim';
import { createBridge } from './bridge';
import type { Loop, Speed } from './loop';

/** A loop that records its speed and, like the real one, drains commands on flush without running a tick. */
function recLoop(sim: Sim, start: Speed): Loop & { speed: Speed; rejected: string[] } {
  const l = {
    speed: start, rejected: [] as string[], alpha: 0, start() {}, stop() {}, hold() {},
    setSpeed(s: Speed) { l.speed = s; },
    getSpeed: () => l.speed,
    flush() {
      sim.applyCommands();
      for (const e of sim.events.drain()) if (e.type === 'command.rejected') l.rejected.push(e.reason);
    },
  };
  return l as unknown as Loop & { speed: Speed; rejected: string[] };
}

/** A running game (speed 2) that has just opened `event`, with the bridge holding it paused. */
function open(event: string): { sim: Sim; bridge: ReturnType<typeof createBridge>; loop: ReturnType<typeof recLoop> } {
  const sim = newGame(3, content);
  const bridge = createBridge(sim);
  const loop = recLoop(sim, 2);
  bridge.attachLoop(loop);
  bridge.setSpeed(2);
  sim.enqueue({ type: 'story.fire', event });
  sim.step();
  sim.events.drain();
  bridge.update({} as never);
  expect(sim.story.active?.event).toBe(event);
  expect(loop.speed).toBe(0);
  return { sim, bridge, loop };
}

describe('a story decision holds the game paused until it is really answered (#152)', () => {
  it('an unmet choice is rejected and the game stays paused', () => {
    const { sim, bridge, loop } = open('event.rogue_terminal');
    bridge.chooseStory('interface'); // needs a robot aboard: unmet
    bridge.update({} as never);
    expect(loop.rejected).toEqual(['unmet']);
    expect(sim.story.active?.event).toBe('event.rogue_terminal');
    expect(loop.speed).toBe(0);
    bridge.setSpeed(1); // the speed controls stay locked while it is open
    expect(loop.speed).toBe(0);
  });

  it('a valid choice resumes the speed the decision interrupted, once', () => {
    const { sim, bridge, loop } = open('event.derelict_sighting');
    bridge.chooseStory('skip');
    bridge.update({} as never);
    expect(sim.story.active).toBeNull();
    expect(loop.speed).toBe(2);
    bridge.setSpeed(1);
    bridge.update({} as never);
    expect(loop.speed).toBe(1); // no second restore overrides the player
  });
});
