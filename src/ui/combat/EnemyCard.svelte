<script lang="ts">
  import type { UiShipCombat } from '../api';
  import Icon from '../Icon.svelte';
  import { hullTone } from './hullTone';
  import EnemyCharges from '../EnemyCharges.svelte';

  /** Compact enemy card, top left. Everything is live (including heat) except faction and class: the UI snapshot has no such fields yet (MOCK strings below). */
  let { enemy, state: pill, onFrame, drive, onFlee }: {
    enemy: UiShipCombat; state: { text: string; tone: string }; onFrame: () => void;
    /** Your FTL drive: the Disengage (flee) button lives here, with its charge as a bar along the header's bottom edge. */
    drive: { charge: number; max: number; helmManned: boolean; active: boolean } | null; onFlee: () => void;
  } = $props();
  const ready = $derived(!!drive && drive.charge >= drive.max && drive.active);
  const drivePct = $derived(drive ? Math.min(100, Math.round((drive.charge / drive.max) * 100)) : 0);
  const driveTip = $derived(ready ? 'Disengage: jump out of the fight, then pick where to go on the starmap (F)' : !drive ? '' : drive.helmManned ? `Disengage: drive charging ${Math.floor(drive.charge)}/${drive.max} s (F)` : 'Helm unmanned: the drive is not charging (F)');
  const hull = $derived(Math.round(enemy.integrity * 100));
  const FAKE = { faction: 'Pirate', klass: 'Raider' };
  const heatPct = $derived(Math.round((enemy.heat.value / enemy.heat.max) * 100));
  const hot = $derived(heatPct >= 90 ? 'red' : heatPct >= 70 ? 'amber' : '');
  const pips = $derived(Array.from({ length: Math.max(enemy.shield.max, 0) }, (_, i) => i < enemy.shield.layers));
</script>

