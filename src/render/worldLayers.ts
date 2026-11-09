import { Container } from 'pixi.js';
import type { Layers } from './layers';
import { renderGroup } from './renderGroups';
import { DepthBands, DepthParent } from './depthBands';

/**
 * One world layer stack for the whole sector (ARCHITECTURE "Sector grid" §7 step 5a). Every region (ship) decorates it:
 * its views add sprites to the region's own containers, which sit at the region's sector offset inside shared layers.
 * The depth-sorted sprites of every region (walls, props, crew, low bodies) render in one order by `zIndex + region depth`
 * (through depth bands, `depthBands.ts`), so one ship's sprites sort against another's and against bodies outside any hull.
 *
 * Bottom to top: under, floor, decal, sorted, fx, fxAdd, ui, marks. Flat layers keep a sub-container per region,
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
  /** Everything but the ui and marks layers: the minified view draws that art into a texture and only the ui layers directly. */
  setArtVisible(on: boolean): void;
  /** The depth-sorted sprites in draw order (tests, debugging; `DepthBands.drawOrder`). */
  drawOrder(asBuilt?: boolean): Container[];
}

/** One region's view of the shared stack: a `Layers` whose containers live in the shared layers at the region's offset. */
export interface RegionLayers extends Layers {
  /** Target marks for the combat panel (only drawn in pass B). */
  readonly marks: Container;
  /** Art px offset of the region's tile (0, 0) in the sector frame, and the depth (x + y in tiles) its zIndex values add. */
  setOrigin(ax: number, ay: number, depth: number): void;
  /** Show or hide the whole region (culling, a scene still being built). Authoritative: nothing shows while it is off. */
  setVisible(on: boolean): void;
  readonly visible: boolean;
  /** Show or hide some of the region's own layers (a rock roof hides the base under it); they show only while the region does. */
  setPartsVisible(parts: readonly Container[], on: boolean): void;
  dispose(): void;
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
  const fx = flat();
  const fxAdd = flat();
  fxAdd.blendMode = 'add';
  const ui = flat();
  const marks = flat();
  marks.visible = false;
  // The depth-sorted sprites (walls, props, crew, low bodies of every region) draw through depth bands (depthBands.ts) in
  // `art`, whose other children are their scene parents (transforms only, left out of the build).
  const art = new Container();
  art.enableRenderGroup(); // always a group (the bands rely on it), so not in the debug switch
  const bands = new DepthBands(art);
  const anchors = new Container();
  anchors.includeInBuild = false;
  const low = new DepthParent(bands);
  art.addChild(anchors, low);
  root.addChild(under, floor, decal, art, fx, fxAdd, ui, marks);
  // Render groups (#389): the camera moves only `root`'s group transform, not every sprite's, and a pass that hides some
  // layers (the minified art pass, the combat inset) rebuilds only `root`'s short list of groups, not the sprites in them.
  for (const c of [root, under, floor, decal, fx, ui, marks]) renderGroup(c); // not fxAdd (see renderGroups.ts)
  let scale = 1;

  return {
    root,
    low,
    setScale(sc) {
      scale = sc;
    },
    setUiVisible(on) {
      ui.visible = on;
    },
    setMarksVisible(on) {
      marks.visible = on;
    },
    setArtVisible(on) {
      for (const c of [under, floor, decal, art, fx, fxAdd]) c.visible = on;
    },
    drawOrder: (asBuilt) => bands.drawOrder(asBuilt),
    region(halos) {
      const parts = { under: flat(), floor: new Container(), decal: new Container(), sorted: new DepthParent(bands), fx: new Container(), fxAdd: new Container(), ui: new Container(), marks: new Container() };
      parts.under.sortableChildren = true;
      under.addChild(parts.under);
      floor.addChild(parts.floor);
      decal.addChild(parts.decal);
      anchors.addChild(parts.sorted);
      fx.addChild(parts.fx);
      fxAdd.addChild(parts.fxAdd);
      ui.addChild(parts.ui);
      marks.addChild(parts.marks);
      const all = Object.values(parts);
      parts.fxAdd.blendMode = 'add';
      let visible = true;
      /** Parts the region's views hide on their own. */
      const off = new Set<Container>();
      return {
        world: parts.sorted,
        under: parts.under,
        floor: parts.floor,
        decal: parts.decal,
        sorted: parts.sorted,
        fx: parts.fx,
        fxAdd: parts.fxAdd,
        ui: parts.ui,
        marks: parts.marks,
        halos,
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
          parts.sorted.setDepthBase(d);
        },
        setVisible(on) {
          if (on === visible) return;
          visible = on;
          for (const c of all) c.visible = on && !off.has(c);
          bands.recheckAll(); // its sprites draw from the bands, which must rebuild to drop or add them
        },
        setPartsVisible(list, on) {
          let changed = false;
          for (const c of list) {
            if (on ? !off.delete(c) : off.has(c)) continue;
            if (!on) off.add(c);
            changed = true;
            c.visible = visible && on;
          }
          if (changed) bands.recheckAll();
        },
        get visible() {
          return visible;
        },
        dispose() {
          for (const c of all) c.destroy({ children: true });
        },
      };
    },
  };
}
