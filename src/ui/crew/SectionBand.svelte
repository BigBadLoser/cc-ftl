<script lang="ts">
  import { tip } from '../kit';
  /** A full-width section header that folds on click. `cap` shows pips (filled for the slots used); without it, `count` is shown. */
  let { title, open, onToggle, used = 0, cap = 0, count = 0, tone = 'friend', testId }: {
    title: string; open: boolean; onToggle: () => void; used?: number; cap?: number; count?: number; tone?: 'friend' | 'rival' | 'plain'; testId: string;
  } = $props();
</script>

<button class="band" aria-expanded={open} data-testid={testId} onclick={onToggle}>
  <span class="car">{open ? '▾' : '▸'}</span><span class="t">{title}</span>
  {#if cap > 0}
    <span class="pips" use:tip={{ text: `${used} of ${cap}` }}>{#each Array.from({ length: cap }, (_, i) => i) as i (i)}<i class="{tone}" class:on={i < used}></i>{/each}</span>
  {:else}<span class="n">{count}</span>{/if}
</button>

<style>
  .band { display: flex; align-items: center; gap: 8px; width: 100%; margin: 4px 0 2px; padding: 0 2px; height: 28px; min-height: 0; background: none; border: 0; color: var(--dim); font: 600 12px var(--head-font); letter-spacing: 0.08em; text-transform: uppercase; text-align: left; }
  .band:hover { color: var(--text); border: 0; }
  .car { width: 10px; font-size: 11px; }
  .t { flex: 1; }
  .n { color: var(--text); }
  .pips { display: flex; gap: 4px; }
  .pips i { width: 10px; height: 10px; box-sizing: border-box; border: 1px solid var(--green); }
  .pips i.rival { border-color: var(--red); }
  .pips i.on { background: var(--green); }
  .pips i.rival.on { background: var(--red); }
</style>
