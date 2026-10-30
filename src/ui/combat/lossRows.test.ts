import { describe, expect, it } from 'vitest';
import { lossRows } from './lossRows';

const line = (name: string, x = 0) => ({ name, subject: { kind: 'tile' as const, x, y: 0 } });

describe('lossRows', () => {
  it('folds the same name and state, even from separate tiles, and keeps the first target', () => {
    const rows = lossRows({ lost: [line('Light', 1), line('Engine', 2), line('Light', 3)], damaged: [], down: [], dead: [] });
    expect(rows.map((r) => [r.name, r.n])).toEqual([['Light', 2], ['Engine', 1]]);
    expect(rows[0]?.subject).toEqual({ kind: 'tile', x: 1, y: 0 });
  });

  it('keeps one name in two states as two rows', () => {
    const rows = lossRows({ lost: [line('Light')], damaged: [line('Light')], down: [], dead: [] });
    expect(rows.map((r) => r.state)).toEqual(['DESTROYED', 'DAMAGED']);
  });
});
