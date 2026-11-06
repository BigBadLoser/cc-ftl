<script lang="ts">
  import { meterTone } from './meterTone';

  /**
   * The one bar style: a dark track (`--track`) with a thin edge and a square fill.
   * Give it `value` out of `max` (default 1) and a `tone`: `auto` colours by the 60/30 hull rule (green from 60%, amber from 30%,
   * red below; `thresholds` overrides the two cut-offs as percentages), `good`/`warn`/`bad` are fixed health colours and `neutral`
   * (default) is the plain HUD bar colour, for progress that is not good or bad. `height` is 4, 6 or 8; `base` is a white tick at
   * that value; `title` is the hover text for the numbers. Cyan is not a fill colour here: it means selection.
   * Older callers (the combat HUD) pass `fill` (any CSS background) instead of a tone, plus `label` drawn inside the bar,
   * `notches` (0 to 1 marks) and `blink`; without a `height` the bar stretches to its container.
   */
  let { value, max = 1, tone = 'neutral', thresholds, fill, height, base, edge = 'var(--line)', edgeWidth, label, notches = [], blink = false, title, testId }: {
    value: number;
    max?: number;
    tone?: 'auto' | 'good' | 'warn' | 'bad' | 'neutral';
    thresholds?: { good: number; warn: number };
    fill?: string;
    height?: 4 | 6 | 8 | number;
    base?: number;
    edge?: string;
    edgeWidth?: number;
    label?: string;
    notches?: readonly number[];
    blink?: boolean;
    title?: string;
    testId?: string;
  } = $props();
  const frac = $derived(Math.max(0, Math.min(1, value / Math.max(1e-6, max))));
  const pct = $derived(Math.round(frac * 100));
  const resolved = $derived(tone === 'auto' ? meterTone(frac * 100, thresholds) : tone);
  const TONE_FILL = { good: 'var(--health-good)', warn: 'var(--health-warn)', bad: 'var(--health-bad)', neutral: 'var(--hud-bar)' } as const;
  const color = $derived(fill ?? TONE_FILL[resolved]);
  const border = $derived(edgeWidth ?? (fill !== undefined || (height ?? 0) >= 8 ? 1 : 0));
</script>

<span class="meter" style:height={height === undefined ? undefined : `${height}px`} style:border="{border}px solid {edge}" style:box-shadow={border === 0 && fill === undefined ? '0 0 0 1px var(--line)' : undefined} {title} role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} data-testid={testId}>
  <i class:blink style:width="{pct}%" style:background={color}></i>
  {#each notches as at (at)}<u style:left="{Math.round(at * 100)}%"></u>{/each}
  {#if base !== undefined && base > 0}<s style:left="{Math.round(Math.min(1, base / Math.max(1e-6, max)) * 100)}%"></s>{/if}
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
  s {
    position: absolute;
    top: -2px;
    bottom: -2px;
    width: 2px;
    margin-left: -1px;
    background: #fff;
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
