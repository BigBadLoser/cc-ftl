import { writable } from 'svelte/store';
import type { Snippet } from 'svelte';
import { ACTION_BY_ID, keyLabel, keymap, type ActionId } from '../keymap';
import { settings } from '../settings/settings';

/** What a game tooltip shows: the hint, and the hotkey as a badge. `key` is an action id (resolved against the player's bindings) or literal key text. */
export interface TipSpec { text?: string | null; key?: ActionId | string; side?: 'top' | 'bottom' | 'left' | 'right';
  /** Rich content (an item's stats card) in place of the text; it brings its own frame. */
  rich?: Snippet;
  /** Make a non-interactive element (a span or chip) a tab stop, so a tip that holds information found nowhere else is reachable from the keyboard. */
  focus?: boolean;
}
export interface TipState { spec: TipSpec; rect: DOMRect }

/** The one tooltip on screen (drawn by `TipHost`, mounted once in the app). */
export const tipState = writable<TipState | null>(null);

const DELAY = 250;

/**
 * Svelte action: `use:tip={{ text: 'Starmap', key: 'view.starmap' }}` gives any element the game tooltip on hover and keyboard focus.
 * A falsy `text` shows nothing. Use a native `title` only where a tooltip is wrong (text inputs, truncated text that must be selectable).
 */
/** The spec with a trailing "(<key>)" removed from the text when the key is shown as a badge, so the hotkey never appears twice. */
export function cleanTip(spec: TipSpec): TipSpec {
  if (!spec.key || !spec.text) return spec;
  const label = ACTION_BY_ID.has(spec.key) ? keyLabel(keymap.get(), spec.key as ActionId) : spec.key;
  const text = spec.text.replace(/\s*\(([^()]*)\)\s*$/, (m, inner: string) => (inner === label || inner === spec.key ? '' : m));
  return text === spec.text ? spec : { ...spec, text };
}

export function tip(node: Element, spec: TipSpec | null | undefined) {
  let cur = spec;
  const tabStop = () => { if (cur?.focus && !node.hasAttribute('tabindex')) node.setAttribute('tabindex', '0'); };
  tabStop();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let mine: TipState | null = null;
  /** The pointer is over the element, or it has keyboard focus: a changed spec then updates in place instead of hiding. */
  let over = false, focused = false, pending = false;
  const wanted = () => !!cur && !!(cur.text || cur.rich) && settings.get().tooltips;
  const show = () => {
    pending = false;
    if (!cur || !wanted()) { unshow(); return; }
    mine = { spec: cleanTip(cur), rect: node.getBoundingClientRect() };
    tipState.set(mine);
  };
  const unshow = () => { tipState.update((s) => (s === mine ? null : s)); mine = null; };
  const hide = () => { clearTimeout(timer); pending = false; unshow(); };
  const enter = () => { over = true; clearTimeout(timer); pending = true; timer = setTimeout(show, DELAY); };
  const leave = () => { over = false; if (!focused) hide(); };
  const down = () => { over = false; hide(); };
  const focus = () => { if (node.matches(':focus-visible')) { focused = true; show(); } };
  const blur = () => { focused = false; if (!over) hide(); };
  node.addEventListener('pointerenter', enter);
  node.addEventListener('pointerleave', leave);
  node.addEventListener('pointerdown', down);
  node.addEventListener('focus', focus);
  node.addEventListener('blur', blur);
  return {
    update(next: TipSpec | null | undefined) {
      cur = next;
      tabStop();
      // Hovered or focused and past the delay: swap the content in place (or drop it if the new spec has nothing to say). A pending show reads `cur` when it fires.
      if (mine || ((over || focused) && !pending)) show();
    },
    destroy() {
      hide();
      node.removeEventListener('pointerenter', enter); node.removeEventListener('pointerleave', leave); node.removeEventListener('pointerdown', down);
      node.removeEventListener('focus', focus); node.removeEventListener('blur', blur);
    },
  };
}
