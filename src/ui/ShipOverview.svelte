<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi, UiCombat, UiCrew, UiFtl, UiModule, UiStats, UiStock } from './api';
  import FloatingWindow from './FloatingWindow.svelte';
  import FtlCharge from './FtlCharge.svelte';
  import Icon from './Icon.svelte';
  import PanelHead from './PanelHead.svelte';
  import { Tooltip } from './kit';
  import ShipMeters from './ShipMeters.svelte';

  let { api, stockOpen, onStock, onClose }: { api: UiApi; stockOpen: boolean; onStock: () => void; onClose: () => void } = $props();
  let st = $state<UiStats>({ supply: 0, demand: 0, food: { units: 0, eaters: 0, perHour: 0, hours: null }, heat: { notoriety: 0, wanted: false, wantedAt: 10, hunters: [], clearCost: 0, clearBlocker: null }, o2: null, hull: { tiles: 0, capacity: 0 } });
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
  /** Crew food: hours left at the current rate; amber under an hour, red under 15 minutes or with none. */
  const foodLevel = $derived(st.food.units === 0 && st.food.eaters > 0 ? 'out' : st.food.hours !== null && st.food.hours < 0.25 ? 'out' : st.food.hours !== null && st.food.hours < 1 ? 'low' : 'ok');
  const foodTime = $derived(st.food.hours === null ? '–' : st.food.hours >= 1 ? `~${st.food.hours.toFixed(1)} h` : `~${Math.max(1, Math.round(st.food.hours * 60))} min`);
  const short = $derived(st.demand > st.supply);
  const heavy = $derived(st.hull.capacity > 0 && st.hull.tiles > st.hull.capacity);
  const o2Low = $derived(st.o2 !== null && st.o2 < 16);
  const off = $derived(mods.filter((m) => !m.enabled || m.hp <= 0 || (!m.powered && m.power < 0)));
</script>

