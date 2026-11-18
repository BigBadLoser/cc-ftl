import { describe, expect, it } from 'vitest';
import { newGame } from '../../sim/newGame';
import { content } from '..';
import { buildScenario, play, presets } from '.';

/**
 * Every preset builds on the game the app starts (the Wayfarer, its node populated, the crew rolled; the preset's own hull where it names one) and plays on
 * for a short while with its hooks, without throwing. A preset that needs a param to build (none yet) would need its own case.
 */
describe('every scenario preset', () => {
  it.each([...presets.keys()])('%s builds on the app start and plays on', (name) => {
    const preset = presets.get(name)!;
    const sim = newGame(3, content, preset.starter ?? 'ship.wayfarer', true, 'rolled');
    const built = buildScenario(name, { sim, seed: 3 });
    play(built, 100);
    expect(built.sim.tick).toBeGreaterThan(0);
    // Spots that are taken (a deploy or spawn that is too close or overlaps) are tried in turn or skipped; any other rejection is a broken scene.
    expect(Object.keys(built.rejected).filter((k) => !/:(tooClose|overlap)$/.test(k)), name).toEqual([]);
  });
});
