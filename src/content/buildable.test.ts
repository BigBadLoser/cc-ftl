import { describe, expect, it } from 'vitest';
import { content } from './index';

describe('player-buildable modules', () => {
  it('keeps found-only modules out of the build menu and gone decor out of the game', () => {
    for (const id of ['module.robotFabricator', 'module.robotBay', 'container.2x4', 'container.3x6', 'module.banner']) expect(content.modules[id]?.buildable, id).toBe(false);
    expect(content.modules['module.deck_inlay']).toBeUndefined();
    expect(content.modules['module.deck_hazard']).toBeUndefined();
  });
});