<FloatingWindow id="overview" title="Ship overview" min={{ w: 260, h: 140 }} defaultRect={(b) => ({ x: b.left, y: b.top, w: 300, h: 0 })} {onClose} testId="ship-overview" bare pinRight={32} padded>
  <PanelHead icon="hull" title="Ship overview" />
  <button class="tile close" title="Close" aria-label="Close overview" data-testid="overview-close" onclick={onClose}><Icon name="close" size={16} /></button>
  <div class="res" data-testid="stats">
    <Tooltip text="Power supply / demand"><span class="cell" class:bad={short} data-testid="stat-power"><Icon name="power" size={18} /><b>{st.supply}/{st.demand}</b></span></Tooltip>
    <Tooltip text="Average O₂ of rooms with crew (kPa)"><span class="cell" class:bad={o2Low} data-testid="stat-o2"><Icon name="o2" size={18} /><b>{st.o2 === null ? '–' : st.o2.toFixed(1)}</b></span></Tooltip>
    <Tooltip text={heavy ? 'Ship size over what the engines carry: jumping needs an overcharge' : 'Ship size (tiles inside the outer hull) / what the engines carry'}><span class="cell wide" class:bad={heavy} data-testid="stat-hull"><span class="lab">Size</span><b>{st.hull.tiles} / {st.hull.capacity}</b></span></Tooltip>
    <Tooltip text="Credits"><span class="cell" data-testid="stat-credits"><Icon name="credits" size={18} /><b>{credits}</b></span></Tooltip>
    {#if hasFuel}<Tooltip text="Fuel"><span class="cell" class:bad={fuel < 3} data-testid="stat-fuel"><Icon name="fuel" size={18} /><b>{fuel}</b></span></Tooltip>{/if}
    <button class="cell" class:on={stockOpen} aria-pressed={stockOpen} title="Ship stock" data-testid="stat-stock" onclick={onStock}><Icon name="stock" size={18} /><b>{total}</b></button>
    <Tooltip text="Crew"><span class="cell"><Icon name="person" size={18} /><b>{crew.length}</b></span></Tooltip>
    <Tooltip text="Modules ({off.length} offline)"><span class="cell" class:bad={off.length > 0}><Icon name="module" size={18} /><b>{mods.length - off.length}/{mods.length}</b></span></Tooltip>
  </div>
  {#if st.food.eaters > 0}
    <div class="food" class:low={foodLevel === 'low'} class:out={foodLevel === 'out'} data-testid="stat-food" data-level={foodLevel}>
      <span class="ft">Crew food <b>{st.food.units} rations</b></span>
      <span class="fs">Eating {st.food.perHour}/h for {st.food.eaters} crew: food for <b>{foodTime}</b></span>
    </div>
  {/if}
  {#if st.heat.notoriety > 0 || st.heat.hunters.length}
    <div class="food heat" class:low={!st.heat.wanted} class:out={st.heat.wanted} data-testid="stat-heat" data-wanted={st.heat.wanted}>
      <span class="ft">Notoriety <b>{st.heat.notoriety}</b>{#if st.heat.wanted}&nbsp;· <b>wanted by the law</b>{:else} <span class="fs">(wanted from {st.heat.wantedAt})</span>{/if}</span>
      {#if st.heat.hunters.length}<span class="fs">Hunted by <b>{st.heat.hunters.join(', ')}</b></span>{/if}
      {#if st.heat.clearBlocker === null || st.heat.clearBlocker === 'cantAfford'}
        <button class="pay" data-testid="heat-clear" disabled={st.heat.clearBlocker !== null} onclick={() => api.dispatch({ type: 'galaxy.clearNotoriety' })}>Pay the den to clear it ({st.heat.clearCost} cr)</button>
      {/if}
    </div>
  {/if}
  {#if ftl}<div class="drive"><FtlCharge {ftl} testid="overview-ftl" onCharge={() => api.dispatch({ type: 'ftl.charge', ship: ftl!.ship })} onCancel={() => api.dispatch({ type: 'ftl.cancelCharge', ship: ftl!.ship })} /></div>{/if}
  {#if combat.player}<div class="meters"><ShipMeters ship={combat.player} compact /></div>{/if}
</FloatingWindow>

<style>
  .close { position: absolute; top: 0; right: 0; width: 32px; height: 32px; border-width: 0 0 0 1px; background: #0a3a52; color: #fff; }
  .res { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }
  .cell { display: flex; align-items: center; gap: 8px; padding: 6px 8px; min-height: 20px; background: var(--panel-2); border: 1px solid var(--line); color: var(--cyan); font: inherit; text-align: left; }
  .cell b { color: var(--text); font-weight: 600; }
  button.cell { cursor: pointer; } button.cell.on { border-color: var(--cyan); background: var(--panel-3); }
  .cell .lab { color: var(--dim); } .cell.wide b { white-space: nowrap; }
  .cell.bad { border-color: var(--red); color: var(--red); }
  .food { display: grid; gap: 2px; margin-top: 4px; padding: 6px 8px; background: var(--panel-2); border: 1px solid var(--line); font-size: 13px; }
  .food b { color: var(--text); font-weight: 600; }
  .food .fs { color: var(--dim); font-size: 12px; }
  .food.low { border-color: #ffb43c; } .food.low b { color: #ffb43c; }
  .food.out { border-color: var(--red); } .food.out b { color: var(--red); }
  .heat .pay { margin-top: 4px; padding: 6px 8px; background: var(--panel-3); border: 1px solid var(--line); color: var(--text); font: inherit; cursor: pointer; }
  .heat .pay:disabled { color: var(--dim); cursor: default; }
  .drive { margin-top: 8px; padding-top: 6px; border-top: 1px solid var(--line); }
  .meters { margin-top: 8px; padding-top: 6px; border-top: 1px solid var(--line); }
</style>
