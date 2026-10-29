<script lang="ts">
  import type { UiAiming, UiApi, UiCombat } from '../api';
  import ActionButtons from './ActionButtons.svelte';
  import FleeButton from './FleeButton.svelte';
  import HeatGauge from './HeatGauge.svelte';
  import OverchargeButtons from './OverchargeButtons.svelte';
  import StationTags from './StationTags.svelte';
  import StatusBlock from './StatusBlock.svelte';
  import WeaponBay from './WeaponBay.svelte';

  type Me = NonNullable<UiCombat['player']>;
  type Drive = { charge: number; max: number; helmManned: boolean; active: boolean };
  /** The player's strip along the bottom: it only lays out its sections (see the components it uses) and the thermal-overload cover. */
  let { api, me, flee, drive, aiming, rate, onSelect, onVent, onOvercharge }: {
    api: UiApi;
    me: Me;
    flee: () => void;
    drive: Drive | null;
    aiming: UiAiming | null;
    rate: number;
    onSelect: (id: number) => void;
    onVent: () => void;
    onOvercharge: (k: 'weapons' | 'shields' | 'engines') => void;
  } = $props();

  const canVolley = $derived(me.weapons.some((w) => w.charge >= 1 && w.powered && !w.ion));
  const lock = $derived(me.heat.lockout);
  const volley = () => api.dispatch({ type: 'combat.fireVolley', ship: me.ship });
  const hold = () => api.dispatch({ type: 'combat.setHold', ship: me.ship, hold: !me.hold });
</script>

<div class="dock">
  <div class="strip" data-testid="combat-strip">
    <StatusBlock {me} style="grid-column:1; grid-row:1" />
    <StationTags {me} style="grid-column:1; grid-row:2" />
    <WeaponBay {me} {aiming} {onSelect} style="grid-column:2 / 6; grid-row:1" />
    <ActionButtons canVolley={canVolley} holding={me.hold} onVolley={volley} onHold={hold} style="grid-column:2 / 6; grid-row:2" />
    <HeatGauge heat={me.heat} {rate} {onVent} style="grid-column:6; grid-row:1" />
    <OverchargeButtons heat={me.heat} {onOvercharge} style="grid-column:6; grid-row:2" />

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
  /* One grid: column 1 status and stations, columns 2-5 the weapon slots (cards and the action row share them), column 6 heat. */
  .strip {
    position: relative;
    display: grid;
    grid-template-columns: 264px repeat(4, minmax(0, 1fr)) minmax(0, 300px);
    grid-template-rows: auto auto;
    gap: var(--sp-3) var(--gutter);
    background: var(--panel);
    border: 1px solid var(--line-hi);
    padding: var(--sp-2);
    flex: 1;
    min-width: 0;
    pointer-events: auto;
  }
  /* The strip and its docked Flee tab (FleeButton) side by side: the tab shares the strip's right border. */
  .dock {
    display: flex;
    align-items: stretch;
    width: min(1320px, calc(100vw - 24px));
    pointer-events: auto;
  }
  /* Thermal overload: covers the whole strip and blocks it. */
  .lock {
    position: absolute;
    inset: 0;
    z-index: 2;
    display: grid;
    place-content: center;
    justify-items: center;
    gap: 6px;
    background: rgba(4, 8, 14, 0.93);
    box-shadow: inset 0 0 0 2px var(--red), inset 0 0 36px rgba(255, 90, 90, 0.35);
    animation: lk 1.1s infinite alternate;
  }
  .lock b {
    font: 700 30px/1 var(--head-font);
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--red);
  }
  .lock span {
    font: 600 16px var(--head-font);
    letter-spacing: 0.06em;
    color: var(--text);
  }
  @keyframes lk {
    to { box-shadow: inset 0 0 0 2px var(--red), inset 0 0 18px rgba(255, 90, 90, 0.15); }
  }
</style>
