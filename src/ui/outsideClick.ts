/** A panel the outside-click handler knows about. `sticky` panels stay open (combat, the build catalog in build mode, goals, alerts). */
export interface ClosablePanel {
  id: string;
  sticky: boolean;
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
 * Whether a pointer landing on `el` is outside every UI panel: the world canvas, the bare page, or a modal's backdrop
 * (`data-backdrop`). Anything else is UI chrome (panels, the top bars, the toolbar, the goals card, alerts) and never counts.
 */
export function isOutsideTarget(el: TargetLike | null): boolean {
  if (!el) return true;
  if (el.hasAttribute?.('data-backdrop')) return true;
  return el.tagName === 'CANVAS' || el.tagName === 'BODY' || el.tagName === 'HTML';
}

/** Close every open, non-sticky panel; returns the ids closed. */
export function closeOutside(panels: readonly ClosablePanel[]): string[] {
  const closed: string[] = [];
  for (const p of panels) {
    if (p.sticky || !p.isOpen()) continue;
    p.close();
    closed.push(p.id);
  }
  return closed;
}

const TAP_SLOP = 6;

/**
 * Pointer tracking for the outside click: a press that starts outside and is released nearly where it began (not a camera drag)
 * calls `onOutside`. The press still reaches the world, so one click closes the panels and selects what is under it.
 * Returns the two handlers to attach to the window.
 */
export function outsideTap(onOutside: () => void) {
  let down: { id: number; x: number; y: number; outside: boolean } | null = null;
  return {
    onDown(e: { pointerId: number; clientX: number; clientY: number; button?: number; target: TargetLike | null }) {
      down = e.button && e.button !== 0 ? null : { id: e.pointerId, x: e.clientX, y: e.clientY, outside: isOutsideTarget(e.target) };
    },
    onUp(e: { pointerId: number; clientX: number; clientY: number }) {
      const d = down;
      if (!d || d.id !== e.pointerId) return;
      down = null;
      if (d.outside && Math.hypot(e.clientX - d.x, e.clientY - d.y) <= TAP_SLOP) onOutside();
    },
    onCancel() { down = null; },
  };
}
