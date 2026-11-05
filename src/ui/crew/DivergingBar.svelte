<script lang="ts">
  import { signed } from './socialFormat';

  /** A bar that grows from the middle: right (green) for liking, left (red) for dislike. The number is on hover only. */
  let { value, label, thin = false }: { value: number; label: string; thin?: boolean } = $props();
  const w = $derived(Math.min(50, (Math.abs(value) / 100) * 50));
</script>

<span class="bar" class:thin title="{label}: {signed(value)}" role="img" aria-label="{label}: {signed(value)}">
  <i class="mid"></i>
  <i class="fill" class:neg={value < 0} style="width:{w}%; {value < 0 ? `right:50%` : `left:50%`}"></i>
</span>

<style>
  .bar { position: relative; display: block; height: 6px; background: #0a1522; border: 1px solid var(--line); box-sizing: border-box; }
  .bar.thin { height: 4px; border-color: transparent; }
  .mid { position: absolute; left: 50%; top: -2px; bottom: -2px; width: 1px; background: var(--dim); opacity: 0.6; }
  .fill { position: absolute; top: 0; bottom: 0; background: var(--green); }
  .fill.neg { background: var(--red); }
</style>
