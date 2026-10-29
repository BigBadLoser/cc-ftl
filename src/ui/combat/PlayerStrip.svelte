<script lang="ts">
  import type { UiAiming, UiApi, UiCombat } from '../api';
  import Icon, { type IconName } from '../Icon.svelte';
  import { hullTone } from './hullTone';
  import HeatGauge from './HeatGauge.svelte';

  type Me = NonNullable<UiCombat['player']>;
  let { api, me, aiming, helmManned, rate, onSelect, onFlee, onVent, onOvercharge }: {
    api: UiApi; me: Me; aiming: UiAiming | null; helmManned: boolean; rate: number; onSelect: (id: number) => void; onFlee: () => void;
    onVent: () => void; onOvercharge: (k: 'weapons' | 'shields' | 'engines') => void;
  } = $props();

  const ROMAN = ['I', 'II', 'III', 'IV'];
  const nameOf = (i: number) => {
    const w = me.weapons[i]!;
    const same = me.weapons.filter((o) => o.name === w.name);
    return same.length > 1 ? `${w.name} ${ROMAN[same.indexOf(w)] ?? i + 1}` : w.name;
  };
  const ready = $derived(me.weapons.some((w) => w.charge >= 1 && w.powered && !w.ion));
  const flee = $derived(me.ftl >= me.ftlMax && me.state === 'active');
  const hull = $derived(Math.round(me.integrity * 100));
  const lock = $derived(me.heat.lockout);
  const volley = () => api.dispatch({ type: 'combat.fireVolley', ship: me.ship });
  const hold = () => api.dispatch({ type: 'combat.setHold', ship: me.ship, hold: !me.hold });

  /** Stations: weapons, shields and helm are live (console manned and powered); engines/coolant has no console in the sim yet (MOCK: always manned). */
  const stations = $derived.by(() => {
    const live = (kind: 'weapons' | 'shields' | 'helm', icon: IconName, tag: string, label: string) => {
      const c = me.consoles.find((x) => x.kind === kind);
      return { icon, tag, label, ok: !!c && c.powered && c.operator !== null, who: c?.operator ?? null };
    };
    return [live('weapons', 'target', 'WPN', 'Weapons'), live('shields', 'shield', 'SHD', 'Shields'), live('helm', 'helm', 'HELM', 'Helm'), { icon: 'bolt' as IconName, tag: 'ENG', label: 'Engines', ok: true, who: null }];
  });
</script>

