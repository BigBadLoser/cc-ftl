<script lang="ts">
  /** Shield-style segments: `total` boxes, the first `on` of them filled. Shows `empty` text when there are none. */
  let { total, on, width = 20, height = 10, gap = 4, color = 'var(--hud-ok, var(--cyan))', empty = 'none', emptyCaps = false, fill = false, progress, title }: {
    total: number;
    on: number;
    width?: number;
    height?: number;
    gap?: number;
    color?: string;
    empty?: string;
    /** Show the empty text in small caps (as on the enemy card) rather than plain. */
    emptyCaps?: boolean;
    /** Share the row's width evenly (with `gap` between) instead of a fixed `width` each. */
    fill?: boolean;
    /** 0..1 toward the next layer: shown as a partial fill in the first empty box. */
    progress?: number;
    title?: string;
  } = $props();
  const slots = $derived(Array.from({ length: Math.max(0, total) }, (_, i) => i));
</script>

<span class="pips" class:fill style:gap="{gap}px" style:--c={color} {title}>
  {#each slots as i (i)}
    <i class:on={i < on} class:next={i === on && !!progress} style:--p="{Math.round((progress ?? 0) * 100)}%" style:width={fill ? undefined : `${width}px`} style:height="{height}px"></i>
  {:else}
    <em class:caps={emptyCaps}>{empty}</em>
  {/each}
</span>

<style>
  .pips {
    display: flex;
    align-items: center;
  }
  .pips.fill { width: 100%; }
  .pips.fill i { flex: 1 1 0; min-width: 0; }
  i {
    box-sizing: border-box;
    border: 1px solid var(--c);
  }
  i.on {
    background: var(--c);
  }
  i.next {
    background: linear-gradient(90deg, var(--c) var(--p), transparent var(--p));
  }
  em {
    font: 12px var(--head-font);
    font-style: normal;
    color: var(--dim);
  }
  em.caps {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
</style>
