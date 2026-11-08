import { writable } from 'svelte/store';
import type { ActionId } from '../keymap';

/** What a game tooltip shows: the hint, and the hotkey as a badge. `key` is an action id (resolved against the player's bindings) or literal key text. */
export interface TipSpec { text: string; key?: ActionId | string; side?: 'top' | 'bottom' | 'left' | 'right' }
export interface TipState { spec: TipSpec; rect: DOMRect }

/** The one tooltip on screen (drawn by `TipHost`, mounted once in the app). */
export const tipState = writable<TipState | null>(null);

const DELAY = 250;

/**
 * Svelte action: `use:tip={{ text: 'Starmap', key: 'view.starmap' }}` gives any element the game tooltip on hover and keyboard focus.
 * A falsy `text` shows nothing. Use a native `title` only where a tooltip is wrong (text inputs, truncated text that must be selectable).
 */
export function tip(node: HTMLElement, spec: TipSpec | null | undefined) {
  let cur = spec;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const show = () => { if (cur?.text) tipState.set({ spec: cur, rect: node.getBoundingClientRect() }); };
  const hide = () => { clearTimeout(timer); tipState.update((s) => (s && s.rect && cur && s.spec === cur ? null : s)); };
  const enter = () => { clearTimeout(timer); timer = setTimeout(show, DELAY); };
  const focus = () => { if (node.matches(':focus-visible')) show(); };
  node.addEventListener('pointerenter', enter);
  node.addEventListener('pointerleave', hide);
  node.addEventListener('pointerdown', hide);
  node.addEventListener('focus', focus);
  node.addEventListener('blur', hide);
  return {
    update(next: TipSpec | null | undefined) { hide(); cur = next; },
    destroy() {
      hide();
      node.removeEventListener('pointerenter', enter); node.removeEventListener('pointerleave', hide); node.removeEventListener('pointerdown', hide);
      node.removeEventListener('focus', focus); node.removeEventListener('blur', hide);
    },
  };
}
