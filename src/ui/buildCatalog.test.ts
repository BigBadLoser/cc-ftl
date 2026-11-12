import { describe, expect, it } from 'vitest';
import { previewGeometry, rotateAccess } from './buildCatalog';

describe('previewGeometry', () => {
  it('marks every access tile (the game table has two stools), and none for a module without one', () => {
    const box = { w: 300, h: 200 };
    const two = previewGeometry(2, 1, [rotateAccess(2, 1, 0, 0, 1), rotateAccess(2, 1, 0, 1, -1)], null, box);
    expect(two.access).toHaveLength(2);
    expect(two.accessLabel).toHaveLength(2);
    expect(new Set(two.access).size).toBe(2);
    const none = previewGeometry(1, 1, [], null, box);
    expect(none.access).toEqual([]);
    expect(none.accessLabel).toEqual([]);
  });
});
