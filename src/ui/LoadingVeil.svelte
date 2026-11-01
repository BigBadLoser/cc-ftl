<script lang="ts">
  import { onMount } from 'svelte';

  /**
   * Covers the view while a scene's sprites load (#266), then fades out. It stays invisible for `SHOW_DELAY_MS`, so a fast
   * load never flashes it. `until` resolves when the scene is ready; null means nothing to wait for.
   */
  let { until, label = 'Loading' }: { until: Promise<void> | null; label?: string } = $props();

  const SHOW_DELAY_MS = 150;
  const FADE_MS = 200;
  let phase = $state<'wait' | 'show' | 'fade' | 'gone'>(until ? 'wait' : 'gone');

  onMount(() => {
    if (!until) return;
    const timers: number[] = [];
    timers.push(window.setTimeout(() => { if (phase === 'wait') phase = 'show'; }, SHOW_DELAY_MS));
    const done = (): void => {
      if (phase === 'wait') { phase = 'gone'; return; }
      phase = 'fade';
      timers.push(window.setTimeout(() => (phase = 'gone'), FADE_MS));
    };
    until.then(done, done);
    return () => timers.forEach((t) => clearTimeout(t));
  });
</script>

{#if phase !== 'gone'}
  <div class="veil" class:on={phase === 'show'} class:fade={phase === 'fade'} role="status" aria-live="polite" data-testid="loading-veil">
    <div class="box" class:hidden={phase === 'wait'}><span class="spin"></span><span class="txt">{label}</span></div>
  </div>
{/if}

<style>
  .veil { position: fixed; inset: 0; z-index: 900; background: var(--bg, #05070d); display: grid; place-items: center; opacity: 0; pointer-events: all; }
  .veil.on { opacity: 1; transition: opacity 120ms ease-out; }
  .veil.fade { opacity: 0; transition: opacity 200ms ease-in; pointer-events: none; }
  .box { display: flex; align-items: center; gap: 10px; color: var(--dim, #8a97a8); font: 600 12px var(--head-font, sans-serif); letter-spacing: 0.14em; text-transform: uppercase; }
  .hidden { visibility: hidden; }
  .spin { width: 14px; height: 14px; border: 2px solid currentColor; border-right-color: transparent; border-radius: 50%; animation: spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .spin { animation-duration: 2.4s; } }
</style>
