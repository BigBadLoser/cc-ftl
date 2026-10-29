<script lang="ts">
  import Icon, { type IconName } from '../Icon.svelte';
  import { OVERCHARGE_COOLDOWN_SEC, OVERCHARGE_SEC, VENT_MIN_HEAT } from '../../sim/combat/heatTuning';
  import type { UiShipCombat } from '../api';

  type Sys = 'weapons' | 'shields' | 'engines';
  /**
   * The player's heat block, laid out as two grid items of the strip (`display: contents`): the gauge row (title, net rate, Vent, gauge) and the
   * Overcharge row, so both line up with the weapon cards and the Volley/Hold/Flee row. Everything is live from `UiShipCombat.heat`.
   */
  let { heat, rate, onVent, onOvercharge, onAuto }: {
    heat: UiShipCombat['heat']; rate: number; onVent: () => void; onOvercharge: (k: Sys) => void; onAuto: () => void;
  } = $props();

  const kinds: { k: Sys; icon: IconName; label: string }[] = [
    { k: 'weapons', icon: 'target', label: 'Weapons' },
    { k: 'shields', icon: 'shield', label: 'Shields' },
    { k: 'engines', icon: 'bolt', label: 'Engines' },
  ];
  const frac = $derived(heat.value / heat.max);
  const pct = $derived(Math.round(frac * 100));
  const tone = $derived(frac >= 0.9 ? 'red' : frac >= 0.7 ? 'amber' : 'cool');
  const locked = $derived(heat.lockout > 0);
  const rateText = $derived(`${rate >= 0 ? '+' : '−'}${Math.abs(rate).toFixed(1)}%/s`);
  const canVent = $derived(!locked && heat.venting === 0 && heat.value >= VENT_MIN_HEAT);
  const R = 15;
  const C = 2 * Math.PI * R;
  function ring(k: Sys): { f: number; cls: string; text: string } {
    const o = heat.overcharge[k];
    if (o.left > 0) return { f: o.left / OVERCHARGE_SEC, cls: 'act', text: `${o.left.toFixed(0)}s` };
    if (o.cooldown > 0) return { f: 1 - o.cooldown / OVERCHARGE_COOLDOWN_SEC, cls: 'cd', text: `${Math.ceil(o.cooldown)}s` };
    return { f: 0, cls: '', text: '' };
  }
</script>

<div class="hh" data-testid="heat-gauge">
  <div class="top">
    <span class="cap"><Icon name="fire" size={14} />Heat</span>
    <b class={tone}>{pct}%</b>
    <span class="rate" class:up={rate > 0.05} class:down={rate < -0.05} data-testid="heat-rate" title="Net heat change per second right now">{rateText}</span>
    <button class="auto" class:on={heat.auto} title={heat.auto ? 'Auto: the ship vents and holds volleys itself. Click for manual' : 'Manual heat. Click for auto'} onclick={onAuto}>Auto</button>
    <button class="vent" class:on={heat.venting > 0} disabled={!canVent} title="Vent: dump heat fast, but shields drop and weapons hold fire (G)" onclick={onVent}><Icon name="wind" size={15} />{heat.venting > 0 ? `${heat.venting.toFixed(1)}s` : 'Vent'}<kbd>G</kbd></button>
  </div>
  <div class="gauge {tone}" role="meter" aria-label="Ship heat" aria-valuenow={pct} aria-valuemin="0" aria-valuemax="100">
    <i style="width:{pct}%"></i><u style="left:70%"></u><u style="left:90%"></u>
  </div>
</div>
<div class="oc">
  {#each kinds as o (o.k)}
    {@const r = ring(o.k)}
    <button class="ocb {r.cls}" disabled={locked || r.cls === 'cd'} title="Overcharge {o.label}: stronger for {OVERCHARGE_SEC} s, adds heat, then a {OVERCHARGE_COOLDOWN_SEC} s cooldown" data-testid="overcharge-{o.k}" onclick={() => onOvercharge(o.k)}>
      <span class="ring">
        {#if r.cls}<svg viewBox="0 0 36 36" width="34" height="34"><circle cx="18" cy="18" r={R} class="trk" /><circle cx="18" cy="18" r={R} class="arc" stroke-dasharray={C} stroke-dashoffset={C * (1 - r.f)} transform="rotate(-90 18 18)" /></svg>{/if}
        <Icon name={o.icon} size={16} />
      </span>
      <span class="lb">{o.label}<em>{r.text}</em></span>
    </button>
  {/each}
</div>

<style>
  .hh { overflow: hidden; grid-column: 6; grid-row: 1; display: grid; grid-template-rows: auto 1fr; gap: 8px; min-width: 0; align-content: stretch; }
  .top { display: flex; align-items: center; gap: 7px; }
  .cap { display: inline-flex; align-items: center; gap: 4px; font: 600 13px/1 var(--head-font); letter-spacing: 0.08em; text-transform: uppercase; color: var(--dim); }
  b { font: 700 20px/1 var(--head-font); } b.cool { color: var(--cyan); } b.amber { color: var(--amber); } b.red { color: var(--red); }
  .rate { font: 600 13px/1 var(--head-font); color: var(--dim); min-width: 46px; } .rate.up { color: var(--amber); } .rate.down { color: var(--cyan); }
  .auto, .vent { min-height: 0; min-width: 0; height: 26px; padding: 0 7px; font: 600 13px var(--head-font); letter-spacing: 0.06em; text-transform: uppercase; display: inline-flex; align-items: center; gap: 4px; }
  .auto { margin-left: auto; color: var(--dim); } .auto.on { color: var(--cyan); border-color: var(--cyan); }
  .vent.on { border-color: var(--cyan); color: #fff; background: var(--panel-3); }
  kbd { font: 600 10px/1 var(--head-font); padding: 2px 3px; border: 1px solid var(--line-hi); color: var(--dim); }
  .gauge { position: relative; align-self: stretch; min-height: 20px; background: #061020; border: 1px solid var(--line-hi); }
  .gauge > i { display: block; height: 100%; background: linear-gradient(90deg, #1b8fb3, var(--cyan)); transition: width 0.2s; }
  .gauge.amber > i { background: linear-gradient(90deg, #1b8fb3, var(--amber)); }
  .gauge.red > i { background: linear-gradient(90deg, var(--amber), var(--red)); animation: pulse 0.9s infinite alternate; }
  .gauge > u { position: absolute; top: 0; bottom: 0; width: 1px; background: rgba(216, 240, 255, 0.45); }
  @keyframes pulse { to { filter: brightness(1.35); } }
  .oc { grid-column: 6; grid-row: 2; display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .ocb { min-height: 0; min-width: 0; height: 100%; padding: 0 2px; display: grid; justify-items: center; align-content: center; gap: 1px; color: var(--cyan); }
  .ocb.act { border-color: var(--amber); color: #fff; background: #2a2210; }
  .ocb.cd { color: var(--dim); }
  .ring { position: relative; width: 34px; height: 34px; display: grid; place-items: center; }
  .ring svg { position: absolute; inset: 0; }
  .trk { fill: none; stroke: #12384f; stroke-width: 3; }
  .arc { fill: none; stroke: var(--cyan); stroke-width: 3; } .act .arc { stroke: var(--amber); } .act .trk { stroke: #3a2f10; } .cd .arc { stroke: var(--line-hi); }
  .lb { font: 600 10px/1 var(--head-font); letter-spacing: 0.06em; text-transform: uppercase; color: var(--dim); } .act .lb { color: var(--amber); }
  .lb em { font-style: normal; margin-left: 4px; }
</style>
