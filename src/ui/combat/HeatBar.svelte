<script module lang="ts">
  import { tip } from '../kit';
  /** Heat's own colour scale (cool, then amber from 70%, red from 90%), shared by the player's gauge and the enemy card. */
  export type HeatTone = 'cool' | 'amber' | 'red';
  export function heatTone(frac: number): HeatTone {
    return frac >= 0.9 ? 'red' : frac >= 0.7 ? 'amber' : 'cool';
  }
</script>

<script lang="ts">
  /**
   * The heat bar: a gradient fill in heat's own colour scale (a domain palette, like the crew bar's needs colours, so not a `Meter`
   * tone), pulsing when red. `marks` draws the quarter ticks, `autoVent` the auto-vent line (a fraction). With no `height` it
   * stretches to its parent.
   */
  let { value, max, height, edge = 'var(--line-hi)', marks = false, autoVent, label = 'Heat' }: {
    value: number;
    max: number;
    height?: number;
    edge?: string;
    marks?: boolean;
    autoVent?: number;
    label?: string;
  } = $props();

  const frac = $derived(max > 0 ? Math.max(0, Math.min(1, value / max)) : 0);
  const pct = $derived(Math.round(frac * 100));
  const tone = $derived(heatTone(frac));
</script>

<div
  class="gauge {tone}"
  class:stretch={height === undefined}
  style:height={height === undefined ? undefined : `${height}px`}
  style:border-color={edge}
  role="meter"
  aria-label={label}
  aria-valuenow={pct}
  aria-valuemin="0"
  aria-valuemax="100"
>
  <i style="width:{pct}%"></i>
  {#if marks}<u style="left:25%"></u><u style="left:50%"></u><u style="left:75%"></u>{/if}
  {#if autoVent !== undefined}<s style="left:{autoVent * 100}%" use:tip={{ text: 'Auto-vent line' }}></s>{/if}
</div>

<style>
  .gauge {
    position: relative;
    width: 100%;
    box-sizing: border-box;
    background: var(--track);
    border: 1px solid var(--line-hi);
  }
  .gauge.stretch {
    align-self: stretch;
    min-height: 20px;
  }
  .gauge > i {
    display: block;
    height: 100%;
    background: linear-gradient(90deg, var(--heat-low), var(--cyan));
    transition: width 0.2s;
  }
  .gauge.amber > i { background: linear-gradient(90deg, var(--heat-low), var(--amber)); }
  .gauge.red > i {
    background: linear-gradient(90deg, var(--amber), var(--red));
    animation: pulse 0.9s infinite alternate;
  }
  .gauge > s {
    position: absolute;
    top: -3px;
    bottom: -3px;
    width: 2px;
    background: var(--amber);
  }
  .gauge > u {
    position: absolute;
    top: 55%;
    bottom: 0;
    width: 1px;
    background: rgba(216, 240, 255, 0.22);
  }
  @keyframes pulse {
    to { filter: brightness(1.35); }
  }
</style>
