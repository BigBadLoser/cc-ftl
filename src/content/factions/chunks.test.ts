import { describe, expect, it } from 'vitest';
import { roleOfLetter, type ChunkDef } from '../../sim';
import { factions } from './index';

/** Problems of a chunk drawing: open floor, rooms touching without a wall, missing attach doors, unknown chars. */
function chunkProblems(c: ChunkDef, kind: 'bow' | 'stern' | 'pod' | 'nub'): string[] {
  const out: string[] = [];
  const w = Math.max(...c.rows.map((r) => r.length));
  const at = (x: number, y: number): string => c.rows[y]?.[x] ?? '.';
  const floor = (ch: string): boolean => ch !== '.' && ch !== '#' && ch !== 'D';
  for (let y = 0; y < c.rows.length; y++) {
    for (let x = 0; x < w; x++) {
      const ch = at(x, y);
      if (!floor(ch)) continue;
      if (!roleOfLetter(ch)) out.push(`unknown ${ch} at ${x},${y}`);
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const) {
        const n = at(nx, ny);
        if (n === '.') out.push(`open floor at ${x},${y}`);
        else if (floor(n) && n !== ch) out.push(`${ch} touches ${n} at ${x},${y}`);
      }
    }
  }
  const edge = kind === 'bow' ? c.rows.map((r) => r[w - 1]) : kind === 'stern' ? c.rows.map((r) => r[0]) : [...(c.rows[c.rows.length - 1] ?? '')];
  if (!edge.includes('D')) out.push('no attach door');
  return out;
}

describe('faction chunks', () => {
  for (const [id, f] of Object.entries(factions)) {
    it(`${id}: every nose chunk is closed, its rooms walled apart, with a door on its attach edge`, () => {
      for (const c of f.architecture.noses) expect(chunkProblems(c, 'bow'), c.id).toEqual([]);
    });
  }
});
