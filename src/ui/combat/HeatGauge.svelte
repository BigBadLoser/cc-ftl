<script lang="ts">
  import Icon from '../Icon.svelte';
  import { OVERCHARGE_COOLDOWN_SEC, OVERCHARGE_ENGINE_EVASION, OVERCHARGE_HEAT_PER_SEC, OVERCHARGE_SEC, OVERCHARGE_SHIELD_REGEN, OVERCHARGE_WEAPON_CHARGE, VENT_MIN_HEAT } from '../../sim/combat/heatTuning';
  import type { UiShipCombat } from '../api';

  type Sys = 'weapons' | 'shields' | 'engines';
  /**
   * The player's heat block, laid out as two grid items of the strip (`display: contents`): the gauge row (title, net rate, Vent, gauge) and the
   * Overcharge row, so both line up with the weapon cards and the Volley/Hold/Flee row. Everything is live from `UiShipCombat.heat`.
   */
  let { heat, rate, onVent, onOvercharge }: {
    heat: UiShipCombat['heat']; rate: number; onVent: () => void; onOvercharge: (k: Sys) => void;
  } = $props();

  /** Effect lines and tooltips come from the tuning constants. */
  const kinds: { k: Sys; label: string; effect: string; tip: string }[] = [
    { k: 'weapons', label: 'Weapons', effect: `+${Math.round((OVERCHARGE_WEAPON_CHARGE - 1) * 100)}% charge`, tip: `weapons charge ${Math.round((OVERCHARGE_WEAPON_CHARGE - 1) * 100)}% faster` },
    { k: 'shields', label: 'Shields', effect: `${OVERCHARGE_SHIELD_REGEN}× regen`, tip: `shields regenerate ${OVERCHARGE_SHIELD_REGEN}× as fast` },
    { k: 'engines', label: 'Engines', effect: `+${Math.round(OVERCHARGE_ENGINE_EVASION * 100)}% evasion`, tip: `+${Math.round(OVERCHARGE_ENGINE_EVASION * 100)}% evasion (needs a pilot at the helm)` },
  ];
  const frac = $derived(heat.value / heat.max);
  const pct = $derived(Math.round(frac * 100));
  const tone = $derived(frac >= 0.9 ? 'red' : frac >= 0.7 ? 'amber' : 'cool');
  const locked = $derived(heat.lockout > 0);
  const rateText = $derived(`${rate >= 0 ? '+' : '−'}${Math.abs(rate).toFixed(1)}%/s`);
  const canVent = $derived(!locked && heat.venting === 0 && heat.value >= VENT_MIN_HEAT);
  /** Bar fill and the status line of one system: active (time left), cooling down (time until ready), or idle (its effect). */
  function state(k: Sys, effect: string): { f: number; cls: string; text: string } {
    const o = heat.overcharge[k];
    if (o.left > 0) return { f: o.left / OVERCHARGE_SEC, cls: 'act', text: `${Math.ceil(o.left)}s left` };
    if (o.cooldown > 0) return { f: 1 - o.cooldown / OVERCHARGE_COOLDOWN_SEC, cls: 'cd', text: `ready in ${Math.ceil(o.cooldown)}s` };
    return { f: 0, cls: '', text: effect };
  }
</script>

<div class="hh" data-testid="heat-gauge">
  <div class="top">
    <span class="cap"><Icon name="fire" size={14} />Heat</span>
    <b class={tone}>{pct}%</b>
    <span class="rate" class:up={rate > 0.05} class:down={rate < -0.05} data-testid="heat-rate" title="Net heat change per second right now">{rateText}</span>
    <button class="vent" class:on={heat.venting > 0} disabled={!canVent} title="Vent: dump heat fast, but shields drop and weapons hold fire (G)" onclick={onVent}><Icon name="wind" size={15} />{heat.venting > 0 ? `${heat.venting.toFixed(1)}s` : 'Vent'}<kbd>G</kbd></button>
  </div>
  <div class="gauge {tone}" role="meter" aria-label="Ship heat" aria-valuenow={pct} aria-valuemin="0" aria-valuemax="100">
    <i style="width:{pct}%"></i><u style="left:25%"></u><u style="left:50%"></u><u style="left:75%"></u><s style="left:70%" title="Auto-vent line"></s>
  </div>
