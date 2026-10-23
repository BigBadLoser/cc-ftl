import { describe, expect, it } from 'vitest';
import type { ClipDef, LayerAsset } from './assets/manifest';
import type { Atlas, LayerSprite } from './assets/loader';
import type { Crew } from '../sim/crew/components';
import { colOf, crewLoadout, pickFrame, resolveClip } from './loadout';
import { cellOf } from './assets/manifest';

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

describe('pickFrame (clip sheets load on demand)', () => {
  /** A layer whose sheets are "loaded" only if listed; asking for another one records the request. */
  const lazy = (names: string[], ready: string[]) => {
    const asked: string[] = [];
    const l = {
      def: layer(names),
      frame: (c: ClipDef, _d: number, col: number) => { asked.push(c.sheet as string); return ready.includes(c.sheet as string) ? ({ sheet: c.sheet, col } as never) : undefined; },
      glowFrame: () => null,
      request: () => undefined,
    } as LayerSprite;
    return { l, asked };
  };
  it('draws the requested clip when its sheet is loaded', () => {
    const { l } = lazy(['idle', 'walk'], ['s.idle', 's.walk']);
    expect(pickFrame(l, 'walk', 2, 0)?.clip.sheet).toBe('s.walk');
  });
  it('draws the idle frames while the requested clip loads, and asks for the clip', () => {
    const { l, asked } = lazy(['idle', 'swing_1m'], ['s.idle']);
    const d = pickFrame(l, 'swing_1m', 0, 0);
    expect(d?.clip.sheet).toBe('s.idle');
    expect(asked[0]).toBe('s.swing_1m');
  });
  it('is hidden for a clip the layer is never drawn in, whatever is loaded', () => {
    const { l } = lazy(['idle'], ['s.idle']);
    expect(pickFrame(l, 'sit_idle', 0, 0)).toBeUndefined();
  });
  it('is hidden while nothing of the layer is loaded', () => {
    const { l } = lazy(['idle', 'walk'], []);
    expect(pickFrame(l, 'walk', 0, 0)).toBeUndefined();
  });
});

describe('cells and columns', () => {
  it('colOf loops or holds the last frame', () => {
    expect(colOf({ start: 0, frames: 4, fps: 4, loop: true }, 1.25)).toBe(1);
    expect(colOf({ start: 0, frames: 3, fps: 12, loop: false }, 5)).toBe(2);
  });
  it('cellOf is the layer frame unless the clip sheet is trimmed', () => {
    const a = { frameW: 256, frameH: 240 };
    expect(cellOf(a, clip('s'))).toEqual({ w: 256, h: 240, ox: 0, oy: 0 });
    expect(cellOf(a, { ...clip('s'), cw: 90, ch: 120, ox: 70, oy: 60 })).toEqual({ w: 90, h: 120, ox: 70, oy: 60 });
  });
});
