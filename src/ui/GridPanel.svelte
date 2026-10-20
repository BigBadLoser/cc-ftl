<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi, UiCombat, UiPrize, UiShuttles, UiTrade } from './api';
  import PanelHead from './PanelHead.svelte';
  import PrizePanel from './PrizePanel.svelte';
  import ShipMeters from './ShipMeters.svelte';
  import TradeList from './TradeList.svelte';
  import type { IconName } from './Icon.svelte';

  let { api, gridId, onBack, onTrade }: { api: UiApi; gridId: number; onBack: () => void; onTrade: (ship: number) => void } = $props();
  let trade = $state<UiTrade>({ credits: 0, partners: [], deals: [] });
  let prizes = $state<UiPrize[]>([]);
  let combat = $state<UiCombat>({ inCombat: false, player: null, enemies: [] });
  let shuttles = $state<UiShuttles>({ shuttles: [], airlocks: [], targets: [], roster: [], bays: [] });
  onMount(() => {
    const u = [
      api.trade.subscribe((v) => (trade = v)),
      api.prizes.subscribe((v) => (prizes = v)),
      api.combat.subscribe((v) => (combat = v)),
      api.shuttles.subscribe((v) => (shuttles = v)),
    ];
    return () => u.forEach((f) => f());
  });
  const partner = $derived(trade.partners.find((p) => (p.gridId > 0 ? p.gridId : -p.id) === gridId));
  const prize = $derived(prizes.find((p) => p.gridId === gridId));
  const foe = $derived(combat.enemies.find((e) => e.gridId === gridId));
  const name = $derived(prize?.name ?? foe?.name ?? partner?.name ?? shuttles.targets.find((t) => t.gridId === gridId)?.name ?? `Grid ${gridId}`);
  const icon = $derived<IconName>(prize ? 'prize' : foe ? 'skull' : partner?.kind === 'station' ? 'station' : 'ship');
  const sub = $derived(prize ? 'prize' : foe ? foe.state : partner ? partner.role || partner.kind : '');
</script>

<div data-testid="grid-panel">
  <PanelHead {icon} title={name} {sub} foe={!!foe && !prize} {onBack} />
  {#if foe}<ShipMeters ship={foe} compact />{/if}
  {#if prize}<PrizePanel {api} {gridId} />{/if}
  {#if partner && !foe}<TradeList {api} {gridId} onOpen={onTrade} />{/if}
  {#if !foe && !prize && !partner}<p class="dim">Nothing to do here.</p>{/if}
  {#if foe && !prize}<button class="fight" data-testid="grid-focus-fight" onclick={() => api.focusFight(gridId)}>Frame fight</button>{/if}
</div>

<style>
  .dim { color: var(--dim); margin: 4px 0; }
  .fight { margin-top: 8px; width: 100%; }
</style>
