<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi, UiPrize } from './api';

  let { api, ship }: { api: UiApi; ship: number } = $props();
  let prizes = $state<UiPrize[]>([]);
  let confirm = $state(0);
  onMount(() => api.prizes.subscribe((v) => (prizes = v)));
</script>

<div data-testid="prize-panel" aria-label="Prize">
  {#each prizes.filter((x) => x.ship === ship) as p (p.ship)}
    <section data-testid="prize-{p.ship}">
      <h3>{p.name} <small>taken from {p.from}</small></h3>
      <div class="row"><span class="dim">Prize value</span><span data-testid="prize-value">{p.value}</span></div>
      <div class="row"><span class="dim">Your crew aboard</span><span>{p.crewAboard}</span></div>
      <div class="sub">Prisoners ({p.prisoners.length})</div>
      <ul data-testid="prisoners">
        {#each p.prisoners as c (c.id)}
          <li><span>{c.name} <small>{c.role}</small></span><span class="dim">{c.state}, {c.hp}/{c.maxHp}</span></li>
        {:else}
          <li class="dim">None.</li>
        {/each}
      </ul>
      {#if confirm === p.ship}
        <div class="btns">
          <button class="warn" data-testid="scuttle-confirm" onclick={() => { api.dispatch({ type: 'ship.scuttle', ship: p.ship }); confirm = 0; }}>Scuttle for real</button>
          <button onclick={() => (confirm = 0)}>Keep it</button>
        </div>
      {:else}
        <button class="warn full" data-testid="scuttle" onclick={() => (confirm = p.ship)}>Scuttle</button>
        {#if p.crewAboard > 0}<p class="hint">Move your crew off first: scuttling is refused while they are aboard.</p>{/if}
      {/if}
    </section>
  {/each}
</div>

<style>
  h3 { margin: 4px 0; font-size: 15px; }
  h3 small { color: var(--dim); font-weight: normal; }
  .row { display: flex; justify-content: space-between; }
  .dim { color: var(--dim); }
  .sub { color: var(--dim); font-size: 12px; margin: 8px 0 4px; }
  ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }
  li { display: flex; justify-content: space-between; gap: 8px; }
  li small { color: var(--dim); }
  .btns { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-top: 8px; }
  .full { width: 100%; margin-top: 8px; }
  .warn { border-color: #7a2a2a; }
  .hint { color: var(--dim); font-size: 12px; margin: 4px 0 0; }
</style>
