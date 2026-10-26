<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon, { type IconName } from './Icon.svelte';
  import { clampRect, EDGES, moveRect, readWindow, resizeRect, writeWindow, type Bounds, type Edge, type Rect, type Size } from './floatingWindow';

  /**
   * A floating panel shell: drag by the header, resize from the edges and corners (down to `min`), pin (a pinned window ignores the
   * outside click and Esc, see outsideClick.ts), remembered per `id` for the browser session, and kept on screen.
   * On a phone (600px and narrower) none of that applies: the window is a plain element and the consumer's class lays it out.
   */
  let { id, title, icon, min, defaultRect, onClose, onLayout, closeLabel = 'Close', testId, closeTestId, bg = true, class: cls = '', titleExtra, actions, children }: {
    id: string; title: string; icon?: IconName;
    /** The smallest size this panel can be dragged to. */
    min: Size;
    /** Where the window sits until the player moves it: given the bounds it may use, returns the rect (re-run when the screen resizes). */
    defaultRect: (b: Bounds) => Rect;
    onClose: () => void;
    /** The window's current rect, and whether the player moved it off the default spot (so layouts that dodge it can follow). */
    onLayout?: (rect: Rect, moved: boolean) => void;
    closeLabel?: string; testId?: string; closeTestId?: string;
    /** False for a window whose content paints its own background (combat lets the world canvas show through its ship view). */
    bg?: boolean; class?: string;
    titleExtra?: Snippet; actions?: Snippet; children: Snippet;
  } = $props();

  const MARGIN = 8;
  let vw = $state(typeof window === 'undefined' ? 1280 : window.innerWidth);
  let vh = $state(typeof window === 'undefined' ? 800 : window.innerHeight);
  const floating = $derived(vw > 600);
  // Below the top bars (--hdr); read at layout time since it changes with the breakpoint.
  function hdr(): number {
    const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hdr'));
    return Number.isFinite(v) ? v : 100;
  }
  const bounds = $derived.by((): Bounds => {
    void vw; void vh;
    return { left: MARGIN, top: hdr() + MARGIN, right: vw - MARGIN, bottom: vh - MARGIN };
  });

  // A window's id never changes.
  // svelte-ignore state_referenced_locally
  const saved = readWindow(id);
  let stored = $state<Rect | null>(saved.rect);
  let pinned = $state(saved.pinned);
  let live = $state<Rect | null>(null);
  const rect = $derived(live ?? clampRect(stored ?? defaultRect(bounds), bounds, min));

  $effect(() => onLayout?.(rect, stored !== null || live !== null));
  const save = () => writeWindow(id, { rect: stored, pinned });

  let gesture: { kind: 'move' | Edge; x: number; y: number; start: Rect } | null = null;
  function begin(e: PointerEvent, kind: 'move' | Edge) {
    if (e.button !== 0) return;
    if (kind === 'move' && (e.target as HTMLElement).closest('button')) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    gesture = { kind, x: e.clientX, y: e.clientY, start: rect };
    e.preventDefault();
  }
  function drag(e: PointerEvent) {
    if (!gesture) return;
    const dx = e.clientX - gesture.x;
    const dy = e.clientY - gesture.y;
    live = gesture.kind === 'move' ? moveRect(gesture.start, dx, dy, bounds, min) : resizeRect(gesture.start, gesture.kind, dx, dy, bounds, min);
  }
  function end() {
    if (!gesture) return;
    gesture = null;
    if (live) stored = live;
    live = null;
    save();
  }
  function reset() {
    stored = null;
    live = null;
    save();
  }
  function togglePin() {
    pinned = !pinned;
    save();
  }
</script>

<svelte:window bind:innerWidth={vw} bind:innerHeight={vh} />

<section class="fw {cls}" class:floating class:bg class:pinned data-testid={testId} data-pinned={pinned} aria-label={title}
  style={floating ? `left:${rect.x}px;top:${rect.y}px;width:${rect.w}px;height:${rect.h}px` : undefined}>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <header class="ph" class:drag={floating} onpointerdown={floating ? (e) => begin(e, 'move') : undefined} onpointermove={drag} onpointerup={end} onpointercancel={end} ondblclick={floating ? reset : undefined} data-testid={testId ? `${testId}-head` : undefined}>
    {#if icon}<span class="ico"><Icon name={icon} size={18} /></span>{/if}
    <span class="t">{title}</span>
    {@render titleExtra?.()}
    {@render actions?.()}
    {#if floating}
      <button class="tile pin" class:on={pinned} title={pinned ? 'Unpin: closes on outside click and Esc again' : 'Pin: stay open on outside click and Esc'} aria-label={pinned ? 'Unpin' : 'Pin'} aria-pressed={pinned} data-testid={testId ? `${testId}-pin` : undefined} onclick={togglePin}>
        <Icon name={pinned ? 'unpin' : 'pin'} size={16} />
      </button>
    {/if}
    <button class="tile x" title={closeLabel} aria-label={closeLabel} data-testid={closeTestId} onclick={onClose}><Icon name="close" size={16} /></button>
  </header>
  {@render children()}
  {#if floating}
    {#each EDGES as edge (edge)}
      <div class="grip {edge}" data-edge={edge} onpointerdown={(e) => begin(e, edge)} onpointermove={drag} onpointerup={end} onpointercancel={end} role="presentation"></div>
    {/each}
  {/if}
</section>

<style>
  .fw { z-index: 7; display: flex; flex-direction: column; overflow: hidden; border: 1px solid var(--line-hi); box-sizing: border-box; }
  .fw.floating { position: fixed; }
  .fw.bg { background: var(--panel); }
  .fw.pinned { border-color: var(--cyan); }
  header.ph { margin: 0; padding: 0 0 0 10px; display: flex; align-items: center; gap: 8px; min-height: 32px; flex: none; }
  header.drag { cursor: move; touch-action: none; }
  header .ico { display: inline-flex; color: var(--cyan); }
  header .t { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  header :global(button.tile) { width: 32px; height: 32px; border-width: 0 0 0 1px; background: #0a3a52; color: #fff; cursor: pointer; }
  header :global(button.tile:hover) { background: var(--panel-3); }
  header :global(button.tile.pin) { color: #8fc4da; }
  header :global(button.tile.pin.on) { background: var(--cyan); color: #04202c; }
  .grip { position: absolute; z-index: 2; touch-action: none; }
  .grip.n, .grip.s { left: 10px; right: 10px; height: 6px; cursor: ns-resize; }
  .grip.e, .grip.w { top: 10px; bottom: 10px; width: 6px; cursor: ew-resize; }
  .grip.n { top: 0; } .grip.s { bottom: 0; } .grip.e { right: 0; } .grip.w { left: 0; }
  .grip.ne, .grip.nw, .grip.se, .grip.sw { width: 12px; height: 12px; }
  .grip.ne { top: 0; right: 0; cursor: nesw-resize; } .grip.sw { bottom: 0; left: 0; cursor: nesw-resize; }
  .grip.nw { top: 0; left: 0; cursor: nwse-resize; } .grip.se { bottom: 0; right: 0; cursor: nwse-resize; }
</style>
