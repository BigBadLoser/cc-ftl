import { describe, expect, it } from 'vitest';
import { buildScenario, play } from '.';
import { content } from '..';

describe('scenario hooks before the app listens', () => {
  it('a UI request a hook makes during the pre-frame ticks waits in the requests the app applies', () => {
    // `?scenario=inspect&seed=3&stage=search&select&ticks=1`: inspect.select asks to select the lead inspector on the first tick.
    const built = buildScenario('inspect', { seed: 3, content, params: { stage: 'search', select: true } });
    play(built, 1);
    expect(built.requests).toContainEqual(expect.objectContaining({ kind: 'select', focus: true }));
  });
});
