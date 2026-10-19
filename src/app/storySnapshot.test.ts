import { describe, expect, it } from 'vitest';
import { content } from '../content';
import { newGame } from '../sim';
import { buildStory } from './storySnapshot';

describe('buildStory', () => {
  it('shows greyed choices with reasons, costs and skill odds for the open decision', () => {
    const sim = newGame(3, content);
    expect(buildStory(sim)).toEqual({ active: null, last: null });
    sim.enqueue({ type: 'story.fire', event: 'event.rogue_terminal' });
    sim.step();
    const a = buildStory(sim).active;
    expect(a?.title).toBe('Maintenance terminal');
    const [robot, hack] = a?.choices ?? [];
    expect(robot).toMatchObject({ id: 'interface', enabled: false, reasons: ['Needs a Robot aboard'], odds: null });
    expect(hack?.enabled).toBe(true);
    expect(hack?.odds?.label).toMatch(/^Hacking skill \d \(.+\): \d+%$/);
  });

  it('reports the last result by label', () => {
    const sim = newGame(3, content);
    sim.enqueue({ type: 'story.fire', event: 'event.notice_comet' });
    sim.enqueue({ type: 'story.fire', event: 'event.derelict_sighting' });
    sim.step();
    sim.enqueue({ type: 'story.choose', choice: 'skip' });
    sim.step();
    expect(buildStory(sim).last).toMatchObject({ title: 'Derelict sighted', choice: 'Leave it', success: null });
  });
});
