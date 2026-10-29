<script lang="ts">
  import type { UiShipCombat } from '../api';
  import Icon from '../Icon.svelte';
  import { hullTone } from './hullTone';
  import EnemyCharges from '../EnemyCharges.svelte';

  /** Compact enemy card, top left: everything on it is live from the combat snapshot. */
  let { enemy, state: pill, onFrame }: { enemy: UiShipCombat; state: { text: string; tone: string }; onFrame: () => void } = $props();
  const hull = $derived(Math.round(enemy.integrity * 100));
  const heatPct = $derived(Math.round((enemy.heat.value / enemy.heat.max) * 100));
  const hot = $derived(heatPct >= 90 ? 'red' : heatPct >= 70 ? 'amber' : '');
  const pips = $derived(Array.from({ length: Math.max(enemy.shield.max, 0) }, (_, i) => i < enemy.shield.layers));
</script>

<section class="card" data-testid="enemy-card" aria-label="Enemy ship">
  <h3 class="ttl">{enemy.name}<span class="sub"> · {enemy.faction}{enemy.klass ? ` · ${enemy.klass}` : ''}</span></h3>
  <div class="tr"><span class="pill {pill.tone}">{pill.text}</span><button class="fr" title="Frame both ships" aria-label="Frame both ships" onclick={onFrame}><Icon name="frame" size={15} /></button></div>
  <div class="grid">
    <span class="lbl" title="Hull integrity">Hull</span>
    <span class="hb {hullTone(hull)}" class:low={hull < 30}><i style="width:{hull}%"></i></span><b>{hull}%</b>

    <span class="lbl" title="Shield layers">Shields</span>
    <span class="pips">{#each pips as on, i (i)}<i class:on></i>{:else}<em>none</em>{/each}</span><b>{enemy.shield.layers}/{enemy.shield.max}</b>

    <span class="lbl" title="Chance a shot misses">Evasion</span>
    <span></span><b class="ev">{Math.round(enemy.evasion * 100)}%</b>

    <span class="lbl" title="Heat">Heat</span>
    <span class="hb heat {hot}"><i style="width:{heatPct}%"></i></span><b class={hot}>{heatPct}%</b>

    <span class="lbl" title="Weapon charge">Weapons</span>
    <span class="wch"><EnemyCharges weapons={enemy.charges ?? []} /></span><span></span>
  </div>
</section>

<style>
  /* One thin red frame; the ship's name is set into its top line, the state pill and frame button into the right end (like the strip's section titles). */
  .card { position: relative; box-sizing: border-box; width: 350px; background: var(--panel); border: 1px solid #b8343c; padding: 16px 10px 10px; pointer-events: auto; }
  .ttl { position: absolute; top: -8px; left: 9px; margin: 0; padding: 0 6px; background: var(--panel); font: 700 15px/16px var(--head-font); letter-spacing: 0.08em; text-transform: uppercase; color: #ff8a8a; white-space: nowrap; }
  .sub { margin-left: 5px; font-weight: 400; font-size: 12px; letter-spacing: 0.04em; color: #c98a8a; }
  .tr { position: absolute; top: -11px; right: 9px; display: flex; align-items: center; gap: 2px; padding: 0 4px; background: var(--panel); }
  .pill { font: 600 11px/1 var(--head-font); letter-spacing: 0.06em; text-transform: uppercase; padding: 3px 6px; border: 1px solid currentColor; white-space: nowrap; }
  .pill.red { color: #ff8a8a; } .pill.amber { color: var(--amber); } .pill.green { color: var(--green); } .pill.dim { color: var(--dim); }
  .fr { min-height: 0; min-width: 0; width: 22px; height: 22px; padding: 0; display: grid; place-items: center; background: transparent; border-color: transparent; color: #ffb3b3; }
  .grid { display: grid; grid-template-columns: 66px minmax(0, 1fr) 40px; gap: 7px 8px; align-items: center; }
  .lbl { font: 600 12px var(--head-font); letter-spacing: 0.08em; text-transform: uppercase; color: var(--dim); }
  b { font: 600 14px var(--head-font); text-align: right; } b.amber { color: var(--amber); } b.red { color: var(--red); }
  .hb { display: block; height: 10px; background: #061020; border: 1px solid #5a2229; } .hb > i { display: block; height: 100%; background: var(--green); } .hb.amber > i { background: var(--amber); } .hb.red > i { background: var(--red); }
  .hb.heat > i { background: linear-gradient(90deg, #1b8fb3, var(--cyan)); } .hb.heat.amber > i { background: linear-gradient(90deg, #1b8fb3, var(--amber)); } .hb.heat.red > i { background: linear-gradient(90deg, var(--amber), var(--red)); }
  .hb.low > i { animation: blink 0.8s infinite alternate; }
  .pips { display: inline-flex; gap: 4px; height: 10px; } .pips i { width: 20px; height: 10px; border: 1px solid var(--cyan); box-sizing: border-box; } .pips i.on { background: var(--cyan); }
  b.ev { color: var(--text); grid-column: 3; }
  em { font: 12px var(--head-font); color: var(--dim); font-style: normal; }
  .wch :global(.chg) { padding-bottom: 0; } .wch :global(.bar) { height: 10px; }
  @keyframes blink { to { opacity: 0.5; } }
</style>
