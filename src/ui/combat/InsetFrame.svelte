<script lang="ts">
  import type { UiApi } from '../api';
  import { KeyBadge } from '../kit';

  /**
   * The combat inset: a docked window showing the other ship (yours by default, the enemy's once swapped). The renderer draws a second
   * camera pass into the world canvas behind this window every frame. The inset is never interactive except as the swap click. The
   * frame pulses red while enemy shots are committed to your ship.
   */
  let { api, ship, title, threatened, onSwap }: {
    api: UiApi;
    ship: number;
    title: string;
    threatened: boolean;
    onSwap: () => void;
  } = $props();

  let win: HTMLElement | undefined = $state();

  // The renderer sizes the window to the ship at a pixel-perfect zoom (the zoom never changes smoothly, only the frame does). Read
  // the target every frame and ease the frame toward it (exponential, time constant TAU), in whole CSS px. The render pass
  // re-centres the ship in whatever size the window has.
  const TAU = 0.07;
  let size = $state({ w: 360, h: 200 });
  $effect(() => {
    const id = ship;
    let raf = 0;
    let last = performance.now();
    let cur: { w: number; h: number } | null = null;
    const step = (c: number, to: number, k: number) => (Math.abs(to - c) < 0.5 ? to : c + (to - c) * k);
    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const target = api.insetSize(id);
      if (target) {
        const k = 1 - Math.exp(-dt / TAU);
        cur = cur ? { w: step(cur.w, target.w, k), h: step(cur.h, target.h, k) } : target;
        const w = Math.round(cur.w);
        const h = Math.round(cur.h);
        if (w !== size.w || h !== size.h) size = { w, h };
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  });

  $effect(() => {
    const el = win;
    const id = ship;
    api.setInset(el && id ? { ship: id, view: el } : null);
    return () => api.setInset(null);
  });
</script>

<button
  class="inset"
  class:hot={threatened}
  style:width="{size.w + 2}px"
  title="Swap the main view and the inset (Tab)"
  aria-label="Swap views"
  data-testid="combat-inset"
  onclick={onSwap}
>
  <span class="head">
    <b>{title}</b>
    <span class="sp"></span>
    <KeyBadge tone="light" size="sm">Tab</KeyBadge>
    <span class="hint">swap</span>
  </span>
  <span class="win" bind:this={win} style:height="{size.h}px"></span>
</button>

<style>
  .inset {
    display: grid;
    grid-template-rows: auto 1fr;
    min-height: 0;
    min-width: 0;
    padding: 0;
    text-align: left;
    background: transparent;
    border: 1px solid var(--line-hi);
    color: var(--text);
    cursor: pointer;
    pointer-events: auto;
  }
  .inset.hot {
    border-color: var(--red);
    animation: pulse 0.9s ease-in-out infinite alternate;
  }
  .head {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    padding: 3px var(--sp-2);
    background: var(--band);
    font: 600 13px/1 var(--head-font);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    height: 20px;
  }
  .hot .head {
    background: var(--band-hot);
  }
  .sp {
    flex: 1;
  }
  .hint {
    font-size: 11px;
    color: var(--light);
    letter-spacing: 0.05em;
  }
  /* A transparent window: the renderer draws the ship into the world canvas behind it. */
  .win {
    display: block;
    width: 100%;
  }
  @keyframes pulse {
    to { box-shadow: 0 0 14px rgba(255, 90, 90, 0.7), inset 0 0 0 1px var(--red); }
    from { box-shadow: 0 0 0 rgba(255, 90, 90, 0); }
  }
</style>
