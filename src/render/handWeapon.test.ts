import { describe, expect, it } from 'vitest';
import type { ClipDef, LayerAsset } from './assets/manifest';
import type { Atlas } from './assets/loader';
import type { World } from '../sim/ecs';
import { items } from '../content/items';
import { crewMuzzle, drawnWeapon } from './crewMuzzle';
import { FAMILY, fireClip, isCombatClip, layerShown, muzzleAt, prefetchClips, stanceClip, weaponLayerIds } from './handWeapon';
import { resolveClip } from './loadout';

const clip = (o: Partial<ClipDef> = {}): ClipDef => ({ sheet: 's', start: 0, frames: 3, fps: 12, loop: false, ...o });

describe('item art', () => {
  it('maps the hand items to art weapons and families', () => {
    const art = (i: keyof typeof items) => (items[i] as { hand: { art?: unknown } }).hand.art;
    expect(art('item.sidearm')).toEqual({ id: 'sidearm', family: '1h' });
    expect(art('item.rifle')).toEqual({ id: 'rifle', family: '2h' });
    expect(art('item.ion_pistol')).toEqual({ id: 'ion_pistol', family: '1h' });
    expect(art('item.blade')).toEqual({ id: 'blade', family: '1m' });
  });
});

describe('stanceClip', () => {
  it('plays no combat clip out of a fight', () => {
    expect(stanceClip('2h', { engaged: false, moving: false })).toBeNull();
    expect(stanceClip('2h', { engaged: false, moving: true })).toBeNull();
  });
  it('aims when engaged and still, walks with the weapon up when engaged and moving', () => {
    expect(stanceClip('1h', { engaged: true, moving: false })).toBe('aim_1h');
    expect(stanceClip('2h', { engaged: true, moving: true })).toBe('walk_aim_2h');
    expect(stanceClip('heavy', { engaged: true, moving: true })).toBe('walk_heavy');
  });
  it('readies a melee weapon, and walks plainly (holstered) with it', () => {
    expect(stanceClip('1m', { engaged: true, moving: false })).toBe('ready_1m');
    expect(stanceClip('2m', { engaged: true, moving: true })).toBeNull();
  });
});

describe('fireClip', () => {
  it('plays a shot once for its own length', () => {
    expect(fireClip('2h', clip({ frames: 3, fps: 12 }), 1.6)).toEqual({ clip: 'fire_2h', sec: 0.25 });
    expect(fireClip('1m', clip({ frames: 5, fps: 12 }), 1.2).clip).toBe('swing_1m');
  });
  it('loops the heavy fire clip for the whole cooldown', () => {
    expect(fireClip('heavy', clip({ frames: 4, fps: 12, loop: true }), 0.5).sec).toBe(0.5);
    expect(fireClip('heavy', clip({ frames: 4, fps: 12, loop: true }), 0.1).sec).toBeCloseTo(4 / 12);
  });
  it('queues aim, fire and walk sheets for a fight', () => {
    expect(prefetchClips('2h')).toEqual(['aim_2h', 'fire_2h', 'walk_aim_2h']);
    expect(prefetchClips('1m')).toEqual(['ready_1m', 'swing_1m']);
  });
});

describe('holster and held exclusivity', () => {
  const clips = ['idle', 'walk', 'work', 'sleep', 'sit_idle', 'crouch_idle', 'crouch_walk', ...Object.values(FAMILY).flatMap((f) => [f.aim, f.fire, f.walk ?? ''].filter(Boolean)), 'lean_l_2h'];
  it('never shows both for any clip', () => {
    for (const c of clips) expect(layerShown('gear.hand', c) && layerShown('gear.holster', c)).toBe(false);
  });
  it('shows exactly one: the held weapon in combat clips, the holster otherwise', () => {
    for (const c of clips) expect(layerShown('gear.hand', c)).toBe(isCombatClip(c));
    for (const c of clips) expect(layerShown('gear.holster', c)).toBe(!isCombatClip(c));
  });
  it('leaves other layers alone', () => {
    expect(layerShown('torso', 'aim_1h')).toBe(true);
  });
  it('wears both layers of a weapon', () => {
    expect(weaponLayerIds('crew.human.', { id: 'rifle', family: '2h' })).toEqual(['crew.human.gear.holster.rifle', 'crew.human.gear.hand.rifle']);
    expect(weaponLayerIds('crew.human.', undefined)).toEqual([]);
  });
});

