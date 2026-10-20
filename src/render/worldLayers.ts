import { BlurFilter, Container, RenderLayer, type IRenderLayer } from 'pixi.js';
import type { Layers } from './layers';

/**
 * One world layer stack for the whole sector (ARCHITECTURE "Sector grid" §7 step 5a). Every region (ship) decorates it:
 * its views add sprites to the region's own containers, which sit at the region's sector offset inside shared layers.
 * The depth-sorted sprites of every region (walls, props, crew, low bodies) render through one `DepthLayer`, ordered by
 * `zIndex + region depth`, so one ship's sprites sort against another's and against bodies outside any hull.
 *
 * Bottom to top: under, floor, decal, sorted, fx, fxAdd, halo, ui, marks. Flat layers keep a sub-container per region,
 * sorted by the region's depth.
 */
export interface WorldStack {
  /** Placed and scaled by the camera of the pass being drawn. */
  readonly root: Container;
  /** Sector-frame container (art origin = sector tile (0, 0)) whose children sort in the shared depth layer at sector depth. */
  readonly low: Container;
  /** A new region's layers. */
  region(halos: boolean): RegionLayers;
  /** Device px per art px of the main camera (blur strength, crew outline zoom). */
  setScale(scale: number): void;
  /** Selection / hover / build markers and the per-region UI (pass A only). */
  setUiVisible(on: boolean): void;
  /** Combat panel target marks (pass B only). */
  setMarksVisible(on: boolean): void;
}

/** One region's view of the shared stack: a `Layers` whose containers live in the shared layers at the region's offset. */
export interface RegionLayers extends Layers {
  /** Target marks for the combat panel (only drawn in pass B). */
  readonly marks: Container;
  /** Art px offset of the region's tile (0, 0) in the sector frame, and the depth (x + y in tiles) its zIndex values add. */
  setOrigin(ax: number, ay: number, depth: number): void;
  setVisible(on: boolean): void;
  readonly visible: boolean;
  dispose(): void;
}

/** Depth base of each container whose children are attached to a depth layer (a region's `sorted`, or the sector `low`). */
const depthBase = new WeakMap<Container, number>();

/**
 * A render layer sorted by `zIndex + depth base of the child's scene parent` (a stable sort: ties keep their previous order,
 * which starts as the order they were added in, as Pixi's own `sortableChildren` does).
 */
function createDepthLayer(): IRenderLayer {
  const layer = new RenderLayer({ sortableChildren: true });
  let keys = new Float64Array(256);
  const order: number[] = [];
  const tmp: Container[] = [];
  layer.sortRenderLayerChildren = () => {
    const a = layer.renderLayerChildren;
    const n = a.length;
    if (keys.length < n) keys = new Float64Array(n * 2);
    let parent: Container | null = null;
    let base = 0;
    let sorted = true;
    for (let i = 0; i < n; i++) {
      const c = a[i] as Container;
      if (c.parent !== parent) {
        parent = c.parent;
        base = (parent && depthBase.get(parent)) ?? 0;
      }
      keys[i] = c.zIndex + base;
      if (i > 0 && (keys[i] as number) < (keys[i - 1] as number)) sorted = false;
    }
    if (sorted) return;
    order.length = n;
    for (let i = 0; i < n; i++) order[i] = i;
    order.sort((i, j) => (keys[i] as number) - (keys[j] as number) || i - j);
    tmp.length = n;
    for (let i = 0; i < n; i++) tmp[i] = a[order[i] as number] as Container;
    for (let i = 0; i < n; i++) a[i] = tmp[i] as Container;
    tmp.length = 0;
  };
  return layer;
}

/** Children added to `c` render through `layer` (Pixi detaches them again when they are removed or destroyed). */
function feed(c: Container, layer: IRenderLayer): void {
  c.on('childAdded', (child: Container) => {
    layer.attach(child);
  });
}

const flat = (): Container => {
  const c = new Container();
  c.sortableChildren = true;
  return c;
};

export function createWorldStack(): WorldStack {
  const root = new Container();
  const under = flat();
  const floor = flat();
  const decal = flat();
  const depth = createDepthLayer();
  const fx = flat();
  const fxAdd = flat();
  fxAdd.blendMode = 'add';
  const halo = flat();
  const ui = flat();
  const marks = flat();
  marks.visible = false;
  // Scene parents of the depth-sorted sprites (transforms only; they render through `depth`).
  const anchors = new Container();
  const low = new Container();
  depthBase.set(low, 0);
  feed(low, depth);
  root.addChild(under, floor, decal, depth, fx, fxAdd, halo, ui, marks, anchors, low);
  let scale = 1;
  const blurs = new Set<BlurFilter>();

  return {
    root,
    low,
    setScale(sc) {
      scale = sc;
      for (const b of blurs) b.strength = 1.5 * sc;
    },
    setUiVisible(on) {
      ui.visible = on;
    },
    setMarksVisible(on) {
      marks.visible = on;
    },
    region(halos) {
      const parts = { under: flat(), floor: new Container(), decal: new Container(), sorted: new Container(), fx: new Container(), fxAdd: new Container(), halo: new Container(), ui: new Container(), marks: new Container() };
      parts.under.sortableChildren = true;
      depthBase.set(parts.sorted, 0);
      feed(parts.sorted, depth);
      under.addChild(parts.under);
      floor.addChild(parts.floor);
      decal.addChild(parts.decal);
      anchors.addChild(parts.sorted);
      fx.addChild(parts.fx);
      fxAdd.addChild(parts.fxAdd);
      halo.addChild(parts.halo);
      ui.addChild(parts.ui);
      marks.addChild(parts.marks);
      const all = Object.values(parts);
      // Halos (Quality High, the player's ship only) blur; other regions never make the filter.
      const blur = halos ? new BlurFilter({ strength: 1.5 * scale, quality: 3 }) : null;
      if (blur) {
        blurs.add(blur);
        parts.halo.filters = [blur];
      }
      parts.halo.blendMode = 'add';
      parts.fxAdd.blendMode = 'add';
      parts.halo.visible = halos;
      let visible = true;
      const haloAt = (z: number): Container => {
        const c = new Container();
        if (blur) c.filters = [blur];
        c.blendMode = 'add';
        c.zIndex = z;
        parts.sorted.addChild(c);
        return c;
      };
      return {
        world: parts.sorted,
        under: parts.under,
        floor: parts.floor,
        decal: parts.decal,
        sorted: parts.sorted,
        fx: parts.fx,
        fxAdd: parts.fxAdd,
        halo: parts.halo,
        ui: parts.ui,
        marks: parts.marks,
        halos,
        haloAt,
        get scale() {
          return scale;
        },
        setScale() {
          // The shared root carries the camera scale; regions only read it.
        },
        setOrigin(ax, ay, d) {
          for (const c of all) {
            c.position.set(ax, ay);
            c.zIndex = d;
          }
          // A new base changes `parts.sorted.zIndex` too, which flags the render group for a rebuild (and so a re-sort).
          depthBase.set(parts.sorted, d);
        },
        setVisible(on) {
          if (on === visible) return;
          visible = on;
          for (const c of all) if (c !== parts.halo) c.visible = on;
          parts.halo.visible = on && halos;
        },
        get visible() {
          return visible;
        },
        dispose() {
          if (blur) blurs.delete(blur);
          for (const c of all) c.destroy({ children: true });
        },
      };
    },
  };
}