</div>
<div class="oc">
  <span class="cap">Overcharge</span>
  <div class="obs">
    {#each kinds as o (o.k)}
      {@const r = state(o.k, o.effect)}
      <button class="ocb {r.cls}" disabled={locked || r.cls === 'cd'} title="Overcharge {o.label}: {o.tip} for {OVERCHARGE_SEC} s. +{OVERCHARGE_HEAT_PER_SEC[o.k]} heat/s while active, then a {OVERCHARGE_COOLDOWN_SEC} s cooldown." data-testid="overcharge-{o.k}" onclick={() => onOvercharge(o.k)}>
        <span class="nm">{o.label}</span>
        <span class="fx">{r.text}</span>
        {#if r.cls}<i class="bar" style="width:{Math.round(r.f * 100)}%"></i>{/if}
      </button>
    {/each}
  </div>
</div>

<style>
  .hh { box-sizing: border-box; padding-right: 2px; overflow: hidden; grid-column: 6; grid-row: 1; display: grid; grid-template-rows: auto 1fr; gap: 8px; min-width: 0; align-content: stretch; }
  .top { display: flex; align-items: center; gap: 7px; }
  .cap { display: inline-flex; align-items: center; gap: 4px; font: 600 13px/1 var(--head-font); letter-spacing: 0.08em; text-transform: uppercase; color: var(--dim); }
  b { font: 700 20px/1 var(--head-font); } b.cool { color: var(--cyan); } b.amber { color: var(--amber); } b.red { color: var(--red); }
  .rate { font: 600 13px/1 var(--head-font); color: var(--dim); min-width: 46px; } .rate.up { color: var(--amber); } .rate.down { color: var(--cyan); }
  .vent { margin-left: auto; min-height: 0; min-width: 0; height: 26px; padding: 0 7px; font: 600 13px var(--head-font); letter-spacing: 0.06em; text-transform: uppercase; display: inline-flex; align-items: center; gap: 4px; }
  .vent.on { border-color: var(--cyan); color: #fff; background: var(--panel-3); }
  kbd { font: 600 10px/1 var(--head-font); padding: 2px 3px; border: 1px solid var(--line-hi); color: var(--dim); }
  .gauge { position: relative; align-self: stretch; min-height: 20px; background: #061020; border: 1px solid var(--line-hi); }
  .gauge > i { display: block; height: 100%; background: linear-gradient(90deg, #1b8fb3, var(--cyan)); transition: width 0.2s; }
  .gauge.amber > i { background: linear-gradient(90deg, #1b8fb3, var(--amber)); }
  .gauge.red > i { background: linear-gradient(90deg, var(--amber), var(--red)); animation: pulse 0.9s infinite alternate; }
  .gauge > s { position: absolute; top: -3px; bottom: -3px; width: 2px; background: var(--amber); }
  .gauge > u { position: absolute; top: 0; bottom: 0; width: 1px; background: rgba(216, 240, 255, 0.22); top: 55%; }
  @keyframes pulse { to { filter: brightness(1.35); } }
  .oc { grid-column: 6; grid-row: 2; display: grid; grid-template-rows: auto 1fr; gap: 4px; min-height: 0; }
  .obs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; min-height: 0; }
  .ocb { position: relative; min-height: 0; min-width: 0; height: 100%; padding: 0 2px; display: grid; align-content: center; justify-items: center; gap: 3px; overflow: hidden; color: var(--cyan); }
  .ocb .nm { font: 700 12px/1 var(--head-font); letter-spacing: 0.06em; text-transform: uppercase; white-space: nowrap; }
  .ocb .fx { font: 600 11px/1 var(--head-font); color: var(--dim); white-space: nowrap; }
  .ocb .bar { position: absolute; left: 0; bottom: 0; height: 3px; background: var(--cyan); }
  .ocb.act { border-color: var(--amber); color: #fff; background: #2a2210; } .act .fx { color: var(--amber); } .act .bar { background: var(--amber); }
  .ocb.cd { color: var(--dim); } .cd .bar { background: var(--line-hi); }
</style>
