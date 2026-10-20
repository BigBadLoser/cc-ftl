<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi, UiCombat, UiCrew, UiModule, UiStats, UiStock } from './api';
  import Icon from './Icon.svelte';
  import PanelHead from './PanelHead.svelte';
  import ShipMeters from './ShipMeters.svelte';

  let { api, stockOpen, onStock, onClose }: { api: UiApi; stockOpen: boolean; onStock: () => void; onClose: () => void } = $props();
  let st = $state<UiStats>({ supply: 0, demand: 0, o2: null });
  let stock = $state<UiStock[]>([]);
  let credits = $state(0);
  let crew = $state<UiCrew[]>([]);
  let mods = $state<UiModule[]>([]);
  let combat = $state<UiCombat>({ inCombat: false, player: null, enemies: [] });
  onMount(() => {
    const u = [
      api.stats.subscribe((s) => (st = s)),
      api.stock.subscribe((v) => (stock = v)),
      api.trade.subscribe((v) => (credits = v.credits)),
      api.crew.subscribe((v) => (crew = v)),
      api.modules.subscribe((v) => (mods = v)),
      api.combat.subscribe((v) => (combat = v)),
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
    <span class="cell" class:bad={short} title="Power supply / demand" data-testid="stat-power"><Icon name="power" size={18} /><b>{st.supply}/{st.demand}</b></span>
    <span class="cell" class:bad={o2Low} title="Average O₂ of rooms with crew (kPa)" data-testid="stat-o2"><Icon name="o2" size={18} /><b>{st.o2 === null ? '–' : st.o2.toFixed(1)}</b></span>
    <span class="cell" title="Credits" data-testid="stat-credits"><Icon name="credits" size={18} /><b>{credits}</b></span>
    {#if hasFuel}<span class="cell" class:bad={fuel < 3} title="Fuel" data-testid="stat-fuel"><Icon name="fuel" size={18} /><b>{fuel}</b></span>{/if}
    <button class="cell" class:on={stockOpen} aria-pressed={stockOpen} title="Ship stock" data-testid="stat-stock" onclick={onStock}><Icon name="stock" size={18} /><b>{total}</b></button>
    <span class="cell" title="Crew"><Icon name="person" size={18} /><b>{crew.length}</b></span>
    <span class="cell" class:bad={off.length > 0} title="Modules ({off.length} offline)"><Icon name="module" size={18} /><b>{mods.length - off.length}/{mods.length}</b></span>
  </div>
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
  .meters { margin-top: 8px; padding-top: 6px; border-top: 1px solid var(--line); }
  @media (max-width: 600px) { .over { bottom: auto; left: 8px; right: calc(46px + var(--sar)); width: auto; border-width: 1px; padding: 10px; } }
</style>
