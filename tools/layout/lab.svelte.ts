/** The layout lab's shared state: the design (a layout with undo history), the shared camera, the tool, what the pointer and the lists name, and the layer toggles. */
import { fitRect, fitted, previewView, type Box, type View } from './camera';
import { designFromLayout, sameTarget, type Design, type Target } from './design';
import { DEFAULT_LAYERS, type Layers } from './gridDraw';
import { commit, fresh, live, redo, undo, type History } from './history';
import { contentBounds, deleteRoom, moduleDef, moduleTiles, removeModule, rotateModule, type Layout, type Tile } from './layout';
import { problemsOf, type Problem } from './problems';
import { placementProblem } from './world';
import { DEFAULT_SOURCE, buildLayout, specOf, type Source } from './source';
import { caseOf, caseSlug, decodeLayout, parseCase, serializeCase, type CaseFile, type Provenance } from './cases';
import { changeItems, describeChanges, type Change } from './changes';
import { diffLayouts, type Diff } from './diff';
import { frameOf, gridPng } from './gridImage';
import { preview } from './previewHost';
import { anchorFor, newPin, rebase, type Pin } from './pins';

/** What generated the designs: the generators have no version, so the commit the dev server runs on. */
const GENERATOR = `commit ${typeof __COMMIT__ === 'string' ? __COMMIT__ : 'dev'}`;
export const dpr = (): number => window.devicePixelRatio || 1;
export type Tool = 'select' | 'floor' | 'wall' | 'door' | 'space' | 'room' | 'module' | 'note';
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
  /** The layout the design started as (what the change list and a saved case compare against), and where it came from. */
  original = $state.raw<Layout | null>(null);
  provenance = $state.raw<Provenance | null>(null);
  /** Plain-language list of what changed since `original`. */
  changes = $state.raw<Change[]>([]);
  /** The original as a design (for the compare view), and what differs from it. */
  originalDesign = $state.raw<Design | null>(null);
  diff = $state.raw<Diff | null>(null);
  /** Compare mode: the grid is read-only and the tab picks what it shows. */
  compare = $state(false);
  tab = $state<'generated' | 'edited' | 'overlay' | 'side'>('overlay');
  /** The pins, the one being edited (its popover is open on the grid) and the one picked in the list. */
  pins = $state.raw<readonly Pin[]>([]);
  openPin = $state<number | null>(null);
  private nextPin = 1;
  private timer = 0;

  get layout(): Layout | null { return this.hist?.present ?? null; }
  get canUndo(): boolean { return !!this.hist && this.hist.past.length > 0; }
  get canRedo(): boolean { return !!this.hist && this.hist.future.length > 0; }

  private show(l: Layout): void {
    this.design = designFromLayout(l, this.label);
    clearTimeout(this.timer);
    this.pins = rebase(this.pins, l, this.design);
    this.timer = window.setTimeout(() => {
      this.problems = problemsOf(l);
      this.changes = this.original ? changeItems(this.original, l) : [];
      this.diff = this.original ? diffLayouts(this.original, l) : null;
    }, 250);
  }

  import(s: Source): void {
    try {
      const { layout, label } = buildLayout(s);
      this.source = { ...s };
      this.label = label;
      this.hist = fresh(layout);
      this.original = layout;
      this.originalDesign = designFromLayout(layout, label);
      this.provenance = { ...s, spec: specOf(s), generator: GENERATOR };
      this.pins = [];
      this.openPin = null;
      this.changes = [];
      this.diff = null;
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

  // --- compare ---
  /** The design the preview shows: the original on the Generated tab, the edited one otherwise. */
  get previewDesign(): Design | null { return this.compare && this.tab === 'generated' ? this.originalDesign : this.design; }
  toggleCompare(): void {
    this.compare = !this.compare;
    if (this.compare) {
      this.diff = this.original && this.layout ? diffLayouts(this.original, this.layout) : null;
      this.ghost = this.drag = null;
      this.hover = null;
    }
  }
  /** Centre both panes on tiles and flash them (a clicked change). */
  flash(tiles: readonly Tile[]): void {
    if (!tiles.length) return;
    this.view = { ...this.view, cx: tiles.reduce((s, t) => s + t[0], 0) / tiles.length, cy: tiles.reduce((s, t) => s + t[1], 0) / tiles.length };
    this.flag = [...tiles];
    clearTimeout(this.flashTimer);
    this.flashTimer = window.setTimeout(() => { this.flag = []; }, 1600);
  }
  private flashTimer = 0;

  // --- pins ---
  /** Drop a note at a position in the grid (tile units); `free` skips attaching it to what is there. */
  addPin(fx: number, fy: number, free: boolean): void {
    const l = this.layout, d = this.design;
    if (!l || !d) return;
    const pin = newPin(this.nextPin++, '', fx, fy, anchorFor(l, d, fx, fy, free), l, d);
    this.pins = [...this.pins, pin];
    this.openPin = pin.id;
  }
  setPinText(id: number, text: string): void {
    this.pins = this.pins.map((p) => (p.id === id ? { ...p, text } : p));
  }
  removePin(id: number): void {
    this.pins = this.pins.filter((p) => p.id !== id);
    if (this.openPin === id) this.openPin = null;
  }
  /** Centre both panes on a pin and open its note on the grid. */
  focusPin(id: number): void {
    const p = this.pins.find((x) => x.id === id);
    if (!p) return;
    this.view = { ...this.view, cx: p.x, cy: p.y };
    this.openPin = id;
  }

  // --- feedback cases ---
  /** The case as it would be saved now. */
  caseFile(name: string): CaseFile | null {
    const { original, layout, provenance } = this;
    if (!original || !layout || !provenance) return null;
    return caseOf(name, provenance, original, layout, this.pins, describeChanges(original, layout));
  }
  /** Where a case with this name would be written (repo-relative). */
  casePath(name: string): string {
    return this.provenance ? `tools/layout/cases/${caseSlug(this.provenance, name)}.json` : '';
  }
  /** Save through the dev server; returns the repo-relative path. */
  async saveCase(name: string): Promise<string> {
    const file = this.caseFile(name);
    if (!file || !this.provenance) throw new Error('nothing to save');
    const res = await fetch(`/__layout/cases/${caseSlug(this.provenance, name)}`, { method: 'POST', body: serializeCase(file) });
    const body = (await res.json()) as { path?: string; error?: string };
    if (!res.ok || !body.path) throw new Error(body.error ?? `save failed (${res.status})`);
    return body.path;
  }
  /**
   * Write the case's images beside its JSON: the original, edited and overlay grids (a fixed modest scale, one frame) and a still of the
   * preview for the original and for the edited design (skipped when the preview is not on screen). Returns the repo-relative paths.
   */
  async exportImages(name: string): Promise<string[]> {
    const { original, layout, provenance, originalDesign, design, diff } = this;
    if (!original || !layout || !provenance || !originalDesign || !design) throw new Error('nothing to export');
    const frame = frameOf(original, layout);
    if (!frame) throw new Error('the design is empty');
    const slug = caseSlug(provenance, name);
    const done: string[] = [];
    const put = async (what: string, url: string | null): Promise<void> => {
      if (!url) return;
      const res = await fetch(`/__layout/cases/${slug}.${what}.png`, { method: 'POST', body: url });
      const body = (await res.json()) as { path?: string; error?: string };
      if (!res.ok || !body.path) throw new Error(body.error ?? `export failed (${res.status})`);
      done.push(body.path);
    };
    const d = diff ?? diffLayouts(original, layout);
    await put('original', gridPng(originalDesign, frame, null));
    await put('edited', gridPng(design, frame, null));
    await put('overlay', gridPng(design, frame, d));
    // preview stills: frame the design, shoot each, then put the preview back as it was
    const view = this.view;
    this.fit();
    for (const [what, des] of [['preview-original', originalDesign], ['preview-edited', design]] as const) {
      await preview.setDesign(des);
      preview.setView(previewView(this.view, dpr()));
      await put(what, await preview.still(960));
    }
    await preview.setDesign(this.previewDesign ?? design);
    this.view = view;
    return done;
  }
  async listCases(): Promise<string[]> {
    const res = await fetch('/__layout/cases');
    return res.ok ? ((await res.json()) as string[]) : [];
  }
  async loadCaseNamed(slug: string): Promise<void> {
    const res = await fetch(`/__layout/cases/${slug}`);
    if (!res.ok) throw new Error(`no case ${slug}`);
    this.loadCase(parseCase(await res.text()));
  }
  /** Open a case: its original and its edited design, with the notes. */
  loadCase(c: CaseFile): void {
    const original = decodeLayout(c.original), edited = decodeLayout(c.edited);
    this.source = { ...DEFAULT_SOURCE, ...c.source };
    this.label = `${c.name} (case)`;
    this.original = original;
    this.originalDesign = designFromLayout(original, `${c.name} (original)`);
    this.provenance = c.source;
    this.hist = fresh(edited);
    this.pins = c.notes;
    this.nextPin = Math.max(0, ...c.notes.map((p) => p.id)) + 1;
    this.openPin = null;
    this.hover = this.selected = null;
    this.flag = [];
    this.ghost = this.drag = null;
    this.show(edited);
    this.view = fitted(edited.width, edited.height, dpr(), this.gridBox);
    if (this.sized) this.fit();
  }
}

export const lab = new Lab();
