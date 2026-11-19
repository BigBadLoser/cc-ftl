import { describe, expect, it } from 'vitest';
import { designFromLayout, lampKind } from './design';
import { keyOf } from './gridDraw';
import { addModule, addRoom, moduleDef, newModule } from './layout';
import { paletteModules } from './palette';
import { blankLayout } from './source';
import { placementProblem } from './world';

const LIGHTS = ['module.light', 'module.light_cage', 'module.light_mast'];

describe('the three lights', () => {
  it('are in the palette, each its own kind', () => {
    expect(LIGHTS.every((id) => paletteModules.some((m) => m.id === id))).toBe(true);
    expect(LIGHTS.map((id) => lampKind(id, moduleDef(id)))).toEqual(['floor', 'cage', 'mast']);
    expect(lampKind('module.bed', moduleDef('module.bed'))).toBeNull();
  });
  it('can each be placed in a room by the game rule, and the key names each one there', () => {
    let l = addRoom(blankLayout(30, 20), { x: 5, y: 5, w: 10, h: 6 }, 'cargo').layout;
    LIGHTS.forEach((id, i) => {
      expect(placementProblem(l, id, 6 + 3 * i, 7, 0)).toBeNull();
      l = addModule(l, newModule(id, 6 + 3 * i, 7, 0), i);
    });
    const d = designFromLayout(l, 'lights');
    expect(d.modules.map((m) => m.lamp)).toEqual(['floor', 'cage', 'mast']);
    expect(keyOf(d).extras.filter((e) => e.lamp).map((e) => e.name)).toEqual(['floor light', 'cage lamp', 'light mast']);
  });
});
