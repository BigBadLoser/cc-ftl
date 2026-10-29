<script lang="ts">
  import type { UiIncoming } from '../api';

  /**
   * Mini timeline of the enemy shots committed to or flying at your ship: the next 5 seconds on an axis, one upward arrow per shot standing
   * at its time to impact and sliding left as it nears. Each shot's colour matches its arrow in the world. Fixed in place whichever
   * ship the main view shows.
   */
  let { shots }: { shots: UiIncoming[] } = $props();

  const SPAN = 5;
  const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;
  const at = (eta: number) => `${(Math.max(0, Math.min(SPAN, eta)) / SPAN) * 100}%`;
</script>

<div class="panel" data-testid="combat-incoming">
  <div class="head"><b>Incoming</b><span>Next 5 seconds</span></div>
  <div class="plot">
    <div class="axis"></div>
    {#each [0, 1, 2, 3, 4, 5] as t (t)}
      <i class="tick" style:left={at(t)}></i>
      <span class="lbl" style:left={at(t)}>{t}s</span>
    {/each}
    {#each shots as s (s.id)}
      <div class="shot" class:far={s.eta > SPAN} style:left={at(s.eta)} style:--c={hex(s.color)} title="{s.name}: {s.eta.toFixed(1)}s">
        <span class="tri"></span>
        <span class="stem"></span>
        {#if s.eta > SPAN}<em>›</em>{/if}
      </div>
    {/each}
  </div>
</div>

<style>
  .panel {
    width: 360px;
    padding: 8px 14px 6px;
    background: rgba(8, 14, 22, 0.92);
    border: 1px solid var(--line-hi);
    color: var(--text);
    pointer-events: auto;
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    font: 600 12px/1 var(--head-font);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .head span {
    font-size: 10px;
    color: var(--muted);
  }
  .plot {
    position: relative;
    height: 58px;
    margin: 0 10px;
  }
  .axis {
    position: absolute;
    left: 0;
    right: 0;
    top: 34px;
    height: 2px;
    background: var(--axis);
  }
  .tick {
    position: absolute;
    top: 30px;
    width: 2px;
    height: 10px;
    margin-left: -1px;
    background: var(--axis);
  }
  .lbl {
    position: absolute;
    top: 42px;
    transform: translateX(-50%);
    font: 600 10px/1 var(--head-font);
    color: var(--muted);
  }
  .shot {
    position: absolute;
    top: 12px;
    width: 0;
    height: 24px;
    transition: left 0.3s linear;
  }
  .shot.far {
    opacity: 0.55;
  }
  .tri {
    position: absolute;
    left: -6px;
    top: 0;
    border-left: 6px solid transparent;
    border-right: 6px solid transparent;
    border-bottom: 10px solid var(--c);
  }
  .stem {
    position: absolute;
    left: -2px;
    top: 9px;
    width: 4px;
    height: 15px;
    background: var(--c);
  }
  em {
    position: absolute;
    left: 6px;
    top: 2px;
    font: 700 12px/1 var(--head-font);
    font-style: normal;
    color: var(--c);
  }
</style>
