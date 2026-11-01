<script lang="ts">
  import type { StarterShip } from '../../content/ships/starterShips';

  /** New game, step 1: the starter ships as cards. The selected one is the ship drawn in the backdrop. */
  let { starters, picked = $bindable(0), onNext }: { starters: readonly StarterShip[]; picked: number; onNext: () => void } = $props();
</script>

<div class="cards" role="radiogroup" aria-label="Starter ship">
  {#each starters as s, i (s.id)}
    <button class="card" class:on={picked === i} role="radio" aria-checked={picked === i} data-testid="ship-card" onclick={() => (picked = i)}>
      <span class="name">{s.title}<em>{s.tagline}</em></span>
      <span class="cls">{s.name} · {s.template.crew?.length ?? 0} crew</span>
      <span class="blurb">{s.blurb}</span>
    </button>
  {/each}
</div>
<div class="row">
  <button class="interact" data-testid="ship-next" onclick={onNext}>Next</button>
</div>

<style>
  .cards { display: grid; gap: var(--sp-2); margin: var(--sp-1) 0 var(--sp-3); }
  .card { display: grid; gap: 4px; padding: var(--sp-3); text-align: left; background: var(--panel-2); border: 1px solid var(--line); }
  .card:hover { border-color: var(--line-hi); }
  .card.on { border-color: var(--cyan); background: var(--panel-3); box-shadow: inset 3px 0 0 var(--cyan); }
  .name { display: flex; align-items: baseline; gap: 10px; font: 700 20px var(--head-font); letter-spacing: 0.08em; text-transform: uppercase; }
  .name em { font: 600 12px var(--head-font); font-style: normal; letter-spacing: 0.12em; color: var(--cyan); }
  .cls { font: 600 12px var(--head-font); letter-spacing: 0.1em; text-transform: uppercase; color: var(--dim); }
  .blurb { color: var(--dim); font-size: 13px; line-height: 1.45; }
  .row { display: flex; justify-content: flex-end; }
  .row button { display: inline-flex; align-items: center; gap: 6px; min-height: 38px; padding: 0 16px; font: 600 14px var(--head-font); letter-spacing: 0.08em; text-transform: uppercase; }
</style>
