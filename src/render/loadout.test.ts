import { describe, expect, it } from 'vitest';
import type { ClipDef, LayerAsset } from './assets/manifest';
import type { Atlas, LayerSprite } from './assets/loader';
import type { Crew } from '../sim/crew/components';
import { crewLoadout, resolveClip } from './loadout';

const clip = (sheet: string): ClipDef => ({ sheet, start: 0, frames: 4, fps: 4, loop: true });
const layer = (names: string[]): LayerAsset => ({
  kind: 'crew.layer', species: 'human', slot: 'torso', order: 30, frameW: 1, frameH: 1, anchor: { x: 0, y: 0 },
  clips: Object.fromEntries(names.map((n) => [n, clip(`s.${n}`)])),
});

describe('resolveClip', () => {
  it('plays the requested clip when the layer has it', () => {
    expect(resolveClip(layer(['idle', 'walk']), 'walk')?.sheet).toBe('s.walk');
  });
  it('falls back to idle for a clip the layer lacks (eva_float on an item without it)', () => {
    expect(resolveClip(layer(['idle', 'walk']), 'eva_float')?.sheet).toBe('s.idle');
  });
  it('hides a layer without sit sheets while seated, and sit_work falls back to sit_idle', () => {
    expect(resolveClip(layer(['idle']), 'sit_idle')).toBeUndefined();
    expect(resolveClip(layer(['idle']), 'sit_work')).toBeUndefined();
    expect(resolveClip(layer(['idle', 'sit_idle']), 'sit_work')?.sheet).toBe('s.sit_idle');
  });
  it('is undefined for a layer with no clips at all', () => {
    expect(resolveClip(layer([]), 'idle')).toBeUndefined();
  });
});

describe('crewLoadout', () => {
  const ids = ['body', 'eyes.organic', 'eyes.cyber', 'hair.short', 'hair.mohawk', 'hair.bun', 'arm.L.flesh', 'arm.L.cyber',
    'arm.R.flesh', 'torso.tee', 'torso.work_shirt', 'torso.medic_vest', 'torso.armor_vest', 'legs.cargo_pants',
    'gear.back.medkit', 'gear.head.tactical_helmet'].map((i) => `crew.human.${i}`);
  const atlas = {
    layer: (id: string) => (ids.includes(id) ? { def: { ...layer(['idle']), order: ids.indexOf(id) }, id } : undefined),
    ids: (prefix: string) => ids.filter((i) => i.startsWith(prefix)),
  } as unknown as Atlas;
  const crew = (role: string, appearanceSeed = 1): Crew =>
    ({ name: 'x', role, species: 'species.human', appearanceSeed, activity: 'idle' }) as unknown as Crew;
  const worn = (c: Crew) => crewLoadout(atlas, c).map((l) => (l as LayerSprite & { id: string }).id);

  it('dresses a medic in the medic vest and medkit', () => {
    expect(worn(crew('role.medic'))).toEqual(expect.arrayContaining(['crew.human.torso.medic_vest', 'crew.human.gear.back.medkit']));
    expect(worn(crew('role.medic'))).not.toContain('crew.human.torso.tee');
  });
  it('keeps the engineer kit (cyber eye and arm, work shirt)', () => {
    expect(worn(crew('role.engineer'))).toEqual(expect.arrayContaining(['crew.human.eyes.cyber', 'crew.human.arm.L.cyber', 'crew.human.torso.work_shirt']));
  });
  it('gives a role without a kit the tee', () => {
    expect(worn(crew('role.cook'))).toContain('crew.human.torso.tee');
  });
  it('never puts tall hair under a helmet', () => {
    for (let seed = 0; seed < 50; seed++) {
      const w = worn(crew('role.security', seed));
      expect(w).toContain('crew.human.gear.head.tactical_helmet');
      expect(w).not.toContain('crew.human.hair.mohawk');
      expect(w).not.toContain('crew.human.hair.bun');
    }
  });
});
