<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi, UiMining } from './api';
  import PanelHead from './PanelHead.svelte';
  import PodList from './PodList.svelte';

  let { api, asteroid, onBack }: { api: UiApi; asteroid: number; onBack: () => void } = $props();
  let mining = $state<UiMining>({ asteroids: [], pods: [] });
  onMount(() => api.mining.subscribe((v) => (mining = v)));
  const a = $derived(mining.asteroids.find((x) => x.id === asteroid));
  // Pods the painted ore goes to (all of them until the player narrows it).
  let off = $state<number[]>([]);
  const picked = $derived(mining.pods.filter((p) => !off.includes(p.id)).map((p) => p.id));
  const toggle = (id: number) => (off = off.includes(id) ? off.filter((x) => x !== id) : [...off, id]);
  const total = $derived(a ? a.ore.reduce((n, o) => n + o.units, 0) : 0);
</script>

<div data-testid="asteroid-panel" aria-label="Asteroid">
  <PanelHead icon="grid" title={a?.name ?? 'Asteroid'} sub={a ? (a.kind === 'big' ? `${a.w}x${a.h} · ${a.coverage}` : `${a.w}x${a.h}`) : ''} {onBack} />
  {#if a}
    <div class="sub">Ore left <small>{total} units</small></div>
    <ul class="ore" data-testid="asteroid-ore">
      {#each a.ore as o (o.item)}
        <li><span><i class="sw" style="background: {o.color}"></i>{o.name}</span><b>{o.units}</b></li>
      {:else}
        <li class="dim">{a.kind === 'big' ? 'No ore: nothing to mine here.' : 'No ore left.'}</li>
      {/each}
    </ul>
    <div class="sub">Mining pods</div>
    <PodList {api} {mining} {asteroid} canMine={total > 0} />
    {#if total > 0 && mining.pods.length}
      <div class="sub">Paint ore for</div>
      <div class="chips" data-testid="mine-pods">
        {#each mining.pods as p (p.id)}
          <button class:on={picked.includes(p.id)} data-testid="mine-pod-{p.id}" onclick={() => toggle(p.id)}>{p.name}</button>
        {/each}
      </div>
      <button class="full" disabled={picked.length === 0} data-testid="asteroid-paint" title="Drag a rectangle over ore: the pods cut just those tiles" onclick={() => api.setTool({ tool: 'build', build: 'mine', pods: picked })}>Paint ore to mine…</button>
    {/if}
    {#if a.kind === 'big'}
      <button class="full" data-testid="asteroid-claim" title="Drag a rectangle on the asteroid to start a base there" onclick={() => api.setTool({ tool: 'build', build: 'claim' })}>Claim for a base…</button>
    {/if}
  {/if}
</div>

<style>
  .sub { color: var(--dim); font-size: 12px; margin: 8px 0 4px; }
  .sub small { margin-left: 6px; }
  .ore { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }
  .ore li { display: flex; justify-content: space-between; }
  .sw { display: inline-block; width: 10px; height: 10px; margin-right: 6px; vertical-align: -1px; }
  .dim { color: var(--dim); }
  .full { width: 100%; margin-top: 10px; }
  .chips { display: flex; flex-wrap: wrap; gap: 4px; }
  .chips button { min-height: 30px; padding: 0 10px; }
  .chips button.on { border-color: var(--cyan); }
</style>
