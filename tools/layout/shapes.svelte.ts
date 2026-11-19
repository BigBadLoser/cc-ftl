/** The saved shapes, kept in localStorage (per viewer, across reloads and designs). */
import type { Piece } from './region';
import { parseShapes, shapeName, type Shape } from './shapes';

const KEY = 'cc-ftl.layout.shapes';
function load(): Shape[] {
  try { return parseShapes(globalThis.localStorage?.getItem(KEY) ?? null); } catch { return []; }
}

class Shapes {
  list = $state.raw<Shape[]>(load());
  /** The shape whose name is being edited (a new one starts so). */
  editing = $state<number | null>(null);
  private save(): void {
    try { globalThis.localStorage?.setItem(KEY, JSON.stringify(this.list)); } catch { /* storage blocked or full: kept this session */ }
  }
  add(piece: Piece): Shape {
    const s = { id: Math.max(0, ...this.list.map((x) => x.id)) + 1, name: shapeName(piece), piece };
    this.list = [s, ...this.list];
    this.editing = s.id;
    this.save();
    return s;
  }
  rename(id: number, name: string): void {
    const n = name.trim();
    if (n) this.list = this.list.map((s) => (s.id === id ? { ...s, name: n } : s));
    this.editing = null;
    this.save();
  }
  remove(id: number): void {
    this.list = this.list.filter((s) => s.id !== id);
    this.save();
  }
}
export const shapes = new Shapes();
