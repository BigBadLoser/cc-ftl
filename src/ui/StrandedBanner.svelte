<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi, UiStranded } from './api';
  import Icon from './Icon.svelte';

  /**
   * Shown while the ship cannot pay for any jump. With fuel on sale in the node it points at the station; with none (or none the player can pay for) it offers the
   * distress call, and once sent it counts the turns until the tug arrives. The tug always comes: it takes what the player can pay and the rest costs standing.
   */
  let { api }: { api: UiApi } = $props();
  let s = $state<UiStranded | null>(null);
  onMount(() => api.stranded.subscribe((v) => (s = v)));
  const turns = (n: number) => `${n} turn${n === 1 ? '' : 's'}`;
</script>

{#if s}
  <div class="stranded" data-testid="stranded" data-state={s.pending ? 'pending' : s.canCall ? 'can-call' : 'fuel-here'}>
    <div class="head"><Icon name="alert" size={16} /><b>Out of fuel</b><span class="have">{s.have}/{s.need} fuel</span></div>
    {#if s.pending}
      <p data-testid="stranded-pending">Distress call sent. A tug arrives in {turns(s.pending.turnsLeft)}.</p>
    {:else if s.canCall}
      <p>No fuel for sale here. Call a tug: {s.fuel} fuel at ₵{s.unit} each (₵{s.total}). If you cannot pay it all, it comes anyway and the rest costs standing with the traders.</p>
      <button class="go" data-testid="stranded-call" onclick={() => api.dispatch({ type: 'galaxy.distress' })}>Send distress call</button>
    {:else}
      <p data-testid="stranded-hint">A station here sells fuel: open it and use Refuel in the Trade tab.</p>
    {/if}
  </div>
{/if}

<style>
  .stranded { background: var(--panel); border: 1px solid var(--red); border-left-width: 3px; padding: 6px 8px; font-size: 13px; display: grid; gap: 4px; }
  .head { display: flex; align-items: center; gap: 8px; color: var(--red); }
  .head b { font: 600 14px var(--head-font); color: var(--text); letter-spacing: 0.03em; }
  .have { margin-left: auto; color: var(--dim); font-size: 12px; }
  p { margin: 0; color: var(--dim); line-height: 1.3; }
  .go { min-height: 34px; background: #0e4a56; border-color: var(--cyan); }
</style>
