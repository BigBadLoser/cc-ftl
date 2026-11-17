import { describe, expect, it } from 'vitest';
import { content } from './index';

const mods = content.modules as Record<string, { buildable?: false } | undefined>;

describe('player-buildable modules', () => {
  it('keeps found-only modules out of the build menu and gone decor out of the game', () => {
    for (const id of ['module.robotFabricator', 'module.robotBay', 'container.2x4', 'container.3x6', 'module.banner']) expect(mods[id]?.buildable, id).toBe(false);
    expect(mods['module.deck_inlay']).toBeUndefined();
    expect(mods['module.deck_hazard']).toBeUndefined();
  });
});
