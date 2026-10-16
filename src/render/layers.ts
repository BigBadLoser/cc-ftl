import { BlurFilter, Container } from 'pixi.js';

/** Draw layers, bottom to top. Everything depth-sorted (walls, props, crew, glow) shares `sorted`. */
export interface Layers {
  world: Container;
  floor: Container;
  /** Flat tinted tiles above the floor (overlays). */
  decal: Container;
  /** Walls, doors, props, crew, blueprints, crew glow; sorted by zIndex. */
  sorted: Container;
  /** Translucent effects above everything in the world (smoke). */
  fx: Container;
  /** Blurred additive copy of glow sprites (Quality High only). */
  halo: Container;
  /** Selection, hover and build-preview markers. */
  ui: Container;
  readonly halos: boolean;
  setScale(scale: number): void;
}

export function createLayers(halos: boolean): Layers {
  const world = new Container();
  const floor = new Container();
  const decal = new Container();
  const sorted = new Container();
  const fx = new Container();
  const halo = new Container();
  const ui = new Container();
  sorted.sortableChildren = true;
  const blur = new BlurFilter({ strength: 4, quality: 3 });
  halo.filters = [blur];
  halo.blendMode = 'add';
  halo.visible = halos;
  world.addChild(floor, decal, sorted, fx, halo, ui);
  return {
    world,
    floor,
    decal,
    sorted,
    fx,
    halo,
    ui,
    halos,
    setScale(scale) {
      world.scale.set(scale);
      blur.strength = 1.5 * scale;
    },
  };
}
