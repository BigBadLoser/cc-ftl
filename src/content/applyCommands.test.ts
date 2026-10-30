import { describe, expect, it } from 'vitest';
import { newGame, type Sim } from '../sim';
import { MarkerC } from '../sim/components';
import { NeedsC } from '../sim/crew/components';
import { content } from '.';

describe('Sim.applyCommands', () => {
  it('applyCommands runs queued commands without advancing time or running any system', () => {
    const stepped = newGame(9, content);
    const paused = newGame(9, content);
    const needs = (sim: Sim) => JSON.stringify(sim.world.query(NeedsC).map((id) => sim.world.get(id, NeedsC)));
    const before = needs(paused);
    const tick = paused.tick;
    for (let i = 0; i < 50; i++) {
      stepped.enqueue({ type: 'debug.spawnMarker', x: 1, y: 1 });
      stepped.step();
      paused.enqueue({ type: 'debug.spawnMarker', x: 1, y: 1 });
      paused.applyCommands();
    }
    expect(needs(stepped)).not.toBe(before); // control: stepping does move crew needs
    expect(paused.tick).toBe(tick);
    expect(needs(paused)).toBe(before);
    expect(paused.world.query(MarkerC)).toHaveLength(50); // the commands did take effect
    expect(paused.commands.getPending()).toHaveLength(0);
    paused.step(); // nothing is applied twice by the next real tick
    expect(paused.world.query(MarkerC)).toHaveLength(50);
  });
});
