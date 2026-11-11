/** The layout lab's shared state: the design (a layout with undo history), the shared camera, the tool, what the pointer and the lists name, and the layer toggles. */
import { fitRect, fitted, type Box, type View } from './camera';
import { designFromLayout, sameTarget, type Design, type Target } from './design';
import { DEFAULT_LAYERS, type Layers } from './gridDraw';
import { commit, fresh, live, redo, undo, type History } from './history';
import { contentBounds, deleteRoom, moduleDef, moduleTiles, removeModule, rotateModule, type Layout, type Tile } from './layout';
import { problemsOf, type Problem } from './problems';
import { placementProblem } from './world';
import { DEFAULT_SOURCE, buildLayout, type Source } from './source';

export const dpr = (): number => window.devicePixelRatio || 1;
export type Tool = 'select' | 'floor' | 'wall' | 'door' | 'space' | 'room' | 'module';
export interface Ghost { def: string; x: number; y: number; rot: number; error: string | null }

class Lab {
  hist = $state.raw<History<Layout> | null>(null);
  design = $state.raw<Design | null>(null);
  label = '';
  source = $state<Source>({ ...DEFAULT_SOURCE });
  error = $state('');
  view = $state<View>({ cx: 0, cy: 0, zoom: 1 });
  hover = $state.raw<Target | null>(null);
  selected = $state.raw<Target | null>(null);
  layers = $state<Layers>({ ...DEFAULT_LAYERS });
  tool = $state<Tool>('select');
  /** The role a new room gets (picked in the palette's room types). */
  role = $state('cargo');
  /** The module armed for placing, and the turn it will be placed at. */
  armed = $state<string | null>(null);
  rot = $state(0);
  ghost = $state.raw<Ghost | null>(null);
  /** A rectangle being dragged (design tiles). */
  drag = $state.raw<{ x: number; y: number; w: number; h: number; ok: boolean } | null>(null);
  problems = $state.raw<Problem[]>([]);
  /** Tiles a clicked problem points at. */
  flag = $state.raw<Tile[]>([]);
  /** The grid pane's size, for fitting a new design. */
  gridBox: Box = { w: 900, h: 600 };
  /** The grid pane has reported its real size (the first design is fitted then). */
  sized = false;
  private timer = 0;

  get layout(): Layout | null { return this.hist?.present ?? null; }
  get canUndo(): boolean { return !!this.hist && this.hist.past.length > 0; }
  get canRedo(): boolean { return !!this.hist && this.hist.future.length > 0; }

  private show(l: Layout): void {
    this.design = designFromLayout(l, this.label);
    clearTimeout(this.timer);
    this.timer = window.setTimeout(() => { this.problems = problemsOf(l); }, 250);
  }

  import(s: Source): void {
    try {
      const { layout, label } = buildLayout(s);
      this.source = { ...s };
      this.label = label;
      this.hist = fresh(layout);
      this.show(layout);
      this.error = '';
      this.hover = this.selected = null;
      this.flag = [];
      this.ghost = this.drag = null;
      this.view = fitted(layout.width, layout.height, dpr(), this.gridBox);
      if (this.sized) this.fit();
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e);
    }
  }
  /** Fit the whole design in the grid pane (any zoom; the preview takes the nearest ladder step). */
  fit(): void {
    const l = this.layout;
    const b = l && contentBounds(l);
    if (l && b) this.view = fitRect(b.x0, b.y0, b.x1, b.y1, dpr(), this.gridBox);
  }

  /** One discrete edit (a button, a placement): one undo step. */
  edit(fn: (l: Layout) => Layout): void {
    const h = this.hist;
    if (!h) return;
    const next = fn(h.present);
    if (next === h.present) return;
    this.hist = commit(live(h, next), h.present);
    this.show(next);
  }
  /** A gesture (a paint stroke, a drag): `step` many times, then `end`; undone as one. */
  private from: Layout | null = null;
  begin(): void { this.from = this.layout; }
  step(fn: (l: Layout) => Layout): void {
    const h = this.hist;
    if (!h) return;
    const next = fn(h.present);
    if (next === h.present) return;
    this.hist = live(h, next);
    this.show(next);
  }
  end(): void {
    if (this.hist && this.from) this.hist = commit(this.hist, this.from);
    this.from = null;
  }
  undo(): void { if (this.hist) { this.hist = undo(this.hist); this.afterJump(); } }
  redo(): void { if (this.hist) { this.hist = redo(this.hist); this.afterJump(); } }
  private afterJump(): void {
    if (!this.hist) return;
    this.show(this.hist.present);
    const s = this.selected;
    if (s && ((s.kind === 'module' && !this.hist.present.modules[s.index]) || (s.kind === 'room' && !this.hist.present.rooms[s.id]))) this.selected = null;
  }

  /** Delete: the selected module or room. */
  removeSelected(): void {
    const s = this.selected;
    if (s?.kind === 'module') this.edit((l) => removeModule(l, s.index));
    else if (s?.kind === 'room') this.edit((l) => deleteRoom(l, s.id));
    this.selected = null;
  }
  setHover(t: Target | null): void {
    if (!sameTarget(this.hover, t) || (!t && this.hover)) this.hover = t;
  }
  select(t: Target | null): void {
    this.selected = sameTarget(this.selected, t) ? null : t;
    this.flag = [];
  }
  setTool(t: Tool): void {
    this.tool = t;
    if (t !== 'module') this.ghost = null;
    if (t !== 'room') this.drag = null;
  }
  /** Arm a module for placing (the palette's list). */
  arm(def: string): void {
    this.armed = def;
    this.setTool('module');
  }
  /** A module being dragged (its index): the ghost shows where it would land, checked with the module itself set aside. */
  moving = $state<number | null>(null);
  /** The ghost of a module with its top-left at (x, y): the game's placement owner's reason it cannot stand there, if any. */
  aim(def: string | null, x: number, y: number, rot = this.rot): void {
    const l = this.layout;
    if (!l || !def || !moduleDef(def)) { this.ghost = null; return; }
    this.ghost = { def, x, y, rot, error: placementProblem(l, def, x, y, rot, this.moving ?? undefined) };
  }
  /** R: turn the ghost, else the selected module, a quarter turn. */
  rotate(): void {
    const g = this.ghost;
    if (g) {
      this.rot = (g.rot + 1) % 4;
      this.aim(g.def, g.x, g.y, this.rot);
    } else if (this.selected?.kind === 'module') {
      const i = this.selected.index;
      this.edit((l) => rotateModule(l, i));
    }
  }
  ghostTiles(): Tile[] {
    const g = this.ghost;
    return g ? moduleTiles({ def: g.def, x: g.x, y: g.y, rot: g.rot }) : [];
  }
}
export const lab = new Lab();
