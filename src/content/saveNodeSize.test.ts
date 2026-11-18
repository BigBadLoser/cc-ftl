/** A node saved before the node floor was raised (200 x 120) loads at the floor (sector/size.ts): the current sector and every archived one. */
import { describe, expect, it } from 'vitest';
import { newGame } from '../sim/newGame';
import { deserialize, serialize } from '../sim/save';
import { restoreArchive } from '../sim/sector/archive';
import { SECTOR_HEIGHT, SECTOR_WIDTH } from '../sim/tuning';
import { content } from './index';

describe('node size floor on load (#129)', () => {
  it('raises an old 200x120 sector and archive to the floor, and keeps a node that grew past it', () => {
    const sim = newGame(3, content);
    const data = JSON.parse(serialize(sim)) as { sector: { width: number; height: number }; archives: { node: string; width: number; height: number; grid: unknown; entities: unknown[] }[] };
    const grid = (JSON.parse(serialize(sim)) as { sector: { grid: unknown } }).sector.grid;
    data.sector.height = 120;
    data.archives = [
      { node: 'old', width: 200, height: 120, grid, entities: [] },
      { node: 'grown', width: 260, height: 240, grid, entities: [] },
    ];
    const loaded = deserialize(JSON.stringify(data), content);
    expect([loaded.sector.width, loaded.sector.height]).toEqual([SECTOR_WIDTH, SECTOR_HEIGHT]);
    expect(SECTOR_HEIGHT).toBeGreaterThanOrEqual(200);
    loaded.archives = loaded.archives.filter((a) => a.node !== 'grown');
    expect(restoreArchive(loaded, 'old')).toBe(true);
    expect([loaded.sector.width, loaded.sector.height]).toEqual([SECTOR_WIDTH, SECTOR_HEIGHT]);
    const again = deserialize(JSON.stringify(data), content);
    expect(restoreArchive(again, 'grown')).toBe(true);
    expect([again.sector.width, again.sector.height]).toEqual([260, 240]);
  });
});
