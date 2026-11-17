import { describe, expect, it } from 'vitest';
import { content } from './index';

const mods = content.modules as Record<string, { buildable?: false } | undefined>;

describe('player-buildable modules', () => {
  it('keeps found-only modules out of the build menu including old decor', () => {
    for (const id of ['module.robotFabricator', 'module.robotBay', 'container.2x4', 'container.3x6', 'module.banner', 'module.deck_inlay', 'module.deck_hazard']) expect(mods[id]?.buildable, id).toBe(false);
  });
});