<div class="strip" data-testid="combat-strip">
  <div class="def">
    <div class="line" title="Hull integrity"><Icon name="hull" size={15} /><span class="hb {hullTone(hull)}"><i style="width:{hull}%"></i></span><b>{hull}%</b></div>
    <div class="line" title="Shield layers"><Icon name="shield" size={15} /><span class="pips">{#each Array.from({ length: me.shield.max }, (_, i) => i) as i (i)}<i class:on={i < me.shield.layers}></i>{:else}<em>none</em>{/each}</span><b>{me.shield.layers}/{me.shield.max}</b></div>
    <div class="line" title="Chance an incoming shot misses"><Icon name="evasion" size={15} /><span class="lbl">Evasion</span><b>{Math.round(me.evasion * 100)}%</b></div>
  </div>
  <div class="stn">
    {#each stations as s (s.label)}
      <span class="s" class:ok={s.ok} title="{s.label}: {s.ok ? `manned${s.who ? ' by ' + s.who : ''}` : 'unmanned'}"><Icon name={s.icon} size={14} />{s.tag}</span>
    {/each}
  </div>

  {#each [0, 1, 2, 3] as i (i)}
    {@const w = me.weapons[i]}
    {#if w}
      {@const sel = aiming?.weapon === w.id}
      {@const own = w.target !== null}
      <button class="wc" style="grid-column:{i + 2}" class:sel class:off={!w.powered} aria-pressed={sel} data-testid="combat-weapon"
        title={sel ? 'Click an enemy module in the world to aim this weapon (Esc cancels)' : 'Select, then click an enemy module to aim'} onclick={() => onSelect(w.id)}>
        <span class="top"><kbd>{'QWER'[i]}</kbd><span class="nm">{nameOf(i)}</span>{#if w.ammo !== null}<span class="am">x{w.ammo}</span>{/if}</span>
        <span class="chg" class:full={w.charge >= 1}><i style="width:{Math.round(w.charge * 100)}%"></i></span>
        <span class="tg" class:own><Icon name="target" size={12} /><span>{sel ? 'click a module...' : own ? w.target : 'Auto'}</span></span>
      </button>
    {:else}
      <span class="wc empty" style="grid-column:{i + 2}">{i === 0 ? 'No weapons' : ''}</span>
    {/if}
  {/each}

  <button class="act go" style="grid-column:2 / 4" disabled={!ready} title="Fire every charged weapon now (V)" data-testid="combat-volley" onclick={volley}><Icon name="volley" size={18} />Volley<kbd>V</kbd></button>
  <button class="act" style="grid-column:4" class:on={me.hold} title="Hold fire: weapons charge but do not fire (H)" data-testid="combat-hold" onclick={hold}><Icon name="hold" size={18} />Hold fire<kbd>H</kbd></button>
  <button class="act fl" style="grid-column:5" class:ready={flee} disabled={!flee} title={flee ? 'Flee: the drive is charged (F)' : helmManned ? `Flee: drive charging ${Math.floor(me.ftl)}/${me.ftlMax} s (F)` : 'Helm unmanned: the drive is not charging (F)'} data-testid="combat-flee" onclick={onFlee}>
    <span class="fh"><Icon name="fast" size={16} />Flee<kbd>F</kbd></span>
    <span class="fb"><i style="width:{Math.min(100, Math.round((me.ftl / me.ftlMax) * 100))}%"></i></span>
  </button>

  <HeatGauge heat={me.heat} {rate} {onVent} {onOvercharge} />

  {#if lock > 0}
    <div class="lock" role="alert" data-testid="thermal-overload">
      <b>Thermal overload</b>
      <span>Systems online in {lock.toFixed(1)} s</span>
    </div>
  {/if}
</div>

<style>
  /* One grid: column 1 defence/stations, columns 2-5 the weapon slots (cards and the action row share them), column 6 heat. Row 1 cards, row 2 actions. Gutters are all 8px. */
  .strip { position: relative; display: grid; grid-template-columns: 188px repeat(4, minmax(0, 1fr)) minmax(0, 320px); grid-template-rows: 66px 42px; gap: 8px; background: var(--panel); border: 1px solid var(--line-hi); padding: 8px; width: min(1240px, calc(100vw - 24px)); pointer-events: auto; }
  .def { grid-column: 1; grid-row: 1; display: grid; align-content: space-between; }
  .line { display: flex; align-items: center; gap: 7px; color: var(--cyan); height: 20px; }
  .line b { font: 600 14px var(--head-font); color: var(--text); min-width: 34px; text-align: right; }
  .lbl { flex: 1; font: 600 12px var(--head-font); letter-spacing: 0.08em; text-transform: uppercase; color: var(--dim); }
  .hb { flex: 1; height: 10px; background: #061020; border: 1px solid var(--line); } .hb > i { display: block; height: 100%; background: var(--green); }
  .hb.amber > i { background: var(--amber); } .hb.red > i { background: var(--red); }
  .pips { flex: 1; display: inline-flex; gap: 4px; } .pips i { width: 20px; height: 10px; border: 1px solid var(--cyan); } .pips i.on { background: var(--cyan); }
  em { font: 12px var(--head-font); color: var(--dim); font-style: normal; }
  /* Stations: flat tags with a text label and a coloured left edge, not buttons. */
  .stn { grid-column: 1; grid-row: 2; display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; align-items: center; }
  .s { display: grid; justify-items: center; gap: 2px; padding: 3px 0; font: 700 10px/1 var(--head-font); letter-spacing: 0.06em; color: var(--red); background: #2a0f14; border-bottom: 2px solid var(--red); }
  .s.ok { color: var(--cyan); background: #0a2233; border-bottom-color: var(--cyan); }
  .wc { grid-row: 1; min-height: 0; min-width: 0; padding: 6px 8px; display: grid; grid-template-rows: 18px 1fr 14px; gap: 5px; text-align: left; background: var(--panel-2); }
  .wc.empty { border: 1px dashed var(--line); background: transparent; display: grid; place-items: center; color: var(--dim); font-size: 12px; }
  .wc.sel { border-color: var(--cyan); background: var(--panel-3); box-shadow: inset 0 0 0 1px var(--cyan), 0 0 10px rgba(54, 212, 255, 0.35); }
  .wc.off { opacity: 0.55; }
  .top { display: flex; align-items: center; gap: 6px; min-width: 0; }
  .nm { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 600 15px/1.1 var(--head-font); letter-spacing: 0.03em; }
  .am { font-size: 11px; color: var(--dim); }
  kbd { font: 700 11px/1 var(--head-font); padding: 2px 5px; border: 1px solid var(--line-hi); color: var(--cyan); background: #061020; }
  .chg { display: block; background: #061020; border: 1px solid var(--line); } .chg > i { display: block; height: 100%; background: var(--amber); }
  .chg.full > i { background: var(--green); }
  .tg { display: flex; align-items: center; gap: 4px; font-size: 11px; color: var(--dim); min-width: 0; } .tg span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .tg.own, .wc.sel .tg { color: var(--cyan); }
  .act { grid-row: 2; min-height: 0; min-width: 0; display: inline-flex; align-items: center; justify-content: center; gap: 8px; font: 600 15px var(--head-font); letter-spacing: 0.05em; text-transform: uppercase; white-space: nowrap; }
  .act kbd { font-size: 10px; color: var(--dim); }
  .go:not(:disabled) { background: #0e6a80; border-color: var(--cyan); color: #fff; }
  .fl { position: relative; padding: 0 8px; font-size: 14px; }
  .fh { display: inline-flex; align-items: center; gap: 6px; }
  .fb { position: absolute; left: 0; right: 0; bottom: 0; display: block; height: 3px; background: #061020; } .fb > i { display: block; height: 100%; background: var(--cyan); }
  .fl.ready { border-color: var(--green); background: #0b4f3a; color: #fff; } .fl.ready .fb > i { background: var(--green); }
  .fl:disabled { opacity: 0.8; }
  /* Thermal overload: covers the whole strip and blocks it. */
  .lock { position: absolute; inset: 0; z-index: 2; display: grid; place-content: center; justify-items: center; gap: 6px; background: rgba(4, 8, 14, 0.93); box-shadow: inset 0 0 0 2px var(--red), inset 0 0 36px rgba(255, 90, 90, 0.35); animation: lk 1.1s infinite alternate; }
  .lock b { font: 700 30px/1 var(--head-font); letter-spacing: 0.16em; text-transform: uppercase; color: var(--red); }
  .lock span { font: 600 16px var(--head-font); letter-spacing: 0.06em; color: var(--text); }
  @keyframes lk { to { box-shadow: inset 0 0 0 2px var(--red), inset 0 0 18px rgba(255, 90, 90, 0.15); } }
</style>
