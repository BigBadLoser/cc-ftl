<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi, UiCombat, UiMining, UiPrize, UiShuttles, UiTrade } from './api';
  import { TipButton } from './kit';
  import Icon from './Icon.svelte';
  import { nodeEntries, NODE_ICONS as icons } from './nodeList';

  let { api, selected }: { api: UiApi; selected: number | null } = $props();
  let trade = $state<UiTrade>({ credits: 0, partners: [], deals: [] });
  let prizes = $state<UiPrize[]>([]);
  let combat = $state<UiCombat>({ inCombat: false, player: null, enemies: [] });
  let shuttles = $state<UiShuttles>({ shuttles: [], airlocks: [], targets: [], roster: [], bays: [], regions: [], transfers: [], ferryReady: false });
  let mining = $state<UiMining>({ asteroids: [], pods: [] });
  let selAst = $state<number | null>(null);
  onMount(() => {
    const u = [
      api.trade.subscribe((v) => (trade = v)),
      api.prizes.subscribe((v) => (prizes = v)),
      api.combat.subscribe((v) => (combat = v)),
      api.shuttles.subscribe((v) => (shuttles = v)),
      api.mining.subscribe((v) => (mining = v)),
      api.selectedAsteroid.subscribe((v) => (selAst = v)),
    ];
    return () => u.forEach((f) => f());
  });

  const nodes = $derived(nodeEntries({ trade, prizes, combat, shuttles }));
</script>

<!-- What else is in this node. Click to jump the camera to it and open its panel. -->
{#if nodes.length || mining.asteroids.length}
  <span class="nodes" data-testid="nodes">
    {#each nodes as n (n.ship)}
      <TipButton text={n.kind === 'station' ? n.name : `${n.name} (${n.kind})`} label={n.name} class="tile{selected === n.ship ? ' on' : ''}{n.kind === 'hostile' ? ' foe' : ''}" data-testid="node-{n.ship}" data-kind={n.kind} onclick={() => api.selectShip(n.ship)}><Icon name={icons[n.kind]} size={20} /></TipButton>
    {/each}
    {#each mining.asteroids as a (a.id)}
      <button class="tile rock" class:on={selAst === a.id} title="{a.name} ({a.ore.reduce((n, o) => n + o.units, 0)} ore)" aria-label={a.name} data-testid="node-asteroid-{a.id}" onclick={() => api.selectAsteroid(a.id)}><Icon name="grid" size={20} /></button>
    {/each}
  </span>
{/if}

<style>
  .nodes { display: grid; grid-template-rows: repeat(2, 37px); grid-auto-flow: column; grid-auto-columns: 37px; gap: 2px; }
  .nodes :global(button.tile) { width: 37px; height: 37px; background: var(--panel); }
  .nodes :global(button.tile.on) { background: var(--panel-3); border-color: var(--cyan); }
  .nodes :global(button.tile.foe) { color: var(--red); border-color: #7a2a2a; }
  .nodes :global(button.tile.rock) { color: #b4a48c; }
  @media (max-width: 600px) { .nodes { grid-template-rows: 34px; grid-auto-columns: 34px; } .nodes :global(button.tile) { width: 34px; height: 34px; } }
</style>
