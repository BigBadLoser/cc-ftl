import type { Container } from 'pixi.js';

/**
 * Render groups of the world layers (#389). A render group has its own instruction list and transform: moving the camera
 * changes one group transform instead of every sprite's, and a structure change (a sprite added, a zIndex or visibility
 * change) rebuilds only the group it happens in. Groups do not batch with each other, so each one costs a draw call or so.
 * A group root does not pass its blend mode down, so a container with a blend mode of its own must not be one.
 */
const roots = new Set<Container>();
let on = true;

/** Make `c` a render group (and remember it for the debug switch). */
export function renderGroup(c: Container): void {
  roots.add(c);
  c.once('destroyed', () => roots.delete(c));
  if (on) c.enableRenderGroup();
}

/** Debug (same-frame render diffs): render every registered container as a render group (true, the default) or not. */
export function setRenderGroups(enabled: boolean): void {
  on = enabled;
  for (const c of roots) {
    if (enabled) c.enableRenderGroup();
    else c.disableRenderGroup();
  }
}