describe('combat clip fallbacks on the body layers', () => {
  const body = (names: string[]) => ({ clips: Object.fromEntries(names.map((n) => [n, clip({ sheet: n })])) }) as unknown as LayerAsset;
  it('a layer lacking a combat pose plays its nearest plainer clip', () => {
    expect(resolveClip(body(['idle', 'walk']), 'aim_2h')?.sheet).toBe('idle');
    expect(resolveClip(body(['idle', 'walk']), 'walk_aim_2h')?.sheet).toBe('walk');
    expect(resolveClip(body(['idle', 'aim_2h']), 'fire_2h')?.sheet).toBe('aim_2h');
    expect(resolveClip(body(['idle', 'ready_1m']), 'swing_1m')?.sheet).toBe('ready_1m');
    expect(resolveClip(body(['idle', 'crouch_idle']), 'crouch_walk')?.sheet).toBe('crouch_idle');
    expect(resolveClip(body(['idle']), 'crouch_walk')?.sheet).toBe('idle');
    expect(resolveClip(body(['idle']), 'lean_l_2h')?.sheet).toBe('idle');
  });
  it('the held weapon (no idle) is hidden for plain clips', () => {
    expect(resolveClip(body(['aim_2h', 'fire_2h']), 'walk')).toBeUndefined();
  });
});

describe('muzzle', () => {
  const c = clip({ muzzle: [[[1, 2], [3, 4]], [[5, 6], [7, 8]]] });
  it('reads the point for a direction and frame, clamping the frame', () => {
    expect(muzzleAt(c, 0, 0)).toEqual({ x: 1, y: 2 });
    expect(muzzleAt(c, 1, 1)).toEqual({ x: 7, y: 8 });
    expect(muzzleAt(c, 0, 9)).toEqual({ x: 3, y: 4 });
  });
  it('is null without a clip, muzzle data or direction row', () => {
    expect(muzzleAt(undefined, 0, 0)).toBeNull();
    expect(muzzleAt(clip(), 0, 0)).toBeNull();
    expect(muzzleAt(c, 5, 0)).toBeNull();
  });
  it('wraps negative and large directions', () => {
    expect(muzzleAt(clip({ muzzle: Array.from({ length: 8 }, (_, i) => [[i, 0]]) }), -1, 0)).toEqual({ x: 7, y: 0 });
  });

  // A tiny world: crew 1 (human, rifle, facing 1), crew 2 (robot with a rifle), crew 3 (human, bare hands).
  const comps = new Map<string, Record<number, unknown>>([
    ['crew', { 1: { species: 'species.human', role: 'role.security' }, 2: { species: 'species.robot', role: 'role.robot_security' }, 3: { species: 'species.human', role: 'role.engineer' } }],
    ['position', { 1: { facing: 1 }, 2: { facing: 1 }, 3: { facing: 1 } }],
    ['equip', { 1: { weapon: 'item.rifle' }, 2: { weapon: 'item.rifle' }, 3: { weapon: null } }],
  ]);
  const world = { get: (id: number, c: { name: string }) => comps.get(c.name)?.[id] } as unknown as World;
  const atlas = {
    layer: (id: string) => {
      if (id === 'crew.human.gear.hand.rifle') return { def: { clips: { fire_2h: clip({ muzzle: [[[0, 0]], [[40, -60]]] }) } } };
      if (id === 'crew.robot.body.security') return { def: { species: 'robot' } };
      return undefined;
    },
  } as unknown as Atlas;
  it('is the fire clip point for the facing of a human with a drawn weapon', () => {
    expect(crewMuzzle(world, atlas, items, 1)).toEqual({ x: 40, y: -60 });
  });
  it('is null for robots (no weapon layers), unarmed crew and unknown weapons', () => {
    expect(drawnWeapon(world, atlas, items, 2)).toBeUndefined();
    expect(crewMuzzle(world, atlas, items, 2)).toBeNull();
    expect(crewMuzzle(world, atlas, items, 3)).toBeNull();
    expect(crewMuzzle(world, atlas, items, 99)).toBeNull();
  });
});
