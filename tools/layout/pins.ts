/**
 * Spatial pins: a note at a position in the design, shown in both panes. A pin can attach to a feature (a tile, a wall, a door, a
 * room or a module); an attached pin follows the feature when it moves, and when the feature is deleted the note stays where it
 * last was, marked orphaned (and comes back to life if an undo brings the feature back). Plain data, so a case file carries it.
 */
import type { Design } from './design';
import type { Layout } from './layout';

export type Anchor =
  | { kind: 'free' }
  | { kind: 'tile' | 'wall' | 'door'; x: number; y: number }
  | { kind: 'room'; id: number }
  | { kind: 'module'; id: number };
export interface Pin {
  id: number;
  text: string;
  /** Where it sits (tile coordinates; integers are tile centres). Kept up to date while the anchor lives. */
  x: number;
  y: number;
  anchor: Anchor;
  /** From the feature's reference point (a module's top-left, a room's middle) to the pin, so it follows at the same spot on it. */
  dx: number;
  dy: number;
  orphan: boolean;
}

/** What a pin dropped at (fx, fy) attaches to: the module there, else the door, wall, room or bare floor tile; `free` ignores all that. */
export function anchorFor(l: Layout, d: Design, fx: number, fy: number, free: boolean): Anchor {
  if (free) return { kind: 'free' };
  const x = Math.round(fx), y = Math.round(fy);
  const m = d.modules.find((dm) => !dm.lamp && dm.tiles.some((t) => t[0] === x && t[1] === y));
  if (m) return { kind: 'module', id: m.id };
  const c = l.cells[y]?.[x];
  if (c === 'D') return { kind: 'door', x, y };
  if (c === '#') return { kind: 'wall', x, y };
  if (c === '_') {
    const r = d.roomOf[y * d.width + x] ?? -1;
    return r >= 0 && d.rooms[r]?.role !== 'hall' ? { kind: 'room', id: r } : { kind: 'tile', x, y };
  }
  return { kind: 'free' };
}

/** The reference point an anchor offsets from, or null when its feature is gone. */
function reference(a: Anchor, l: Layout, d: Design): { x: number; y: number } | null {
  if (a.kind === 'free') return { x: 0, y: 0 };
  if (a.kind === 'module') {
    const i = l.moduleIds.indexOf(a.id);
    const m = l.modules[i];
    return m ? { x: m.x, y: m.y } : null;
  }
  if (a.kind === 'room') {
    const r = d.rooms[a.id];
    return r && r.tiles > 0 ? { x: r.cx, y: r.cy } : null;
  }
  const c = l.cells[a.y]?.[a.x];
  const ok = a.kind === 'door' ? c === 'D' : a.kind === 'wall' ? c === '#' : c !== undefined && c !== '.';
  return ok ? { x: 0, y: 0 } : null;
}

export function newPin(id: number, text: string, fx: number, fy: number, anchor: Anchor, l: Layout, d: Design): Pin {
  const ref = reference(anchor, l, d) ?? { x: 0, y: 0 };
  const rel = anchor.kind === 'module' || anchor.kind === 'room';
  return { id, text, x: fx, y: fy, anchor, dx: rel ? fx - ref.x : 0, dy: rel ? fy - ref.y : 0, orphan: false };
}

/** The pins after the layout changed: followers move with their feature, those whose feature is gone are orphaned (the same array if nothing changed). */
export function rebase(pins: readonly Pin[], l: Layout, d: Design): readonly Pin[] {
  let changed = false;
  const out = pins.map((p) => {
    const ref = reference(p.anchor, l, d);
    if (!ref) {
      if (p.orphan) return p;
      changed = true;
      return { ...p, orphan: true };
    }
    const rel = p.anchor.kind === 'module' || p.anchor.kind === 'room';
    const x = rel ? ref.x + p.dx : p.x, y = rel ? ref.y + p.dy : p.y;
    if (!p.orphan && x === p.x && y === p.y) return p;
    changed = true;
    return { ...p, x, y, orphan: false };
  });
  return changed ? out : pins;
}

/** A short phrase for what a pin is attached to ("module CO", "room 3 cargo"), for the list. */
export function describeAnchor(p: Pin, l: Layout, d: Design): string {
  const a = p.anchor;
  let at: string;
  if (a.kind === 'free') at = 'free';
  else if (a.kind === 'module') { const m = d.modules[l.moduleIds.indexOf(a.id)]; at = m ? `module ${m.code || m.name}` : 'module'; }
  else if (a.kind === 'room') { const r = d.rooms[a.id]; at = r ? `room ${a.id} ${r.name || r.role}` : `room ${a.id}`; }
  else at = `${a.kind} ${a.x},${a.y}`;
  return p.orphan ? `${at} (gone)` : at;
}
