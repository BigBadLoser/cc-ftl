<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi, UiCombat, UiPrize, UiShuttles, UiTrade } from './api';
  import Icon, { type IconName } from './Icon.svelte';

  let { api, selected }: { api: UiApi; selected: number | null } = $props();
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

  type Kind = 'hostile' | 'prize' | 'station' | 'ship';
  const icons: Record<Kind, IconName> = { hostile: 'skull', prize: 'prize', station: 'station', ship: 'ship' };
  /** Stations have no grid (gridId 0), so they are keyed by minus their entity id. */
  const key = (p: { id: number; gridId: number }) => (p.gridId > 0 ? p.gridId : -p.id);
  /** Every other grid in the node, once, with the most specific kind winning. */
  const nodes = $derived.by(() => {
    const out: { gridId: number; name: string; kind: Kind }[] = [];
    const add = (gridId: number, name: string, kind: Kind) => {
      if (gridId !== 1 && gridId !== 0 && !out.some((o) => o.gridId === gridId)) out.push({ gridId, name, kind });
    };
    for (const p of prizes) add(p.gridId, p.name, 'prize');
    for (const e of combat.enemies) add(e.gridId, e.name, 'hostile');
    for (const p of trade.partners) add(key(p), p.name, p.kind);
    for (const t of shuttles.targets) add(t.gridId, t.name, 'ship');
    return out;
  });
</script>

<!-- What else is in this node. Click to jump the camera to it and open its panel. -->
{#if nodes.length}
  <span class="nodes" data-testid="nodes">
    {#each nodes as n (n.gridId)}
      <button class="tile" class:on={selected === n.gridId} class:foe={n.kind === 'hostile'} title="{n.name} ({n.kind})" aria-label={n.name} data-testid="node-{n.gridId}" data-kind={n.kind} onclick={() => api.selectGrid(n.gridId)}><Icon name={icons[n.kind]} size={20} /></button>
    {/each}
  </span>
{/if}

<style>
  .nodes { display: grid; grid-template-rows: repeat(2, 37px); grid-auto-flow: column; grid-auto-columns: 37px; gap: 2px; }
  .nodes button.tile { width: 37px; height: 37px; background: var(--panel); }
  .nodes button.tile.on { background: var(--panel-3); border-color: var(--cyan); }
  .nodes button.tile.foe { color: var(--red); border-color: #7a2a2a; }
  @media (max-width: 600px) { .nodes { grid-template-rows: 34px; grid-auto-columns: 34px; } .nodes button.tile { width: 34px; height: 34px; } }
</style>
