<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi, UiCombat, UiPrize, UiShuttles, UiTrade } from './api';
  import PanelHead from './PanelHead.svelte';
  import PrizePanel from './PrizePanel.svelte';
  import ShipMeters from './ShipMeters.svelte';
  import StationInfo from './StationInfo.svelte';
  import TradeList from './TradeList.svelte';
  import Icon, { type IconName } from './Icon.svelte';

  let { api, ship, onBack, onTrade, onStation }: { api: UiApi; ship: number; onBack: () => void; onTrade: (ship: number) => void; onStation: (ship: number) => void } = $props();
  let trade = $state<UiTrade>({ credits: 0, partners: [], deals: [] });
  let prizes = $state<UiPrize[]>([]);
  let combat = $state<UiCombat>({ inCombat: false, player: null, enemies: [] });
  let shuttles = $state<UiShuttles>({ shuttles: [], airlocks: [], targets: [], roster: [], bays: [], regions: [], transfers: [], ferryReady: false });
  onMount(() => {
    const u = [
      api.trade.subscribe((v) => (trade = v)),
      api.prizes.subscribe((v) => (prizes = v)),
      api.combat.subscribe((v) => (combat = v)),
      api.shuttles.subscribe((v) => (shuttles = v)),
    ];
    return () => u.forEach((f) => f());
  });
  const partner = $derived(trade.partners.find((p) => p.id === ship));
  const prize = $derived(prizes.find((p) => p.ship === ship));
  const foe = $derived(combat.enemies.find((e) => e.ship === ship));
  const name = $derived(prize?.name ?? foe?.name ?? partner?.name ?? shuttles.targets.find((t) => t.ship === ship)?.name ?? `Ship ${ship}`);
  const derelict = $derived(shuttles.targets.find((t) => t.ship === ship)?.derelict);
  const icon = $derived<IconName>(derelict ? 'derelict' : prize ? 'prize' : foe ? 'skull' : partner?.station ? 'station' : 'ship');
  const sub = $derived(derelict ? 'Derelict' : prize ? 'prize' : foe ? foe.state : partner ? partner.role || partner.kind : '');
</script>

<div data-testid="grid-panel">
  <PanelHead {icon} title={name} {sub} foe={!!foe && !prize} {onBack} />
  {#if derelict}
    <div class="der" data-testid="derelict-panel">
      <span class="cell" title="Where it came from"><Icon name="ship" size={18} /><b>{derelict.kind || 'unknown'}</b><small>{derelict.cause === 'combat' ? 'combat wreck' : 'old wreck'}</small></span>
      <span class="cell" class:warn={derelict.hull < 0.4} title="Hull integrity"><Icon name="hull" size={18} /><b data-testid="der-hull">{Math.round(derelict.hull * 100)}%</b></span>
      <span class="cell" class:warn={derelict.air !== 'breathable'} title="Air on its decks"><Icon name="o2" size={18} /><b data-testid="der-air">{derelict.air}</b></span>
      <span class="cell" class:warn={derelict.power === 'off'} title="Power"><Icon name="power" size={18} /><b data-testid="der-power">{derelict.power === 'off' ? 'No power' : 'Emergency'}</b></span>
      {#if derelict.jammed}<span class="cell warn wide" title="Jammed doors: select one to force it"><Icon name="door" size={18} /><b>{derelict.jammed} jammed {derelict.jammed === 1 ? 'door' : 'doors'}</b></span>{/if}
    </div>
  {/if}
  {#if foe}<ShipMeters ship={foe} compact />{/if}
  {#if prize}<PrizePanel {api} {ship} />{/if}
  {#if partner && !foe && partner.station}
    {#if partner.info}<StationInfo info={partner.info} />{/if}
    <button class="go" data-testid="open-station" onclick={() => { if (partner.hail === 'none') api.dispatch({ type: 'trade.hail', ship }); onStation(ship); }}>Hail station</button>
  {:else if partner && !foe}<TradeList {api} {ship} onOpen={onTrade} />{/if}
  {#if !foe && !prize && !partner && !derelict}<p class="dim">Nothing to do here.</p>{/if}
  {#if foe && !prize}<button class="fight" data-testid="grid-focus-fight" onclick={() => api.focusFight(ship)}>Frame fight</button>{/if}
</div>

<style>
  .dim { color: var(--dim); margin: 4px 0; }
  .der { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }
  .cell { display: flex; align-items: center; gap: 6px; padding: 6px 8px; background: var(--panel-2); border: 1px solid var(--line); color: var(--ink-accent); min-height: 20px; }
  .cell b { color: var(--text); font-weight: 600; }
  .cell small { color: var(--dim); font-size: 11px; }
  .cell.warn { border-color: var(--amber); color: var(--amber); }
  .cell.wide { grid-column: 1 / -1; }
  .fight { margin-top: 8px; width: 100%; }
  .go { width: 100%; background: var(--act-fill); border-color: var(--act-edge); }
</style>
