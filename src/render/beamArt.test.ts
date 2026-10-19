import { describe, expect, it } from 'vitest';
import { Struct } from '../sim/structure';
import { beamIds, beamLookFor } from './beamArt';

const grid = (rows: string[]) => (x: number, y: number): number => {
  const c = rows[y]?.[x] ?? '.';
  return c === '=' ? Struct.Beam : c === '#' ? Struct.Wall : c === '_' ? Struct.Floor : Struct.Space;
};

describe('beamArt', () => {
  it('picks the mask from the four beam neighbours (N1 E2 S4 W8)', () => {
    const k = grid(['.=.', '===', '.=.']);
    expect(beamIds(k, 1, 1, 'navy')).toEqual(['struct.beam.navy.m15']);
    expect(beamIds(k, 1, 0, 'navy')[0]).toBe('struct.beam.navy.m4');
    expect(beamIds(k, 2, 1, 'navy')[0]).toBe('struct.beam.navy.m8');
  });
  it('caps a free end, but a hull wall there gets a flange instead', () => {
    expect(beamIds(grid(['.=.', '.=.', '...']), 1, 1, 'drone')).toEqual(['struct.beam.drone.m1', 'struct.beam.drone.cap.s']);
    expect(beamIds(grid(['.=.', '.=.', '.#.']), 1, 1, 'drone')).toEqual(['struct.beam.drone.m1', 'struct.beam.drone.flange.s']);
    const both = beamIds(grid(['.=.', '#=#', '.=.']), 1, 1, 'civil');
    expect(both[0]).toMatch(/^struct\.beam\.civil\.m5(\.v[12])?$/);
    expect(both.slice(1)).toEqual(['struct.beam.civil.flange.e', 'struct.beam.civil.flange.w']);
  });
  it('varies straight runs deterministically', () => {
    const k = grid(['=================']);
    const picks = new Set(Array.from({ length: 15 }, (_, i) => beamIds(k, i + 1, 0, 'scrap')[0]));
    expect(picks.size).toBeGreaterThan(1);
    expect(beamIds(k, 3, 0, 'scrap')).toEqual(beamIds(k, 3, 0, 'scrap'));
  });
  it('maps factions to looks with a default', () => {
    expect(beamLookFor('faction.scrapper')).toBe('scrap');
    expect(beamLookFor('faction.drones')).toBe('drone');
    expect(beamLookFor(undefined)).toBe('civil');
  });
});
