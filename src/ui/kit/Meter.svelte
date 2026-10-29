<script lang="ts">
  /**
   * The one bar style: a dark track with a thin edge and a square fill. `value` is 0 to 1, `fill` any CSS background (a colour or
   * gradient). Without a `height` the bar stretches to its container. `label` is drawn inside the bar; `notches` are 0 to 1 marks
   * across it; `blink` pulses the fill.
   */
  let { value, fill = 'var(--health-good)', height, edge = 'var(--line)', edgeWidth = 1, label, notches = [], blink = false, title }: {
    value: number;
    fill?: string;
    height?: number;
    edge?: string;
    edgeWidth?: number;
    label?: string;
    notches?: readonly number[];
    blink?: boolean;
    title?: string;
  } = $props();
  const pct = $derived(Math.round(Math.max(0, Math.min(1, value)) * 100));
</script>

<span class="meter" style:height={height === undefined ? undefined : `${height}px`} style:border="{edgeWidth}px solid {edge}" {title}>
  <i class:blink style:width="{pct}%" style:background={fill}></i>
  {#each notches as at (at)}<u style:left="{Math.round(at * 100)}%"></u>{/each}
  {#if label}<b>{label}</b>{/if}
</span>

<style>
  .meter {
    position: relative;
    display: block;
    box-sizing: border-box;
    width: 100%;
    background: var(--track);
  }
  i {
    display: block;
    height: 100%;
  }
  i.blink {
    animation: blink 0.8s infinite alternate;
  }
  u {
    position: absolute;
    top: -2px;
    bottom: -2px;
    width: 1px;
    background: var(--dim);
  }
  b {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    font: 700 13px var(--head-font);
    color: #fff;
    text-shadow: 0 0 3px #000, 0 0 3px #000;
  }
  @keyframes blink {
    to { opacity: 0.5; }
  }
</style>
