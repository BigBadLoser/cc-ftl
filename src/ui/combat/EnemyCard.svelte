<script lang="ts">
  import type { UiEnemyWeapon, UiShipCombat } from '../api';
  import Icon from '../Icon.svelte';
  import { hullTone } from './hullTone';
  import Frame from './Frame.svelte';

  /** Compact enemy card, top left: everything on it is live from the combat snapshot. One thin red frame, the name set into its top border. */
  let { enemy, state: pill, onFrame }: { enemy: UiShipCombat; state: { text: string; tone: string }; onFrame: () => void } = $props();
  const hull = $derived(Math.round(enemy.integrity * 100));
  const heatPct = $derived(Math.round((enemy.heat.value / enemy.heat.max) * 100));
  const hot = $derived(heatPct >= 90 ? 'red' : heatPct >= 70 ? 'amber' : '');
  const pips = $derived(Array.from({ length: Math.max(enemy.shield.max, 0) }, (_, i) => i < enemy.shield.layers));
  const sub = $derived([enemy.faction, enemy.klass].filter((x): x is string => !!x && x.toLowerCase() !== pill.text.toLowerCase()).join(' · '));
  const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;
  const status = (w: UiEnemyWeapon): string =>
    w.destroyed ? 'Destroyed' : w.stalled ? 'Offline' : w.eta !== null ? `Aimed ${w.eta.toFixed(1)}s` : w.fired ? 'Fired' : 'Charging';
</script>

<Frame title={enemy.name} tone="red" style="width:290px; pointer-events:auto; background: var(--panel)" testid="enemy-card">
  {#snippet right()}
    <span class="pill {pill.tone}">{pill.text}</span><i class="ln" style="width:14px"></i><button class="fr" title="Frame both ships" aria-label="Frame both ships" onclick={onFrame}><Icon name="frame" size={15} /></button>
  {/snippet}
<div class="body">
  {#if sub}<span class="fac">{sub}</span>{/if}
  <div class="def">
    <div class="srow">
      <span class="pips" title="Shield layers {enemy.shield.layers}/{enemy.shield.max}">{#each pips as on, i (i)}<i class:on></i>{:else}<em>no shields</em>{/each}</span>
      <span class="chip" title="Chance a shot misses">Evade <b>{Math.round(enemy.evasion * 100)}%</b></span>
    </div>
    <span class="bar big {hullTone(hull)}" class:low={hull < 30} title="Hull integrity"><i style="width:{hull}%"></i><b>{hull}%</b></span>
    <div class="hrow" title="Heat"><span class="bar slim heat {hot}"><i style="width:{heatPct}%"></i></span><span class="hp {hot}">Heat {heatPct}%</span></div>
  </div>

  {#if enemy.charges && enemy.charges.length > 0}
    <div class="wl" data-testid="enemy-charges">
      {#each enemy.charges as w (w.id)}
        <div class="w" class:aim={w.eta !== null || w.fired} class:off={w.stalled || w.destroyed} style:--c={w.eta !== null || w.fired ? hex(w.color) : null} title="{w.name}: {Math.round(w.charge * 100)}%">
          <span class="nm">{w.name}</span>
          <span class="bar slim"><i style="width:{Math.round(w.charge * 100)}%"></i><u style="left:{Math.round(w.commitAt * 100)}%"></u></span>
          <span class="st">{status(w)}</span>
        </div>
      {/each}
    </div>
  {/if}
</div>
</Frame>

<style>
  .body { display: grid; gap: 10px; }
  .fac { margin: 2px 0 -4px; font: 600 11px/1 var(--head-font); letter-spacing: 0.08em; text-transform: uppercase; color: #c98a8a; }
  .pill { font: 600 11px/1 var(--head-font); letter-spacing: 0.06em; text-transform: uppercase; padding: 3px 6px; border: 1px solid currentColor; margin: 0 4px; background: var(--panel); white-space: nowrap; }
  .pill.red { color: #ff8a8a; } .pill.amber { color: var(--amber); } .pill.green { color: var(--green); } .pill.dim { color: var(--dim); }
  .fr { min-height: 0; min-width: 0; width: 22px; height: 21px; padding: 0; display: grid; place-items: center; background: var(--panel); border: 1px solid #ff8a8a; border-radius: 0; margin: 0 4px; color: #ff8a8a; }

  /* One bar style: dark track, thin dim-red edge, square fill. */
  .bar { position: relative; display: block; box-sizing: border-box; background: #061020; border: 1px solid #5a2229; }
  .bar > i { display: block; height: 100%; background: var(--green); }
  .bar.amber > i { background: var(--amber); } .bar.red > i { background: var(--red); }
  .bar.low > i { animation: blink 0.8s infinite alternate; }
  .bar.big { height: 20px; } .bar.slim { height: 8px; }
  .bar.big > b { position: absolute; inset: 0; display: grid; place-items: center; font: 700 13px var(--head-font); color: #fff; text-shadow: 0 0 3px #000, 0 0 3px #000; }
  .bar.heat > i { background: linear-gradient(90deg, #1b8fb3, var(--cyan)); } .bar.heat.amber > i { background: linear-gradient(90deg, #1b8fb3, var(--amber)); } .bar.heat.red > i { background: linear-gradient(90deg, var(--amber), var(--red)); }
  .def { display: grid; gap: 3px; }
  .srow { display: flex; align-items: center; justify-content: space-between; height: 20px; }
  .pips { display: flex; gap: 2px; align-items: center; } .pips i { width: 26px; height: 7px; border: 1px solid var(--cyan); box-sizing: border-box; } .pips i.on { background: var(--cyan); }
  .chip { font: 600 11px/1 var(--head-font); letter-spacing: 0.08em; text-transform: uppercase; color: var(--dim); padding: 2px 5px; border: 1px solid var(--line); } .chip b { color: var(--text); font-weight: 700; }
  .hrow { display: flex; align-items: center; gap: 8px; margin-top: 3px; } .hrow .bar { flex: 1; }
  .hp { font: 600 11px/1 var(--head-font); letter-spacing: 0.06em; text-transform: uppercase; color: var(--dim); min-width: 62px; text-align: right; } .hp.amber { color: var(--amber); } .hp.red { color: var(--red); }
  em { font: 11px var(--head-font); color: var(--dim); font-style: normal; text-transform: uppercase; letter-spacing: 0.06em; }

  /* Weapons: name, charge bar, status. A committed shot takes its colour (the same as its line in the world and its marker on the incoming timeline). */
  .wl { display: grid; gap: 5px; }
  .w { display: grid; grid-template-columns: 92px minmax(0, 1fr) 68px; gap: 8px; align-items: center; height: 16px; --c: var(--cyan); }
  .w .nm { font: 600 13px/1 var(--head-font); letter-spacing: 0.03em; white-space: nowrap; overflow: hidden; color: var(--text); }
  .w .st { font: 600 11px/1 var(--head-font); letter-spacing: 0.06em; text-transform: uppercase; text-align: right; white-space: nowrap; color: var(--dim); }
  .w .bar > i { background: var(--cyan); }
  .w .bar > u { position: absolute; top: -2px; bottom: -2px; width: 1px; background: var(--dim); }
  .w.aim .nm, .w.aim .st { color: var(--c); } .w.aim .bar { border-color: var(--c); } .w.aim .bar > i { background: var(--c); }
  .w.off { opacity: 0.4; }
  @keyframes blink { to { opacity: 0.5; } }
</style>
