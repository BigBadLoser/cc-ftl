/**
 * The Move tool and the clipboard: a box selected on the grid, its contents dragged (or nudged, turned, mirrored) somewhere else, copied,
 * cut and pasted. A piece in flight (a drag or a paste following the pointer) is shown by editing the design live as one gesture, so the
 * grid and the preview show it for real; letting go is one undo step, Esc puts the design back as it was.
 */
import { lab } from './lab.svelte';
import type { Layout, Rect, Tile } from './layout';
import { clipRect, extract, fitPiece, isEmpty, lift, rectOf, stamp, wholeRect, type Piece } from './region';
import { turnPiece, type Turn } from './pieceTurn';
import { shapes } from './shapes.svelte';
import { docks } from './dock.svelte';

/**
 * A piece following the pointer, stamped over `base` (a move lifts it out first and keeps its ids; a duplicate or a paste takes new
 * ones), grabbed at `grab` within it. `home` is the box it was picked up from: dropped there unturned, nothing changed.
 */
interface Float { piece: Piece; base: Layout; start: Layout; keep: boolean; grab: Tile; at: Tile; home: Rect | null; turned: boolean; /** The piece as it was picked up (a clipboard or saved shape: the panel marks it). */ source: Piece }

/** The clipboard outlives a reload (a copy from one design pastes into another). */
const CLIP_KEY = 'cc-ftl.layout.clip';
function loadClip(): Piece | null {
  try { const s = globalThis.localStorage?.getItem(CLIP_KEY); return s ? (JSON.parse(s) as Piece) : null; } catch { return null; }
}
function saveClip(p: Piece): void {
  try { globalThis.localStorage?.setItem(CLIP_KEY, JSON.stringify(p)); } catch { /* storage blocked or full: the clipboard lasts the session */ }
}

class Move {
  /** The selected box (design tiles). */
  box = $state.raw<Rect | null>(null);
  /** A box being dragged out. */
  marquee = $state.raw<Rect | null>(null);
  /** What Ctrl+C or Ctrl+X took. */
  clip = $state.raw<Piece | null>(loadClip());
  float = $state.raw<Float | null>(null);
  /** The last tile the pointer was over on the grid (a paste lands there). */
  pointer: Tile | null = null;
  private anchor: Tile | null = null;

  /** Whether a tile lies in the box. */
  inBox([x, y]: Tile): boolean {
    const b = this.box;
    return !!b && x >= b.x && y >= b.y && x < b.x + b.w && y < b.y + b.h;
  }

  // --- the box ---
  startMarquee(t: Tile): void { this.anchor = t; this.box = null; this.marquee = rectOf(t, t); }
  dragMarquee(t: Tile): void { if (this.anchor) this.marquee = rectOf(this.anchor, t); }
  /** Let go of a marquee: the box, grown to hold whole modules and windows (a click without a drag clears it). */
  endMarquee(moved: boolean): void {
    const r = this.marquee, l = lab.layout;
    this.marquee = null;
    this.anchor = null;
    const c = r && l && moved ? clipRect(l, r) : null;
    this.box = c && l ? wholeRect(l, c) : null;
  }

  // --- a piece in flight ---
  /** Press inside the box: lift its contents to drag (`copy`, Alt: leave them and drag a duplicate). */
  grab(t: Tile, copy = false): void {
    const l = lab.layout, b = this.box;
    if (!l || !b || lab.compare) return;
    lab.begin();
    const piece = extract(l, b);
    this.float = { piece, base: copy ? l : lift(l, b), start: l, keep: !copy, grab: [t[0] - b.x, t[1] - b.y], at: [b.x, b.y], home: b, turned: false, source: piece };
  }
  /** The pointer moved with a piece in flight: show it at the pointer (kept on the grid). */
  drag(t: Tile): void {
    const f = this.float;
    if (!f) return;
    const at = fitPiece(f.base, f.piece, t[0] - f.grab[0], t[1] - f.grab[1]);
    if (at[0] === f.at[0] && at[1] === f.at[1]) return;
    this.place({ ...f, at });
  }
  private place(f: Float): void {
    this.float = f;
    this.box = { x: f.at[0], y: f.at[1], w: f.piece.w, h: f.piece.h };
    lab.step(() => (this.atHome(f) ? f.start : this.stamped(f).layout));
  }
  /** Let go of a dragged piece, or place a pasted one: one undo step. */
  drop(): void {
    const f = this.float;
    if (!f) return;
    this.float = null;
    if (this.atHome(f)) { lab.step(() => f.start); lab.end(); return; }
    const s = this.stamped(f);
    lab.step(() => s.layout);
    lab.marks = s.marks;
    lab.end();
  }
  /** Esc: put the design back as it was before the piece was picked up. */
  cancelFloat(): void {
    const f = this.float;
    if (!f) return;
    this.float = null;
    this.box = f.home;
    lab.step(() => f.start);
    lab.end();
  }
  private atHome(f: Float): boolean { return !!f.home && !f.turned && f.at[0] === f.home.x && f.at[1] === f.home.y; }
  private stamped(f: Float) { return stamp(f.base, f.piece, f.at[0], f.at[1], f.keep, lab.marks); }

