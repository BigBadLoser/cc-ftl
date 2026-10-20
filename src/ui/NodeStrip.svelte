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
  /** Every other ship or station in the node, once, with the most specific kind winning. Keyed by entity id (a station's is its trader's). */
  const nodes = $derived.by(() => {
    const out: { ship: number; name: string; kind: Kind }[] = [];
    const home = combat.player?.ship ?? 0;
    const add = (ship: number, name: string, kind: Kind) => {
      if (ship !== home && ship !== 0 && !out.some((o) => o.ship === ship)) out.push({ ship, name, kind });
    };
    for (const p of prizes) add(p.ship, p.name, 'prize');
    for (const e of combat.enemies) add(e.ship, e.name, 'hostile');
    for (const p of trade.partners) add(p.id, p.name, p.kind);
    for (const t of shuttles.targets) add(t.ship, t.name, 'ship');
    return out;
  });
</script>

<!-- What else is in this node. Click to jump the camera to it and open its panel. -->
{#if nodes.length}
  <span class="nodes" data-testid="nodes">
    {#each nodes as n (n.ship)}
      <button class="tile" class:on={selected === n.ship} class:foe={n.kind === 'hostile'} title="{n.name} ({n.kind})" aria-label={n.name} data-testid="node-{n.ship}" data-kind={n.kind} onclick={() => api.selectShip(n.ship)}><Icon name={icons[n.kind]} size={20} /></button>
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
