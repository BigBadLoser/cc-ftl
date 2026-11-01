<script lang="ts">
  import Icon, { type IconName } from '../Icon.svelte';

  /**
   * A labelled stat bar, one look everywhere: an 8px bar of `value` out of `max` (or stacked `segments`, each with its own
   * colour), an optional baseline tick, optional whole-unit cells, and a right-aligned readout. The label and readout
   * columns take `--sb-label` and `--sb-value` so rows line up when stacked.
   */
  let { label, icon, value = 0, max = 100, segments, baseline, cells = false, text, color = 'var(--cyan)', low = false, testId, title }: {
    label?: string; icon?: IconName; value?: number; max?: number;
    segments?: { value: number; color: string; hatch?: boolean }[];
    baseline?: number; cells?: boolean; text?: string; color?: string; low?: boolean; testId?: string; title?: string;
  } = $props();
  const pct = (v: number) => `${Math.max(0, Math.min(100, (v / Math.max(1e-6, max)) * 100))}%`;
  const parts = $derived(segments ?? [{ value, color: low ? 'var(--red)' : color }]);
</script>

<div class="sb" class:low class:labelled={!!(label || icon)} class:texted={text !== undefined} data-testid={testId} {title}>
  {#if label || icon}<span class="l">{#if icon}<Icon name={icon} size={16} />{/if}{#if label}<span>{label}</span>{/if}</span>{/if}
  <span class="track">
    {#each parts as s, i (i)}<i class:hatch={s.hatch} style:width={pct(s.value)} style:--c={s.color}></i>{/each}
    {#if cells}{#each Array.from({ length: Math.max(0, Math.round(max) - 1) }, (_v, i) => i) as i (i)}<s style:left={pct(i + 1)}></s>{/each}{/if}
    {#if baseline !== undefined && baseline > 0}<b class="base" style:left={pct(baseline)}></b>{/if}
  </span>
  {#if text !== undefined}<span class="v">{text}</span>{/if}
</div>

<style>
  .sb { display: grid; grid-template-columns: 1fr; align-items: center; gap: 10px; min-height: 22px; color: var(--dim); font-size: 13px; }
  .sb.texted { grid-template-columns: 1fr var(--sb-value, auto); }
  .sb.labelled { grid-template-columns: var(--sb-label, auto) 1fr; }
  .sb.labelled.texted { grid-template-columns: var(--sb-label, auto) 1fr var(--sb-value, auto); }
  .l { display: inline-flex; align-items: center; gap: 6px; min-width: 16px; }
  .track { position: relative; display: flex; height: 8px; background: var(--track); border: 1px solid var(--line); }
  .track > i { display: block; height: 100%; background: var(--c); flex: none; }
  .track > i.hatch { background: repeating-linear-gradient(135deg, var(--c) 0 2px, transparent 2px 4px); }
  .track > s { position: absolute; top: 0; bottom: 0; width: 2px; margin-left: -1px; background: var(--panel); }
  .base { position: absolute; top: -3px; bottom: -3px; width: 2px; margin-left: -1px; background: #fff; }
  .v { text-align: right; color: var(--text); white-space: nowrap; }
  .low .v { color: #ff9a9a; }
</style>