<section class="card" data-testid="enemy-card" aria-label="Enemy ship">
  <header>
    <h2>{enemy.name}</h2>
    <span class="pill {pill.tone}">{pill.text}</span>
    <button class="fr" title="Frame both ships" aria-label="Frame both ships" onclick={onFrame}><Icon name="frame" size={16} /></button>
    <span class="sub">{FAKE.faction} · {FAKE.klass}</span>
    <button class="dis" class:ready disabled={!ready} title={driveTip} aria-label="Disengage" data-testid="combat-flee" onclick={onFlee}><Icon name="fast" size={15} />Disengage<kbd>F</kbd></button>
    <span class="drv" class:ready title="FTL drive charge"><i style="width:{drivePct}%"></i></span>
  </header>
  <div class="grid">
    <span class="ic" title="Hull integrity"><Icon name="hull" size={15} /></span>
    <span class="hb {hullTone(hull)}" class:low={hull < 30}><i style="width:{hull}%"></i></span><b>{hull}%</b>

    <span class="ic" title="Shield layers"><Icon name="shield" size={15} /></span>
    <span class="mid"><span class="pips">{#each pips as on, i (i)}<i class:on></i>{:else}<em>none</em>{/each}</span><span class="ev" title="Chance a shot misses"><Icon name="evasion" size={14} />{Math.round(enemy.evasion * 100)}%</span></span><b>{enemy.shield.layers}/{enemy.shield.max}</b>

    <span class="ic" title="Heat"><Icon name="fire" size={15} /></span>
    <span class="hb heat {hot}"><i style="width:{heatPct}%"></i></span><b class={hot}>{heatPct}%</b>

    <span class="ic" title="Weapon charge"><Icon name="target" size={15} /></span>
    <span class="wch"><EnemyCharges weapons={enemy.charges ?? []} /></span><span></span>
  </div>
</section>

<style>
  .card { background: var(--panel) !important; border-color: #b8343c !important; box-shadow: 0 0 14px rgba(255, 90, 90, 0.18); box-sizing: border-box; grid-template-columns: minmax(0, 1fr); width: 350px; background: var(--panel); border: 1px solid var(--line-hi); padding: 0 8px 8px; display: grid; gap: 8px; pointer-events: auto; }
  header { position: relative; display: grid; grid-template-columns: auto 1fr auto; grid-template-rows: 26px 26px; align-items: center; column-gap: 8px; margin: 0 -8px; padding: 4px 6px 5px 8px; background: #6a1c25; border-bottom: 1px solid #b8343c; color: #fff; }
  h2 { color: #ffd6d6; margin: 0; font: 600 18px/1 var(--head-font); letter-spacing: 0.06em; text-transform: uppercase; }
  header .pill { justify-self: start; }
  .sub { grid-row: 2; grid-column: 1 / 3; font: 13px var(--head-font); color: #ffb3b3; letter-spacing: 0.04em; white-space: nowrap; }
  .fr { grid-row: 1; grid-column: 3; justify-self: end; }
  .dis { grid-row: 2; grid-column: 3; min-height: 0; min-width: 0; height: 24px; padding: 0 8px; display: inline-flex; align-items: center; gap: 6px; font: 600 13px var(--head-font); letter-spacing: 0.06em; text-transform: uppercase; background: #1c0b10; border-color: #b8343c; color: #ffd6d6; }
  .dis kbd { font: 700 10px/1 var(--head-font); padding: 2px 4px; border: 1px solid currentColor; opacity: 0.8; }
  .dis.ready { background: #0b4f3a; border-color: var(--green); color: #fff; }
  .dis:disabled:not(.ready) { opacity: 0.85; }
  .drv { position: absolute; left: 0; right: 0; bottom: 0; height: 3px; background: #2a0a10; } .drv > i { display: block; height: 100%; background: var(--cyan); } .drv.ready > i { background: var(--green); }
  .pill { font: 600 11px/1 var(--head-font); letter-spacing: 0.06em; text-transform: uppercase; padding: 3px 6px; border: 1px solid currentColor; background: #061020; white-space: nowrap; }
  .pill.red { color: #ff8a8a; } .pill.amber { color: var(--amber); } .pill.green { color: var(--green); } .pill.dim { color: var(--dim); }
  .fr { min-height: 0; min-width: 0; width: 24px; height: 24px; padding: 0; display: grid; place-items: center; background: transparent; border-color: transparent; color: #fff; }
  .grid { display: grid; grid-template-columns: 18px minmax(0, 1fr) 42px; gap: 7px 8px; align-items: center; }
  .ic { color: #ff8a8a; display: grid; place-items: center; }
  b { font: 600 14px var(--head-font); text-align: right; } b.amber { color: var(--amber); } b.red { color: var(--red); }
  .hb { display: block; height: 10px; background: #061020; border: 1px solid #5a2229; } .hb > i { display: block; height: 100%; background: var(--green); } .hb.amber > i { background: var(--amber); } .hb.red > i { background: var(--red); }
  .hb.heat > i { background: linear-gradient(90deg, #1b8fb3, var(--cyan)); } .hb.heat.amber > i { background: linear-gradient(90deg, #1b8fb3, var(--amber)); } .hb.heat.red > i { background: linear-gradient(90deg, var(--amber), var(--red)); }
  .hb.low > i { animation: blink 0.8s infinite alternate; }
  .mid { display: flex; align-items: center; justify-content: space-between; height: 10px; }
  .pips { display: inline-flex; gap: 4px; } .pips i { width: 20px; height: 10px; border: 1px solid var(--cyan); box-sizing: border-box; } .pips i.on { background: var(--cyan); }
  .ev { display: inline-flex; align-items: center; gap: 4px; color: var(--cyan); font: 600 13px var(--head-font); }
  em { font: 12px var(--head-font); color: var(--dim); font-style: normal; }
  .wch :global(.chg) { padding-bottom: 0; } .wch :global(.bar) { height: 10px; }
  @keyframes blink { to { opacity: 0.5; } }
</style>
