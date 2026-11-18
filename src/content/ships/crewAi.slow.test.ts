import { describe, it } from 'vitest';
import { expectScriptedReplay } from '../../../test/support/fixtures/crewAi';

describe('crew AI phase 1, every tick', () => {
  it('replays exactly: three runs give the same events and tick hashes, and random save/load points change nothing', () => {
    expectScriptedReplay(1);
  });
});
