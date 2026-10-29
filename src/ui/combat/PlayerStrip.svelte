<script lang="ts">
  import type { UiAiming, UiApi, UiCombat } from '../api';
  import Icon from '../Icon.svelte';
  import { hullTone } from './hullTone';
  import FleeButton from './FleeButton.svelte';
  import HeatGauge from './HeatGauge.svelte';

  type Me = NonNullable<UiCombat['player']>;
  let { api, me, flee, drive, aiming, rate, onSelect, onVent, onOvercharge }: {
    api: UiApi; me: Me; flee: () => void; drive: { charge: number; max: number; helmManned: boolean; active: boolean } | null; aiming: UiAiming | null; rate: number; onSelect: (id: number) => void;
    onVent: () => void; onOvercharge: (k: 'weapons' | 'shields' | 'engines') => void;
  } = $props();

  const ROMAN = ['I', 'II', 'III', 'IV'];
  const nameOf = (i: number) => {
    const w = me.weapons[i]!;
    const same = me.weapons.filter((o) => o.name === w.name);
    return same.length > 1 ? `${w.name} ${ROMAN[same.indexOf(w)] ?? i + 1}` : w.name;
  };
  const ready = $derived(me.weapons.some((w) => w.charge >= 1 && w.powered && !w.ion));
  const hull = $derived(Math.round(me.integrity * 100));
  const lock = $derived(me.heat.lockout);
  const volley = () => api.dispatch({ type: 'combat.fireVolley', ship: me.ship });
  const hold = () => api.dispatch({ type: 'combat.setHold', ship: me.ship, hold: !me.hold });

  /** Stations: weapons, shields and helm are manned and powered consoles; ENG is online when at least one engine module is powered and intact (engines have no console). Tips say what an empty station costs (see weaponCharge, shields and helm systems). */
  const stations = $derived.by(() => {
    const live = (kind: 'weapons' | 'shields' | 'helm', tag: string, label: string, bad: string) => {
      const c = me.consoles.find((x) => x.kind === kind);
      const ok = !!c && c.powered && c.operator !== null;
      return { tag, label, ok, status: ok ? 'MANNED' : 'UNMANNED', tip: ok ? `${label} manned by ${c.operator}` : !c ? `${label}: no console installed. ${bad}` : !c.powered ? `${label} console unpowered. ${bad}` : bad };
    };
    const engines = me.modules.filter((m) => m.kind === 'engine');
    const online = engines.some((m) => m.powered && m.hp > 0);
    return [live('weapons', 'WPN', 'Weapons', "Weapons console unmanned: weapons won't charge"), live('shields', 'SHD', 'Shields', "Shield console unmanned: shields regenerate slower"), live('helm', 'HELM', 'Helm', "Helm unmanned: no evasion, FTL won't charge"),
      { tag: 'ENG', label: 'Engines', ok: online, status: online ? 'ONLINE' : 'OFFLINE', tip: online ? 'Engines online' : engines.length === 0 ? 'No engines installed: no evasion' : 'Engines offline (unpowered or destroyed): no evasion' }];
  });
</script>

