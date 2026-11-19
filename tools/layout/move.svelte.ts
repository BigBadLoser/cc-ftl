/**
 * The Move tool and the clipboard: a box selected on the grid, its contents dragged (or nudged) somewhere else, copied, cut and pasted.
 * A piece in flight (a drag or a paste following the pointer) is shown by editing the design live as one gesture, so the grid and the
 * preview show it for real; letting go is one undo step, Esc puts the design back as it was.
 */
import { lab } from './lab.svelte';
import type { Layout, Rect, Tile } from './layout';
import { clipRect, extract, fitPiece, isEmpty, lift, rectOf, stamp, wholeRect, type Piece } from './region';

/** A piece following the pointer: lifted out of `base` (a move keeps its ids) or a paste over it (new ids), grabbed at `grab` within it. */
interface Float { piece: Piece; base: Layout; start: Layout; keep: boolean; grab: Tile; at: Tile; from: Tile | null }

class Move {
  /** The selected box (design tiles). */
  box = $state.raw<Rect | null>(null);
  /** A box being dragged out. */
  marquee = $state.raw<Rect | null>(null);
  /** What Ctrl+C or Ctrl+X took. */
  clip = $state.raw<Piece | null>(null);
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
  /** Press inside the box: lift its contents to drag. */
  grab(t: Tile): void {
    const l = lab.layout, b = this.box;
    if (!l || !b || lab.compare) return;
    lab.begin();
    this.float = { piece: extract(l, b), base: lift(l, b), start: l, keep: true, grab: [t[0] - b.x, t[1] - b.y], at: [b.x, b.y], from: [b.x, b.y] };
  }
  /** The pointer moved with a piece in flight: show it at the pointer (kept on the grid). */
  drag(t: Tile): void {
    const f = this.float;
    if (!f) return;
    const at = fitPiece(f.base, f.piece, t[0] - f.grab[0], t[1] - f.grab[1]);
    if (at[0] === f.at[0] && at[1] === f.at[1]) return;
    this.float = { ...f, at };
    this.box = { x: at[0], y: at[1], w: f.piece.w, h: f.piece.h };
    lab.step(() => (this.home(f, at) ? f.start : this.stamped(f, at).layout));
  }
  /** Let go of a dragged piece, or place a pasted one: one undo step. */
  drop(): void {
    const f = this.float;
    if (!f) return;
    this.float = null;
    if (this.home(f, f.at)) { lab.step(() => f.start); lab.end(); return; }
    const s = this.stamped(f, f.at);
    lab.step(() => s.layout);
    lab.marks = s.marks;
    lab.end();
  }
  /** Esc: put the design back as it was before the piece was picked up. */
  cancelFloat(): void {
    const f = this.float;
    if (!f) return;
    this.float = null;
    this.box = f.from ? { x: f.from[0], y: f.from[1], w: f.piece.w, h: f.piece.h } : null;
    lab.step(() => f.start);
    lab.end();
  }
  /** A dragged piece back where it was picked up: the design as it was, not an edit. */
  private home(f: Float, at: Tile): boolean { return !!f.from && at[0] === f.from[0] && at[1] === f.from[1]; }
  private stamped(f: Float, at: Tile) { return stamp(f.base, f.piece, at[0], at[1], f.keep, lab.marks); }

  // --- edits on the box ---
  /** Arrow keys: move the box's contents a tile. */
  nudge(dx: number, dy: number): void {
    const l = lab.layout, b = this.box;
    if (!l || !b || this.float || lab.compare) return;
    const piece = extract(l, b), base = lift(l, b);
    const at = fitPiece(base, piece, b.x + dx, b.y + dy);
    if (at[0] === b.x && at[1] === b.y) return;
    lab.edit(() => stamp(base, piece, at[0], at[1], true, lab.marks).layout);
    this.box = { ...b, x: at[0], y: at[1] };
  }
  /** Delete: clear the box to open space. */
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
    return true;
  }
  cut(): void { if (this.copy()) this.clear(); }
  /** Ctrl+V: the clipboard follows the pointer (centred on it) until a click places it. */
  paste(): void {
    const l = lab.layout, p = this.clip;
    if (!l || !p || lab.compare) return;
    this.cancelFloat();
    lab.setTool('move');
    const t = this.pointer ?? [Math.round(lab.view.cx), Math.round(lab.view.cy)];
    lab.begin();
    this.float = { piece: p, base: l, start: l, keep: false, grab: [p.w >> 1, p.h >> 1], at: [-1, -1], from: null };
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
