/** The layout lab's shared state: the design, the shared camera, what the pointer and the lists name, and the layer toggles. */
import { fitted, type Box, type View } from './camera';
import { sameTarget, type Design, type Target } from './design';
import { DEFAULT_LAYERS, type Layers } from './gridDraw';
import { DEFAULT_SOURCE, buildDesign, type Source } from './source';

export const dpr = (): number => window.devicePixelRatio || 1;

class Lab {
  design = $state.raw<Design | null>(null);
  source = $state<Source>({ ...DEFAULT_SOURCE });
  error = $state('');
  view = $state<View>({ cx: 0, cy: 0, zoom: 1 });
  hover = $state.raw<Target | null>(null);
  selected = $state.raw<Target | null>(null);
  layers = $state<Layers>({ ...DEFAULT_LAYERS });
  /** The grid pane's size, for fitting a new design. */
  gridBox: Box = { w: 900, h: 600 };
  /** The grid pane has reported its real size (the first design is fitted then). */
  sized = false;

  import(s: Source): void {
    try {
      const d = buildDesign(s);
      this.source = { ...s };
      this.design = d;
      this.error = '';
      this.hover = this.selected = null;
      this.view = fitted(d.width, d.height, dpr(), this.gridBox);
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e);
    }
  }
  fit(): void {
    if (this.design) this.view = fitted(this.design.width, this.design.height, dpr(), this.gridBox);
  }
  setHover(t: Target | null): void {
    if (!sameTarget(this.hover, t) || (!t && this.hover)) this.hover = t;
  }
  select(t: Target | null): void {
    this.selected = sameTarget(this.selected, t) ? null : t;
  }
}
export const lab = new Lab();
