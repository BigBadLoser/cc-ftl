/** Hold one cursor on the whole document while a window is dragged or resized (theme.css applies `--fw-cursor` to every element), so it does not flicker as the pointer outruns the handle. */
export function setDragCursor(cursor: string | null): void {
  const root = document.documentElement;
  if (cursor) {
    root.style.setProperty('--fw-cursor', cursor);
    root.setAttribute('data-fw-cursor', '');
  } else {
    root.removeAttribute('data-fw-cursor');
    root.style.removeProperty('--fw-cursor');
  }
}

/** The resize cursor for each edge or corner handle. */
export const EDGE_CURSOR: Record<string, string> = { n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize', nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize' };
