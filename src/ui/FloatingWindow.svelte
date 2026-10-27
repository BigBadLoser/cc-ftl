<script lang="ts">
  import type { Snippet } from 'svelte';
  import { combatRight } from './combatDock';
  import { EDGE_CURSOR, setDragCursor } from './dragCursor';
  import Icon, { type IconName } from './Icon.svelte';
  import { clampRect, EDGES, moveRect, readWindow, resizeRect, writeWindow, type Bounds, type DefaultRect, type Edge, type Rect, type Size } from './floatingWindow';

  /**
   * A floating panel shell: drag by the header, resize from the edges and corners (down to `min`), pin (a pinned window ignores the
   * outside click and Esc, see outsideClick.ts), remembered per `id` for the browser session, and kept on screen.
   * On a phone (600px and narrower) none of that applies: the window is a plain element and the consumer's class lays it out.
   */
  let { id, title, icon, min, defaultRect, onClose, onLayout, closeLabel = 'Close', testId, closeTestId, titleTestId, bg = true, padded = false, bare = false, pinRight = 0, avoidCombat = true, z = 6, pinned = $bindable(false), class: cls = '', titleExtra, actions, children }: {
    id: string; title: string; icon?: IconName;
    /** The smallest size this panel can be dragged to. */
    min: Size;
    /** Where the window sits until the player moves it: given the bounds it may use, returns the rect (re-run when the screen resizes). */
    defaultRect: (b: Bounds) => DefaultRect;
    onClose: () => void;
    /** The window's current rect, and whether the player moved it off the default spot (so layouts that dodge it can follow). */
    onLayout?: (rect: Rect, moved: boolean) => void;
    closeLabel?: string; testId?: string; closeTestId?: string; titleTestId?: string;
    /** False for a window whose content paints its own background (combat lets the world canvas show through its ship view). */
    bg?: boolean;
    /** Wrap the content in a scrolling body with the usual 10px panel padding. */
    padded?: boolean;
    /** No header of its own: the content brings its own `.ph` heading, which drags the window; only the pin tile is added (`pinRight` px in from the right edge). */
    bare?: boolean; pinRight?: number;
    /** Default spot keeps right of the combat panel while it is docked on the left. */
    avoidCombat?: boolean;
    z?: number; pinned?: boolean; class?: string;
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
  /** Bounds for the default spot only: right of the combat panel while it is docked. */
  const defBounds = $derived<Bounds>(avoidCombat && $combatRight > 0 && $combatRight < bounds.right - min.w ? { ...bounds, left: Math.max(bounds.left, $combatRight) } : bounds);

  // A window's id never changes.
  // svelte-ignore state_referenced_locally
  const saved = readWindow(id);
  let stored = $state<Rect | null>(saved.rect);
  pinned = saved.pinned;
  let live = $state<Rect | null>(null);
  let elH = $state(0);
  const base = $derived<DefaultRect>(stored ?? defaultRect(defBounds));
  const auto = $derived(stored === null && base.h === 0);
  const bottomAnchored = $derived(auto && base.anchor === 'bottom');
  const rect = $derived.by((): Rect => {
    if (live) return live;
    if (!auto) return clampRect(base, stored ? bounds : defBounds, min);
    const h = Math.max(elH, 1);
    const y = bottomAnchored ? defBounds.bottom - h : base.y;
    const r = clampRect({ ...base, y, h }, defBounds, { w: min.w, h: 1 });
    return { ...r, h };
  });
  const style = $derived(!floating ? undefined
    : auto ? `left:${rect.x}px;width:${rect.w}px;${bottomAnchored ? `bottom:${vh - defBounds.bottom}px;` : `top:${rect.y}px;`}max-height:${bottomAnchored ? defBounds.bottom - defBounds.top : defBounds.bottom - rect.y}px`
    : `left:${rect.x}px;top:${rect.y}px;width:${rect.w}px;height:${rect.h}px`);

  $effect(() => onLayout?.(rect, stored !== null || live !== null));
  const save = () => writeWindow(id, { rect: stored, pinned });

  let gesture: { kind: 'move' | Edge; x: number; y: number; start: Rect } | null = null;
  function begin(e: PointerEvent, kind: 'move' | Edge) {
    if (e.button !== 0) return;
    if (kind === 'move' && (e.target as HTMLElement).closest('button, input, select, a')) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    gesture = { kind, x: e.clientX, y: e.clientY, start: rect };
    setDragCursor(kind === 'move' ? 'move' : EDGE_CURSOR[kind] ?? null);
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
    setDragCursor(null);
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
  /** Bare windows drag by whichever `.ph` heading their content draws. */
  function bareDown(e: PointerEvent) {
    if (bare && floating && (e.target as HTMLElement).closest('.ph')) begin(e, 'move');
  }
  const pinTitle = $derived(pinned ? 'Unpin: closes on outside click and Esc again' : 'Pin: stay open on outside click and Esc');
</script>

<svelte:window bind:innerWidth={vw} bind:innerHeight={vh} />

<section class="fw {cls}" class:floating class:bg class:pinned class:bare data-testid={testId} data-pinned={pinned} aria-label={title}
  style="{style ? style + ';' : ''}--fw-z:{z};--fw-pin:{pinRight + 38}px" bind:clientHeight={elH}
  onpointerdown={bare ? bareDown : undefined} onpointermove={drag} onpointerup={end} onpointercancel={end} ondblclick={bare && floating ? (e) => { if ((e.target as HTMLElement).closest('.ph') && !(e.target as HTMLElement).closest('button')) reset(); } : undefined}>
  {#if !bare}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <header class="ph" class:drag={floating} onpointerdown={floating ? (e) => begin(e, 'move') : undefined} ondblclick={floating ? reset : undefined} data-testid={testId ? `${testId}-head` : undefined}>
      {#if icon}<span class="ico"><Icon name={icon} size={18} /></span>{/if}
      <span class="t" data-testid={titleTestId}>{title}</span>
      {@render titleExtra?.()}
      {@render actions?.()}
      {#if floating}
        <button class="tile pin" class:on={pinned} title={pinTitle} aria-label={pinned ? 'Unpin' : 'Pin'} aria-pressed={pinned} data-testid={testId ? `${testId}-pin` : undefined} onclick={togglePin}>
          <Icon name={pinned ? 'unpin' : 'pin'} size={16} />
        </button>
      {/if}
      <button class="tile x" title={closeLabel} aria-label={closeLabel} data-testid={closeTestId} onclick={onClose}><Icon name="close" size={16} /></button>
    </header>
  {:else if floating}
    <button class="tile pin barepin" class:on={pinned} style="right:{pinRight}px" title={pinTitle} aria-label={pinned ? 'Unpin' : 'Pin'} aria-pressed={pinned} data-testid={testId ? `${testId}-pin` : undefined} onclick={togglePin}>
      <Icon name={pinned ? 'unpin' : 'pin'} size={16} />
    </button>
  {/if}
  {#if padded}<div class="fwbody">{@render children()}</div>{:else}{@render children()}{/if}
  {#if floating}
    {#each EDGES as edge (edge)}
      <div class="grip {edge}" data-edge={edge} onpointerdown={(e) => begin(e, edge)} role="presentation"></div>
    {/each}
  {/if}
</section>

<style>
  .fw { z-index: var(--fw-z); display: flex; flex-direction: column; overflow: hidden; border: 1px solid var(--line-hi); box-sizing: border-box; }
  .fw.floating { position: fixed; }
  .fw.bg { background: var(--panel); }
  .fw.pinned { border-color: var(--cyan); }
  .fwbody { flex: 1 1 auto; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; padding: 10px; box-sizing: border-box; }
  header.ph { margin: 0; padding: 0 0 0 10px; display: flex; align-items: center; gap: 8px; min-height: 32px; flex: none; }
  header.drag, .fw.bare.floating :global(.ph) { cursor: move; touch-action: none; }
  header .ico { display: inline-flex; color: var(--cyan); }
  header .t { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  header :global(button.tile), .barepin { width: 32px; height: 32px; border-width: 0 0 0 1px; background: #0a3a52; color: #fff; cursor: pointer; }
  header :global(button.tile:hover), .barepin:hover { background: var(--panel-3); }
  header :global(button.tile.pin), .barepin { color: #8fc4da; }
  header :global(button.tile.pin.on), .barepin.on { background: var(--cyan); color: #04202c; }
  .barepin { position: absolute; top: 0; z-index: 3; }
  .fw.bare.floating :global(.ph button) { cursor: pointer; }
  /* Keep the heading's text clear of the pin tile. */
  .fw.bare.floating :global(.ph) { padding-right: var(--fw-pin); }
  /* Resize grips: 6px strips on the edges, 14px corners, above the content (and its scrollbar). */
  .grip { position: absolute; z-index: 5; touch-action: none; }
  .grip.n, .grip.s { left: 14px; right: 14px; height: 6px; cursor: ns-resize; }
  .grip.e, .grip.w { top: 14px; bottom: 14px; width: 6px; cursor: ew-resize; }
  .grip.n { top: 0; } .grip.s { bottom: 0; } .grip.e { right: 0; } .grip.w { left: 0; }
  .grip.ne, .grip.nw, .grip.se, .grip.sw { width: 14px; height: 14px; }
  .grip.ne { top: 0; right: 0; cursor: nesw-resize; } .grip.sw { bottom: 0; left: 0; cursor: nesw-resize; }
  .grip.nw { top: 0; left: 0; cursor: nwse-resize; } .grip.se { bottom: 0; right: 0; cursor: nwse-resize; }
</style>
