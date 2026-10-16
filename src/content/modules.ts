import type { ModuleDef } from '../sim';

/**
 * Ship modules. Power is in units per second (+ supply, - draw). Footprints are [w, h] at
 * rotation 0; `access` is the tile (offset from the footprint's top-left) crew stand on.
 * `asset` ids name models in the render asset manifest.
 */
export const modules = {
  'module.reactor': {
    name: 'Reactor',
    asset: 'module.reactor',
    footprint: [2, 2],
    solid: true,
    power: 50,
    priority: 1,
    heatPerSec: 8,
    flammability: 0.1,
    maxHp: 200,
    buildWork: 240,
  },
  'module.lifeSupport': {
    name: 'Life support',
    asset: 'module.life_support',
    footprint: [1, 2],
    solid: true,
    power: -6,
    priority: 1,
    o2PerSec: 3,
    co2ScrubPerSec: 1,
    flammability: 0.2,
    maxHp: 100,
    buildWork: 160,
  },
  // A lamp on a floor tile beside a wall. Not solid: crew walk over it.
  'module.light': {
    name: 'Light',
    asset: 'module.light',
    footprint: [1, 1],
    solid: false,
    power: -1,
    priority: 2,
    light: { radius: 7, level: 230 },
    flammability: 0.1,
    maxHp: 30,
    buildWork: 40,
  },
  'module.bed': {
    name: 'Bed',
    asset: 'module.bed',
    footprint: [1, 2],
    solid: false,
    power: 0,
    flammability: 0.5,
    maxHp: 50,
    buildWork: 80,
    bed: true,
  },
  'module.console': {
    name: 'Console',
    asset: 'module.console',
    footprint: [1, 1],
    solid: true,
    // Crew stand on the tile below (rotation 0).
    access: [0, 1],
    power: -3,
    priority: 4,
    flammability: 0.3,
    maxHp: 60,
    buildWork: 100,
    workstation: true,
  },
} satisfies Record<string, ModuleDef>;
