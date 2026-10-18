<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi, UiPrize } from './api';

  let { api, onClose }: { api: UiApi; onClose: () => void } = $props();
  let prizes = $state<UiPrize[]>([]);
  let confirm = $state(0);
  onMount(() => api.prizes.subscribe((v) => (prizes = v)));
</script>

<aside class="sheet" data-testid="prize-panel" aria-label="Prizes">
  <header>
    <strong>Prizes</strong>
    <button aria-label="Close prize panel" onclick={onClose}>×</button>
  </header>
  {#each prizes as p (p.gridId)}
    <section data-testid="prize-{p.gridId}">
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
      {#if confirm === p.gridId}
        <div class="btns">
          <button class="warn" data-testid="scuttle-confirm" onclick={() => { api.dispatch({ type: 'ship.scuttle', gridId: p.gridId }); confirm = 0; }}>Scuttle for real</button>
          <button onclick={() => (confirm = 0)}>Keep it</button>
        </div>
      {:else}
        <button class="warn full" data-testid="scuttle" onclick={() => (confirm = p.gridId)}>Scuttle</button>
        {#if p.crewAboard > 0}<p class="hint">Move your crew off first: scuttling is refused while they are aboard.</p>{/if}
      {/if}
    </section>
  {:else}
    <p class="dim">No captured ships.</p>
  {/each}
</aside>

<style>
  aside { left: calc(8px + var(--sal)); bottom: calc(8px + var(--sab)); width: 310px; max-height: calc(100vh - var(--hdr) - 24px); overflow-y: auto; }
  header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; color: var(--cyan); }
  header button { min-height: 32px; min-width: 32px; padding: 0 8px; }
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
  @media (max-width: 600px) { aside { width: auto; left: 0; bottom: 0; max-height: 46vh; z-index: 8; } }
</style>
