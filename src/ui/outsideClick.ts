/** A panel the outside-click handler knows about. `sticky` panels stay open (combat, the build catalog in build mode, goals, alerts). */
export interface ClosablePanel {
  id: string;
  sticky: boolean;
  /** A pinned floating window stays open: neither the outside click nor Esc closes it. */
  pinned?(): boolean;
  isOpen(): boolean;
  close(): void;
}

/** The slice of an element the outside test reads (so it runs without a DOM). */
export interface TargetLike {
  tagName?: string;
  closest?(selector: string): unknown;
  hasAttribute?(name: string): boolean;
}

/**
 * Whether a pointer landing on `el` is outside every UI panel: the world canvas (marked `data-world`), the bare page, or a modal's backdrop
 * (`data-backdrop`). Anything else is UI chrome (panels, the top bars, the toolbar, the goals card, alerts) and never counts.
 */
export function isOutsideTarget(target: TargetLike | EventTarget | null): boolean {
  if (!target) return true;
  const el = target as TargetLike;
  if (el.hasAttribute?.('data-backdrop')) return true;
  // Only the world canvas (`data-world`) is the world: other canvases, like the combat ship view, are panel content.
  return !!el.hasAttribute?.('data-world') || el.tagName === 'BODY' || el.tagName === 'HTML';
}

/** Close every open panel that is neither sticky nor pinned; returns the ids closed. */
export function closeOutside(panels: readonly ClosablePanel[]): string[] {
  const closed: string[] = [];
  for (const p of panels) {
    if (p.sticky || p.pinned?.() || !p.isOpen()) continue;
    p.close();
    closed.push(p.id);
  }
  return closed;
}

const TAP_SLOP = 6;

/**
 * Pointer tracking for the outside click: a press that starts outside and is released nearly where it began (not a camera drag)
 * calls `onOutside`. The press still reaches the world, so one click closes the panels and selects what is under it.
 * Like the canvas input, a second pointer joining (a pinch or two-finger pan) makes the whole gesture not a tap, until every pointer is up.
 * Returns the handlers to attach to the window.
 */
export function outsideTap(onOutside: () => void) {
  const active = new Set<number>();
  let down: { id: number; x: number; y: number; outside: boolean } | null = null;
  let multi = false;
  const release = (id: number) => {
    active.delete(id);
    if (active.size === 0) multi = false;
  };
  return {
    onDown(e: { pointerId: number; clientX: number; clientY: number; button?: number; target: TargetLike | EventTarget | null }) {
      active.add(e.pointerId);
      if (active.size > 1) {
        multi = true;
        down = null;
        return;
      }
      down = e.button && e.button !== 0 ? null : { id: e.pointerId, x: e.clientX, y: e.clientY, outside: isOutsideTarget(e.target) };
    },
    onUp(e: { pointerId: number; clientX: number; clientY: number }) {
      const d = down;
      const tap = !multi && !!d && d.id === e.pointerId;
      release(e.pointerId);
      if (!tap || !d) return;
      down = null;
      if (d.outside && Math.hypot(e.clientX - d.x, e.clientY - d.y) <= TAP_SLOP) onOutside();
    },
    onCancel(e: { pointerId: number }) {
      release(e.pointerId);
      if (down?.id === e.pointerId) down = null;
    },
  };
}
