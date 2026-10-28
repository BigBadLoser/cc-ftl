<script lang="ts">
  import type { UiShipCombat } from '../api';
  import Icon from '../Icon.svelte';
  import EnemyCharges from '../EnemyCharges.svelte';

  /** Compact enemy card, top centre. Hull, shields, evasion and weapon charges are live; faction, class and heat are MOCK (the UI snapshot has no faction or class, and heat has no sim). */
  let { enemy, state: pill }: { enemy: UiShipCombat; state: { text: string; tone: string } } = $props();
  const hull = $derived(Math.round(enemy.integrity * 100));
  /** MOCK values. */
  const FAKE = { faction: 'Rust Pirates', klass: 'Raider-class', heat: 0.38 };
  const pips = $derived(Array.from({ length: Math.max(enemy.shield.max, 0) }, (_, i) => i < enemy.shield.layers));
</script>

<section class="card" data-testid="enemy-card" aria-label="Enemy ship">
  <header>
    <Icon name="target" size={18} />
    <h2>{enemy.name}</h2>
    <span class="sub">{FAKE.faction} · {FAKE.klass}</span>
    <span class="pill {pill.tone}">{pill.text}</span>
  </header>
  <div class="row">
    <span class="st" title="Hull integrity"><Icon name="hull" size={15} /><span class="hb" class:low={hull < 35}><i style="width:{hull}%"></i></span><b>{hull}%</b></span>
    <span class="st" title="Shield layers"><Icon name="shield" size={15} />
      <span class="pips">{#each pips as on, i (i)}<i class:on></i>{:else}<em>none</em>{/each}</span></span>
    <span class="st" title="Chance a shot misses"><Icon name="evasion" size={15} /><b>{Math.round(enemy.evasion * 100)}%</b></span>
  </div>
  <div class="row heat" title="Enemy heat (mock)">
    <Icon name="fire" size={15} /><span class="hb amber"><i style="width:{FAKE.heat * 100}%"></i></span><b>{Math.round(FAKE.heat * 100)}%</b>
  </div>
  <div class="ch"><span class="cap">Weapons</span><EnemyCharges weapons={enemy.charges ?? []} /></div>
</section>

<style>
  .card { width: 340px; background: var(--panel); border: 1px solid var(--line-hi); padding: 0 10px 4px; display: grid; gap: 6px; pointer-events: auto; }
  header { display: flex; align-items: center; gap: 8px; margin: 0 -10px; padding: 5px 10px; background: #0d4a66; color: #fff; }
  h2 { margin: 0; font: 600 17px/1 var(--head-font); letter-spacing: 0.06em; text-transform: uppercase; }
  .sub { font: 12px var(--head-font); color: #a9d8ee; letter-spacing: 0.04em; flex: 1; white-space: nowrap; }
  .pill { font: 600 11px/1 var(--head-font); letter-spacing: 0.06em; text-transform: uppercase; padding: 3px 6px; border: 1px solid currentColor; background: #061020; }
  .pill.red { color: #ff8a8a; } .pill.amber { color: var(--amber); } .pill.green { color: var(--green); } .pill.dim { color: var(--dim); }
  .row { display: flex; align-items: center; gap: 14px; color: var(--cyan); }
  .st { display: inline-flex; align-items: center; gap: 6px; }
  .st:first-child { flex: 1; }
  b { color: var(--text); font: 600 14px var(--head-font); min-width: 30px; }
  .hb { flex: 1; display: block; height: 8px; background: #061020; border: 1px solid var(--line); }
  .hb > i { display: block; height: 100%; background: var(--red); } .hb.low > i { animation: blink 0.8s infinite alternate; }
  .hb.amber > i { background: linear-gradient(90deg, #1b8fb3, var(--amber)); }
  .row.heat { gap: 6px; } .row.heat .hb { height: 6px; }
  .pips { display: inline-flex; gap: 3px; } .pips i { width: 14px; height: 8px; border: 1px solid var(--cyan); } .pips i.on { background: var(--cyan); }
  em { font: 12px var(--head-font); color: var(--dim); }
  .ch { display: grid; grid-template-columns: auto 1fr; align-items: center; gap: 8px; padding-top: 4px; }
  .ch :global(.chg) { padding-bottom: 0; }
  .ch :global(.bar) { height: 8px; }
  .cap { font: 600 11px/1 var(--head-font); letter-spacing: 0.08em; text-transform: uppercase; color: var(--dim); }
  @keyframes blink { to { opacity: 0.5; } }
</style>
