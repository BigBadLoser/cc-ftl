import { describe, expect, it } from 'vitest';
import { transcriptOf } from './transcript';
import { scanView } from './scanView';
import { speakerOf } from './speaker';
import type { SceneShip } from '../../sim/scene/types';

const ship = (seed: number): SceneShip => ({ contact: { id: 1, faction: 'pirates', shipgen: 'faction.scrapper', seed, depth: 1, since: 0 }, stance: 'neutral' });

describe('comms adapters', () => {
  it('cuts story text on its quotes: narration outside, a speaker line inside, {caller} filled in', () => {
    const lines = transcriptOf('A skiff hails you. "It is {caller}." Static. "Dock."', { name: 'Skiff', alt: 'X' }, 'Tam');
    expect(lines.map((l) => l.kind)).toEqual(['narration', 'speech', 'narration', 'speech']);
    expect(lines[1]).toMatchObject({ text: 'It is Tam.', speaker: 'Skiff', speakerAlt: 'X' });
    expect(transcriptOf('Just narration.', { name: 'S' })).toEqual([{ kind: 'narration', text: 'Just narration.' }]);
  });

  it('turns part rows into callouts and the rest into a readout, with alts on a label', () => {
    const v = scanView([{ label: 'Transponder', value: 'A' }, { label: 'Weapons', value: 'hot' }, { label: 'Hull', value: 'Raider class' }], { Transponder: 'B' });
    expect(v.callouts).toEqual([{ id: 'weapons', label: 'Weapons', value: 'hot' }]);
    expect(v.readout[0]).toMatchObject({ label: 'Transponder', alt: 'B', wide: true });
    expect(v.readout[1]).not.toHaveProperty('alt');
  });

  it('seeds the speaker from the scene: stable, a second name that differs, a second ID that differs', () => {
    const a = speakerOf(ship(4471), 'Scrapper Clans raider SC-4471', 'pirates');
    expect(speakerOf(ship(4471), 'Scrapper Clans raider SC-4471', 'pirates')).toEqual(a);
    expect(a.altName).not.toBe(a.name);
    expect(a.tag).toBe('SC-4471');
    expect(a.altTag).not.toBe(a.tag);
    expect(a.altTag.startsWith('SC-')).toBe(true);
    expect(a.look.role).toBe('role.gunner');
  });
});