<div class="dock">
<div class="strip" data-testid="combat-strip">
  <section class="sec def" style="grid-column:1; grid-row:1"><h3>Status</h3>
    <div class="line" title="Hull integrity"><span class="lbl">Hull</span><span class="hb {hullTone(hull)}"><i style="width:{hull}%"></i></span><b>{hull}%</b></div>
    <div class="line" title="Shield layers"><span class="lbl">Shields</span><span class="pips">{#each Array.from({ length: me.shield.max }, (_, i) => i) as i (i)}<i class:on={i < me.shield.layers}></i>{:else}<em>none</em>{/each}</span><b>{me.shield.layers}/{me.shield.max}</b></div>
    <div class="line" title="Chance an incoming shot misses"><span class="lbl">Evasion</span><b>{Math.round(me.evasion * 100)}%</b></div>
  </section>
  <section class="sec" style="grid-column:1; grid-row:2"><h3>Stations</h3>
    <div class="stn">
      {#each stations as s (s.label)}
        <span class="s" class:ok={s.ok} title={s.tip}><b>{s.tag}</b><em>{s.status}</em></span>
      {/each}
    </div>
  </section>

  <section class="sec" style="grid-column:2 / 6; grid-row:1"><h3>Weapons</h3>
    <div class="cards">
      {#each [0, 1, 2, 3] as i (i)}
        {@const w = me.weapons[i]}
        {#if w}
          {@const sel = aiming?.weapon === w.id}
          {@const own = w.target !== null}
          <button class="wc" class:sel class:off={!w.powered} aria-pressed={sel} data-testid="combat-weapon"
            title={sel ? 'Click an enemy module in the world to aim this weapon (Esc cancels)' : 'Select, then click an enemy module to aim'} onclick={() => onSelect(w.id)}>
            <span class="top"><kbd>{'QWER'[i]}</kbd><span class="nm">{nameOf(i)}</span>{#if w.ammo !== null}<span class="am">x{w.ammo}</span>{/if}</span>
            <span class="chg" class:full={w.charge >= 1}><i style="width:{Math.round(w.charge * 100)}%"></i></span>
            <span class="tg" class:own><Icon name="target" size={12} /><span>{sel ? 'click a module...' : own ? w.target : 'Auto'}</span></span>
          </button>
        {:else}
          <span class="wc empty">{i === 0 ? 'No weapons' : ''}</span>
        {/if}
      {/each}
    </div>
  </section>
  <section class="sec" style="grid-column:2 / 6; grid-row:2"><h3>Actions</h3>
    <div class="cards acts">
      <button class="act go" style="grid-column:1 / 3" disabled={!ready} title="Fire every charged weapon now (V)" data-testid="combat-volley" onclick={volley}><Icon name="volley" size={18} />Volley<kbd>V</kbd></button>
      <button class="act" style="grid-column:3 / 5" class:on={me.hold} title="Hold fire: weapons charge but do not fire (H)" data-testid="combat-hold" onclick={hold}><Icon name="hold" size={18} />Hold fire<kbd>H</kbd></button>
    </div>
  </section>

  <HeatGauge heat={me.heat} {rate} {onVent} {onOvercharge} />

  {#if lock > 0}
    <div class="lock" role="alert" data-testid="thermal-overload">
      <b>Thermal overload</b>
      <span>Systems online in {lock.toFixed(1)} s</span>
    </div>
  {/if}
</div>
{#if drive}<FleeButton {drive} onFlee={flee} />{/if}
</div>

<style>
  /* One grid: column 1 defence/stations, columns 2-5 the weapon slots (cards and the action row share them), column 6 heat. Row 1 cards, row 2 actions. Gutters are all 8px. */
  .strip { position: relative; display: grid; grid-template-columns: 264px repeat(4, minmax(0, 1fr)) minmax(0, 300px); grid-template-rows: auto auto; gap: 12px 8px; background: var(--panel); border: 1px solid var(--line-hi); padding: 8px; flex: 1; min-width: 0; pointer-events: auto; }
  /* The strip and its docked Flee tab (FleeButton) side by side: the tab shares the strip's right border. */
  .dock { display: flex; align-items: stretch; width: min(1320px, calc(100vw - 24px)); pointer-events: auto; }
  /* A framed section: a thin low-contrast border with its title set into the top line (like a fieldset legend). Shared with the heat block (HeatGauge.svelte). */
  .sec { position: relative; box-sizing: border-box; min-width: 0; min-height: 0; padding: 12px 8px 8px; border: 1px solid rgba(90, 140, 175, 0.38); }
  .sec > h3 { position: absolute; top: -6px; left: 9px; margin: 0; padding: 0 5px; background: var(--panel); font: 600 12px/12px var(--head-font); letter-spacing: 0.08em; text-transform: uppercase; color: var(--dim); }
  .def { display: grid; align-content: space-between; }
  .cards { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; grid-template-rows: 66px; }
  .cards.acts { grid-template-rows: 42px; }
  .line { display: flex; align-items: center; gap: 8px; color: var(--cyan); height: 20px; }
  .line b { font: 600 14px var(--head-font); color: var(--text); min-width: 34px; text-align: right; }
  .lbl { flex: none; width: 58px; font: 600 12px var(--head-font); letter-spacing: 0.08em; text-transform: uppercase; color: var(--dim); }
  .hb { flex: 1; height: 10px; background: #061020; border: 1px solid var(--line); } .hb > i { display: block; height: 100%; background: var(--green); }
  .hb.amber > i { background: var(--amber); } .hb.red > i { background: var(--red); }
  .pips { flex: 1; display: inline-flex; gap: 4px; } .pips i { width: 20px; height: 10px; border: 1px solid var(--cyan); } .pips i.on { background: var(--cyan); }
  em { font: 12px var(--head-font); color: var(--dim); font-style: normal; }
  /* Stations: flat tags with a name, a one-word status and a coloured bottom edge, not buttons. */
  .stn { display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px; height: 42px; }
  .s { display: grid; align-content: center; justify-items: center; gap: 3px; font-family: var(--head-font); color: var(--red); background: #2a0f14; border-bottom: 2px solid var(--red); }
  .s b { font: 700 12px/1 var(--head-font); letter-spacing: 0.06em; }
  .s em { font: 600 9.5px/1 var(--head-font); letter-spacing: 0; color: inherit; opacity: 0.85; }
  .s.ok { color: var(--cyan); background: #0a2233; border-bottom-color: var(--cyan); }
  .wc { min-height: 0; min-width: 0; padding: 6px 8px; display: grid; grid-template-rows: 30px 1fr 14px; gap: 5px; text-align: left; background: var(--panel-2); }
  .wc.empty { border: 1px dashed var(--line); background: transparent; display: grid; place-items: center; color: var(--dim); font-size: 12px; }
  .wc.sel { border-color: var(--cyan); background: var(--panel-3); box-shadow: inset 0 0 0 1px var(--cyan), 0 0 10px rgba(54, 212, 255, 0.35); }
  .wc.off { opacity: 0.55; }
  .top { display: flex; align-items: center; gap: 6px; min-width: 0; }
  .nm { flex: 1; min-width: 0; font: 600 14px/1.05 var(--head-font); letter-spacing: 0.03em; }
  .am { font-size: 11px; color: var(--dim); }
  kbd { font: 700 11px/1 var(--head-font); padding: 2px 5px; border: 1px solid var(--line-hi); color: var(--cyan); background: #061020; }
  .chg { display: block; background: #061020; border: 1px solid var(--line); } .chg > i { display: block; height: 100%; background: var(--amber); }
  .chg.full > i { background: var(--green); }
  .tg { display: flex; align-items: center; gap: 4px; font-size: 11px; color: var(--dim); min-width: 0; } .tg span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .tg.own, .wc.sel .tg { color: var(--cyan); }
  .act { height: 42px; min-height: 0; min-width: 0; display: inline-flex; align-items: center; justify-content: center; gap: 8px; font: 600 15px var(--head-font); letter-spacing: 0.05em; text-transform: uppercase; white-space: nowrap; }
  .act kbd { font-size: 10px; color: var(--dim); }
  .go:not(:disabled) { background: #0e6a80; border-color: var(--cyan); color: #fff; }
  /* Thermal overload: covers the whole strip and blocks it. */
  .lock { position: absolute; inset: 0; z-index: 2; display: grid; place-content: center; justify-items: center; gap: 6px; background: rgba(4, 8, 14, 0.93); box-shadow: inset 0 0 0 2px var(--red), inset 0 0 36px rgba(255, 90, 90, 0.35); animation: lk 1.1s infinite alternate; }
  .lock b { font: 700 30px/1 var(--head-font); letter-spacing: 0.16em; text-transform: uppercase; color: var(--red); }
  .lock span { font: 600 16px var(--head-font); letter-spacing: 0.06em; color: var(--text); }
  @keyframes lk { to { box-shadow: inset 0 0 0 2px var(--red), inset 0 0 18px rgba(255, 90, 90, 0.15); } }
</style>
