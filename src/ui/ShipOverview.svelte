<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi, UiCombat, UiCrew, UiFtl, UiModule, UiStats, UiStock } from './api';
  import FtlCharge from './FtlCharge.svelte';
  import Icon from './Icon.svelte';
  import PanelHead from './PanelHead.svelte';
  import { Tooltip } from './kit';
  import ShipMeters from './ShipMeters.svelte';

  let { api, stockOpen, onStock, onClose }: { api: UiApi; stockOpen: boolean; onStock: () => void; onClose: () => void } = $props();
  let st = $state<UiStats>({ supply: 0, demand: 0, o2: null });
  let stock = $state<UiStock[]>([]);
  let credits = $state(0);
  let crew = $state<UiCrew[]>([]);
  let mods = $state<UiModule[]>([]);
  let combat = $state<UiCombat>({ inCombat: false, player: null, enemies: [] });
  let ftl = $state<UiFtl | null>(null);
  onMount(() => {
    const u = [
      api.stats.subscribe((s) => (st = s)),
      api.stock.subscribe((v) => (stock = v)),
      api.trade.subscribe((v) => (credits = v.credits)),
      api.crew.subscribe((v) => (crew = v)),
      api.modules.subscribe((v) => (mods = v)),
      api.combat.subscribe((v) => (combat = v)),
      api.ftl.subscribe((v) => (ftl = v)),
    ];
    return () => u.forEach((f) => f());
  });
  const total = $derived(stock.reduce((n, s) => n + s.floor + s.stored, 0));
  const fuel = $derived(stock.filter((s) => s.item === 'item.fuel').reduce((n, s) => n + s.floor + s.stored, 0));
  const hasFuel = $derived(stock.some((s) => s.item === 'item.fuel'));
  const short = $derived(st.demand > st.supply);
  const o2Low = $derived(st.o2 !== null && st.o2 < 16);
  const off = $derived(mods.filter((m) => !m.enabled || m.hp <= 0 || (!m.powered && m.power < 0)));
</script>

<aside class="sheet over" data-testid="ship-overview">
  <PanelHead icon="hull" title="Ship overview" />
  <button class="tile close" title="Close" aria-label="Close overview" data-testid="overview-close" onclick={onClose}><Icon name="close" size={16} /></button>
  <div class="res" data-testid="stats">
    <Tooltip text="Power supply / demand"><span class="cell" class:bad={short} data-testid="stat-power"><Icon name="power" size={18} /><b>{st.supply}/{st.demand}</b></span></Tooltip>
    <Tooltip text="Average O₂ of rooms with crew (kPa)"><span class="cell" class:bad={o2Low} data-testid="stat-o2"><Icon name="o2" size={18} /><b>{st.o2 === null ? '–' : st.o2.toFixed(1)}</b></span></Tooltip>
    <Tooltip text="Credits"><span class="cell" data-testid="stat-credits"><Icon name="credits" size={18} /><b>{credits}</b></span></Tooltip>
    {#if hasFuel}<Tooltip text="Fuel"><span class="cell" class:bad={fuel < 3} data-testid="stat-fuel"><Icon name="fuel" size={18} /><b>{fuel}</b></span></Tooltip>{/if}
    <button class="cell" class:on={stockOpen} aria-pressed={stockOpen} title="Ship stock" data-testid="stat-stock" onclick={onStock}><Icon name="stock" size={18} /><b>{total}</b></button>
    <Tooltip text="Crew"><span class="cell"><Icon name="person" size={18} /><b>{crew.length}</b></span></Tooltip>
    <Tooltip text="Modules ({off.length} offline)"><span class="cell" class:bad={off.length > 0}><Icon name="module" size={18} /><b>{mods.length - off.length}/{mods.length}</b></span></Tooltip>
  </div>
  {#if ftl}<div class="drive"><FtlCharge {ftl} testid="overview-ftl" onCharge={() => api.dispatch({ type: 'ftl.charge', ship: ftl!.ship })} onCancel={() => api.dispatch({ type: 'ftl.cancelCharge', ship: ftl!.ship })} /></div>{/if}
  {#if combat.player}<div class="meters"><ShipMeters ship={combat.player} compact /></div>{/if}
</aside>

<style>
  .over { top: calc(var(--hdr) + var(--sat) + 4px); left: calc(8px + var(--sal)); width: 300px; }
  .close { position: absolute; top: 0; right: 0; width: 32px; height: 32px; border-width: 0 0 0 1px; background: #0a3a52; color: #fff; }
  .res { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }
  .cell { display: flex; align-items: center; gap: 8px; padding: 6px 8px; min-height: 20px; background: var(--panel-2); border: 1px solid var(--line); color: var(--cyan); font: inherit; text-align: left; }
  .cell b { color: var(--text); font-weight: 600; }
  button.cell { cursor: pointer; } button.cell.on { border-color: var(--cyan); background: var(--panel-3); }
  .cell.bad { border-color: var(--red); color: var(--red); }
  .drive { margin-top: 8px; padding-top: 6px; border-top: 1px solid var(--line); }
  .meters { margin-top: 8px; padding-top: 6px; border-top: 1px solid var(--line); }
  @media (max-width: 600px) { :global(html[data-combat]) .over { display: none; } .over { bottom: auto; left: 8px; right: calc(46px + var(--sar)); width: auto; border-width: 1px; padding: 10px; } }
</style>
