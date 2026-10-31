<script lang="ts">
  import Icon, { type IconName } from '../Icon.svelte';

  /**
   * A labelled stat bar: a fill of `value` out of `max` (or stacked `segments`, each with its own colour), an optional
   * baseline tick (the role's level, a target), optional cell dividers for small whole-number stats, and a readout.
   */
  let { label, icon, value = 0, max = 100, segments, baseline, cells = false, text, color = 'var(--cyan)', low = false, size = 'md', testId, title }: {
    label?: string; icon?: IconName; value?: number; max?: number;
    segments?: { value: number; color: string; hatch?: boolean }[];
    baseline?: number; cells?: boolean; text?: string; color?: string; low?: boolean;
    size?: 'sm' | 'md' | 'lg'; testId?: string; title?: string;
  } = $props();
  const pct = (v: number) => `${Math.max(0, Math.min(100, (v / Math.max(1e-6, max)) * 100))}%`;
  const parts = $derived(segments ?? [{ value, color: low ? '#ff5a2d' : color }]);
</script>

<div class="sb {size}" class:low class:labelled={!!(label || icon)} class:texted={text !== undefined} data-testid={testId} {title}>
  {#if label || icon}<span class="l">{#if icon}<Icon name={icon} size={16} />{/if}{#if label}<span>{label}</span>{/if}</span>{/if}
  <span class="track">
    {#each parts as s, i (i)}<i class:hatch={s.hatch} style:width={pct(s.value)} style:--c={s.color}></i>{/each}
    {#if cells}{#each Array.from({ length: Math.max(0, Math.round(max) - 1) }, (_v, i) => i) as i (i)}<s style:left={pct(i + 1)}></s>{/each}{/if}
    {#if baseline !== undefined && baseline > 0}<b class="base" style:left={pct(baseline)}></b>{/if}
  </span>
  {#if text !== undefined}<span class="v">{text}</span>{/if}
</div>

<style>
  .sb { display: grid; grid-template-columns: 1fr; align-items: center; gap: 8px; color: var(--dim); }
  .sb.texted { grid-template-columns: 1fr auto; }
  .sb.labelled { grid-template-columns: auto 1fr; }
  .sb.labelled.texted { grid-template-columns: auto 1fr auto; }
  .l { display: inline-flex; align-items: center; gap: 6px; min-width: 16px; font-size: 13px; }
  .track { position: relative; display: flex; height: 8px; background: var(--track); border: 1px solid var(--line); }
  .sm .track { height: 4px; } .lg .track { height: 12px; }
  .track > i { display: block; height: 100%; background: var(--c); flex: none; }
  .track > i.hatch { background: repeating-linear-gradient(135deg, var(--c) 0 2px, transparent 2px 4px); }
  /* Cells: a gap after every whole unit so small levels read as blocks. */
  .track > s { position: absolute; top: 0; bottom: 0; width: 2px; margin-left: -1px; background: var(--panel-2); }
  .base { position: absolute; top: -4px; bottom: -4px; width: 2px; margin-left: -2px; background: #fff; z-index: 1; }
  .v { min-width: 74px; text-align: right; color: var(--text); font-size: 12px; }
  .lg .v { font: 700 20px/1 var(--head-font); min-width: 0; }
  .low .v { color: #ff9a9a; }
</style>
