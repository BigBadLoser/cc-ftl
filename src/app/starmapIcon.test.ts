import { describe, expect, it } from 'vitest';
import { newGame } from '../sim';
import { content } from '../content';
import { iconOf } from './starmapSnapshot';
import manifest from '../../public/assets/1x/manifest.json';

const frames: Record<string, unknown> = manifest.assets;

describe('starmap structure icons', () => {
  const sim = newGame(1, content);
  const defs = Object.entries(content.galaxy?.structures ?? {});

  it('gives every structure a sprite that exists in the sheet', () => {
    expect(defs.length).toBeGreaterThan(0);
    for (const [id] of defs) for (const faction of [null, ...Object.keys(content.galaxy?.factions ?? {})]) expect(frames[iconOf(sim, id, faction).sprite], `${id} / ${faction}`).toBeDefined();
  });

  it('shows stations as station or den icons, never as a ship or fleet frame', () => {
    for (const [id, d] of defs) {
      const sprite = iconOf(sim, id, null).sprite;
      expect(sprite).not.toMatch(/fleet|ship/);
      if (d.kind === 'station') expect(sprite).toBe(`starmap.struct.station_${d.station ?? 'trade'}`);
    }
  });

  it('draws a station held by pirates as their den, and falls back to a derelict for an unknown structure', () => {
    const pirates = Object.entries(content.galaxy?.factions ?? {}).find(([, f]) => f.kind === 'pirates')?.[0] ?? null;
    const station = defs.find(([, d]) => d.kind === 'station')?.[0] as string;
    expect(iconOf(sim, station, pirates).sprite).toBe(pirates ? 'starmap.struct.den' : iconOf(sim, station, null).sprite);
    expect(iconOf(sim, 'structure.missing', null)).toMatchObject({ sprite: 'starmap.struct.derelict', tone: null });
  });
});
