<script lang="ts">
  import type { UiAiming, UiApi, UiCombat } from '../api';
  import Icon, { type IconName } from '../Icon.svelte';
  import HeatGauge from './HeatGauge.svelte';

  type Me = NonNullable<UiCombat['player']>;
  let { api, me, targetLabel, aiming, helmManned, onSelect, onFlee, heat, oc, ocLeft, onVent, onOvercharge, onFrame }: {
    api: UiApi; me: Me; targetLabel: string; aiming: UiAiming | null; helmManned: boolean; onSelect: (id: number) => void; onFlee: () => void;
    heat: number; oc: 'weapons' | 'shields' | 'engines' | null; ocLeft: number; onVent: () => void; onOvercharge: (k: 'weapons' | 'shields' | 'engines') => void; onFrame: () => void;
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
  const volley = () => api.dispatch({ type: 'combat.fireVolley', ship: me.ship });
  const hold = () => api.dispatch({ type: 'combat.setHold', ship: me.ship, hold: !me.hold });

  /** Stations: weapons, shields and helm are live (console manned and powered); engines/coolant has no sim yet (MOCK: always manned). */
  const stations = $derived.by(() => {
    const live = (kind: 'weapons' | 'shields' | 'helm', icon: IconName, label: string) => {
      const c = me.consoles.find((x) => x.kind === kind);
      return { icon, label, ok: !!c && c.powered && c.operator !== null, who: c?.operator ?? null };
    };
    return [live('weapons', 'target', 'Weapons'), live('shields', 'shield', 'Shields'), live('helm', 'helm', 'Helm'), { icon: 'bolt' as IconName, label: 'Engines', ok: true, who: 'mock' }];
  });
</script>

<div class="strip" data-testid="combat-strip">
  <div class="def">
    <div class="line" title="Hull integrity"><Icon name="hull" size={16} /><span class="hb" class:low={hull < 35}><i style="width:{hull}%"></i></span><b>{hull}%</b></div>
    <div class="line" title="Shield layers"><Icon name="shield" size={16} /><span class="pips">{#each Array.from({ length: me.shield.max }, (_, i) => i) as i (i)}<i class:on={i < me.shield.layers}></i>{:else}<em>none</em>{/each}</span><b>{me.shield.layers}/{me.shield.max}</b></div>
    <div class="line" title="Chance an incoming shot misses"><Icon name="evasion" size={16} /><span class="lbl">Evasion</span><b>{Math.round(me.evasion * 100)}%</b></div>
    <div class="stn">
      {#each stations as s (s.label)}
        <span class="s" class:ok={s.ok} title="{s.label}: {s.ok ? `manned${s.who && s.who !== 'mock' ? ' by ' + s.who : ''}` : 'unmanned'}"><Icon name={s.icon} size={20} /></span>
      {/each}
    </div>
  </div>

  <div class="mid">
    <div class="wl">
      {#each me.weapons as w, i (w.id)}
        {@const sel = aiming?.weapon === w.id}
        {@const own = w.target !== null}
        <button class="wc" class:sel class:off={!w.powered} class:ready={w.charge >= 1} aria-pressed={sel} data-testid="combat-weapon"
          title={sel ? 'Click an enemy module in the world to aim this weapon (Esc cancels)' : 'Select, then click an enemy module to aim'} onclick={() => onSelect(w.id)}>
          <span class="top"><kbd>{i + 1}</kbd><span class="nm">{nameOf(i)}</span>{#if w.ammo !== null}<span class="am">x{w.ammo}</span>{/if}</span>
          <span class="chg" class:full={w.charge >= 1}><i style="width:{Math.round(w.charge * 100)}%"></i></span>
          <span class="tg" class:own><Icon name="target" size={12} />{sel ? 'click a module...' : own ? w.target : targetLabel}</span>
        </button>
      {/each}
      {#if me.weapons.length === 0}<p class="none">No weapons installed.</p>{/if}
    </div>
    <div class="acts">
      <button class="go" disabled={!ready} title="Fire every charged weapon now (V)" data-testid="combat-volley" onclick={volley}><Icon name="volley" size={20} />Volley<kbd>V</kbd></button>
      <button class:on={me.hold} title="Hold fire: weapons charge but do not fire (H)" data-testid="combat-hold" onclick={hold}><Icon name="hold" size={20} />Hold fire<kbd>H</kbd></button>
      <button class="fl" class:ready={flee} disabled={!flee} title={helmManned ? 'Flee when the drive is charged (F)' : 'Helm unmanned: the drive is not charging'} data-testid="combat-flee" onclick={onFlee}>
        <span class="fh"><Icon name="fast" size={20} />Flee<kbd>F</kbd></span>
        <span class="fb"><i style="width:{Math.min(100, Math.round((me.ftl / me.ftlMax) * 100))}%"></i></span>
      </button>
      <button class="tile" title="Re-frame the camera on both ships" aria-label="Frame both ships" onclick={onFrame}><Icon name="frame" size={20} /></button>
    </div>
    <div class="why">{me.idle ?? ''}</div>
  </div>

  <HeatGauge {heat} active={oc} left={ocLeft} {onVent} {onOvercharge} />
</div>

<style>
  .strip { display: grid; grid-template-columns: 200px minmax(0, 1fr) 270px; gap: 14px; align-items: stretch; background: var(--panel); border: 1px solid var(--line-hi); padding: 10px 12px; width: min(1160px, calc(100vw - 24px)); pointer-events: auto; }
  .def { display: grid; gap: 8px; align-content: start; }
  .line { display: flex; align-items: center; gap: 8px; color: var(--cyan); }
  .line b { font: 600 15px var(--head-font); color: var(--text); min-width: 34px; text-align: right; }
  .lbl { flex: 1; font: 600 12px var(--head-font); letter-spacing: 0.08em; text-transform: uppercase; color: var(--dim); }
  .hb { flex: 1; height: 12px; background: #061020; border: 1px solid var(--line); } .hb > i { display: block; height: 100%; background: var(--green); }
  .hb.low > i { background: var(--red); }
  .pips { flex: 1; display: inline-flex; gap: 4px; } .pips i { width: 22px; height: 12px; border: 1px solid var(--cyan); } .pips i.on { background: var(--cyan); box-shadow: 0 0 6px var(--cyan); }
  em { font: 12px var(--head-font); color: var(--dim); }
  .stn { display: flex; gap: 6px; margin-top: 2px; }
  .s { flex: 1; height: 36px; display: grid; place-items: center; border: 1px solid var(--red); color: var(--red); background: #2a0f14; }
  .s.ok { border-color: var(--cyan); color: var(--cyan); background: #0a2a3c; }
  .mid { display: grid; gap: 8px; align-content: start; min-width: 0; }
  .wl { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; }
  .wc { min-height: 0; height: 78px; padding: 6px 8px; display: grid; grid-template-rows: auto 18px auto; gap: 4px; text-align: left; background: var(--panel-2); }
  .wc.sel { border-color: var(--cyan); background: var(--panel-3); box-shadow: inset 0 0 0 1px var(--cyan), 0 0 10px rgba(54, 212, 255, 0.35); }
  .wc.off { opacity: 0.55; }
  .top { display: flex; align-items: center; gap: 6px; min-width: 0; }
  .nm { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 600 15px/1.1 var(--head-font); letter-spacing: 0.03em; }
  .am { font-size: 11px; color: var(--dim); }
  kbd { font: 700 11px/1 var(--head-font); padding: 3px 5px; border: 1px solid var(--line-hi); color: var(--cyan); background: #061020; }
  .chg { display: block; background: #061020; border: 1px solid var(--line); } .chg > i { display: block; height: 100%; background: var(--amber); }
  .chg.full > i { background: var(--green); }
  .tg { display: flex; align-items: center; gap: 4px; font-size: 11px; color: var(--dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tg.own, .wc.sel .tg { color: var(--cyan); }
  .acts { display: flex; gap: 6px; }
  .acts > button { min-height: 0; height: 44px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; font: 600 16px var(--head-font); letter-spacing: 0.06em; text-transform: uppercase; flex: 1; }
  .acts > button.tile { flex: none; width: 44px; }
  .acts kbd { font-size: 10px; color: var(--dim); }
  .go:not(:disabled) { background: #0e6a80; border-color: var(--cyan); color: #fff; }
  .fl { flex-direction: column; gap: 4px !important; padding: 0 10px; }
  .fh { display: inline-flex; align-items: center; gap: 8px; }
  .fb { display: block; width: 100%; height: 5px; background: #061020; } .fb > i { display: block; height: 100%; background: var(--cyan); }
  .fl.ready { border-color: var(--green); background: #0b4f3a; color: #fff; } .fl.ready .fb > i { background: var(--green); }
  .fl:disabled { opacity: 0.75; }
  .why { min-height: 15px; font: 600 12px var(--head-font); letter-spacing: 0.04em; color: var(--amber); }
  .none { margin: 0; color: var(--dim); }
</style>
