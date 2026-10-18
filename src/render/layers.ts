import { BlurFilter, Container } from 'pixi.js';

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
  /** Blurred additive copy of glow sprites (Quality High only). */
  halo: Container;
  /** Selection, hover and build-preview markers. */
  ui: Container;
  /** A blurred additive halo group depth sorted into `sorted` at `z` (a console's glow, which must stay under the seated crew); Quality High only. */
  haloAt(z: number): Container;
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
  const halo = new Container();
  const ui = new Container();
  sorted.sortableChildren = true;
  let scale = 1;
  const blur = new BlurFilter({ strength: 4, quality: 3 });
  halo.filters = [blur];
  halo.blendMode = 'add';
  halo.visible = halos;
  world.addChild(under, floor, decal, sorted, fx, fxAdd, halo, ui);
  const haloAt = (z: number): Container => {
    const c = new Container();
    c.filters = [blur];
    c.blendMode = 'add';
    c.zIndex = z;
    sorted.addChild(c);
    return c;
  };
  return {
    world,
    under,
    floor,
    decal,
    sorted,
    fx,
    fxAdd,
    halo,
    ui,
    halos,
    haloAt,
    get scale() {
      return scale;
    },
    setScale(sc) {
      scale = sc;
      world.scale.set(sc);
      blur.strength = 1.5 * sc;
    },
  };
}