  // --- edits on the box ---
  /** Move the box's contents (arrows: a tile, with Shift five). */
  nudge(dx: number, dy: number): void {
    const l = lab.layout, b = this.box;
    if (!l || !b || this.float || lab.compare) return;
    const piece = extract(l, b), base = lift(l, b);
    const at = fitPiece(base, piece, b.x + dx, b.y + dy);
    if (at[0] === b.x && at[1] === b.y) return;
    lab.edit(() => stamp(base, piece, at[0], at[1], true, lab.marks).layout);
    this.box = { ...b, x: at[0], y: at[1] };
  }
  /** R / Shift+R turn, H / Shift+H mirror: the piece in flight, else the box's contents in place (about its centre). */
  turn(t: Turn): void {
    const f = this.float, l = lab.layout, b = this.box;
    if (lab.compare) return;
    if (f) {
      const piece = turnPiece(f.piece, t);
      const c: Tile = [f.at[0] + f.grab[0], f.at[1] + f.grab[1]];
      const grab: Tile = [piece.w >> 1, piece.h >> 1];
      this.place({ ...f, piece, grab, turned: true, at: fitPiece(f.base, piece, c[0] - grab[0], c[1] - grab[1]) });
      return;
    }
    if (!l || !b) return;
    const piece = turnPiece(extract(l, b), t), base = lift(l, b);
    const at = fitPiece(base, piece, b.x + ((b.w - piece.w) >> 1), b.y + ((b.h - piece.h) >> 1));
    lab.edit(() => stamp(base, piece, at[0], at[1], true, lab.marks).layout);
    this.box = { x: at[0], y: at[1], w: piece.w, h: piece.h };
  }
  /** Delete: clear the box. */
  clear(): void {
    const b = this.box;
    if (!b || this.float) return;
    lab.edit((l) => lift(l, b));
  }
  copy(): boolean {
    const l = lab.layout, b = this.box;
    if (!l || !b || this.float) return false;
    const p = extract(l, b);
    if (isEmpty(p)) return false;
    this.clip = p;
    saveClip(p);
    return true;
  }
  cut(): void { if (this.copy()) this.clear(); }
  /** Save the box as a named shape (the Shapes panel opens with its name ready to edit). */
  saveShape(): void {
    const l = lab.layout, b = this.box;
    if (!l || !b || this.float) return;
    const p = extract(l, b);
    if (isEmpty(p)) return;
    shapes.add(p);
    if (docks.state.panels.shapes.collapsed) docks.dispatch({ type: 'collapse', id: 'shapes', collapsed: false });
  }
  /** Ctrl+V: the clipboard (or another piece, a saved shape) follows the pointer (centred on it) until a click places it. */
  paste(p: Piece | null = this.clip): void {
    const l = lab.layout;
    if (!l || !p || lab.compare) return;
    this.cancelFloat();
    lab.setTool('move');
    const t = this.pointer ?? [Math.round(lab.view.cx), Math.round(lab.view.cy)];
    lab.begin();
    this.float = { piece: p, base: l, start: l, keep: false, grab: [p.w >> 1, p.h >> 1], at: [-1, -1], home: null, turned: false, source: p };
    this.drag(t);
  }
  /** Drop the box and anything in flight. */
  reset(): void {
    this.cancelFloat();
    this.box = this.marquee = null;
    this.anchor = null;
  }
}

export const move = new Move();
lab.leave = () => move.reset();
