import { Container } from 'pixi.js';
import { renderGroup } from './renderGroups';

/** Draw layers, bottom to top. Everything depth-sorted (walls, props, crew, glow) shares `sorted`. */
export interface Layers {
  world: Container;
  /** Below the deck (the hull's belly), depth sorted; the floor plates in front hide it. */
  under: Container;
  floor: Container;
  /** Flat tinted tiles above the floor (overlays). */
  decal: Container;
  /** Walls, doors, props, crew, blueprints, crew glow; sorted by zIndex. */
  sorted: Container;
  /** Translucent effects above everything in the world (smoke). */
  fx: Container;
  /** Additive particles (embers, sparks). */
  fxAdd: Container;
  /** Selection, hover and build-preview markers. */
  ui: Container;
  readonly halos: boolean;
  /** Device px per art px (integer camera zoom). */
  readonly scale: number;
  setScale(scale: number): void;
}

export function createLayers(halos: boolean): Layers {
  const world = new Container();
  const under = new Container();
  under.sortableChildren = true;
  const floor = new Container();
  const decal = new Container();
  const sorted = new Container();
  const fx = new Container();
  const fxAdd = new Container();
  fxAdd.blendMode = 'add';
  const ui = new Container();
  sorted.sortableChildren = true;
  let scale = 1;
  world.addChild(under, floor, decal, sorted, fx, fxAdd, ui);
  // Render groups (#389): a camera move is one group transform, and hiding layers for a pass rebuilds only `world`'s list.
  for (const c of [world, under, floor, decal, sorted, fx, ui]) renderGroup(c); // not fxAdd (see renderGroups.ts)
  return {
    world,
    under,
    floor,
    decal,
    sorted,
    fx,
    fxAdd,
    ui,
    halos,
    get scale() {
      return scale;
    },
    setScale(sc) {
      scale = sc;
      world.scale.set(sc);
    },
  };
}
