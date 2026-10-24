<script lang="ts">
  /**
   * The Charge FTL control: a button with the drive's live state (Idle / Pilot heading to helm / Charging x/40 s / Ready), a progress bar,
   * Cancel while an order stands, and the reason when it cannot charge. Shared by the starmap drawer, the ship panel and the helm's inspector.
   */
  import Icon from './Icon.svelte';
  import type { UiFtl } from './api';
  import { FTL_BLOCKERS, ftlState } from './ftlText';

  let { ftl, onCharge, onCancel, testid = 'ftl' }: { ftl: UiFtl | null; onCharge: () => void; onCancel: () => void; testid?: string } = $props();
</script>

{#if ftl}
  <div class="ftl" data-testid={testid} data-state={ftl.state}>
    <div class="line">
      <span class="state" class:ready={ftl.state === 'ready'} data-testid="{testid}-state"><Icon name="bolt" size={16} />{ftlState(ftl)}</span>
      {#if ftl.ordered}
        <button class="cancel" onclick={onCancel} data-testid="{testid}-cancel">Cancel</button>
      {:else if ftl.state !== 'ready'}
        <button class="go" disabled={!!ftl.blocker} onclick={onCharge} data-testid="{testid}-charge">Charge FTL</button>
      {/if}
    </div>
    <div class="bar" role="progressbar" aria-valuemin={0} aria-valuemax={ftl.max} aria-valuenow={ftl.charge}><i style={`width: ${Math.min(100, (ftl.charge / ftl.max) * 100)}%`}></i></div>
    {#if ftl.queued}<small class="note">Jump queued: it flies when the drive is charged.</small>{/if}
    {#if ftl.blocker && ftl.state !== 'ready'}<small class="note bad" data-testid="{testid}-why">{FTL_BLOCKERS[ftl.blocker]}</small>{/if}
  </div>
{/if}

<style>
  .ftl { display: grid; gap: 4px; }
  .line { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .state { display: inline-flex; align-items: center; gap: 6px; color: var(--cyan); font-size: 13px; min-width: 0; }
  .state.ready { color: var(--green); }
  button { font: 600 13px var(--head-font); letter-spacing: 0.08em; text-transform: uppercase; padding: 6px 10px; white-space: nowrap; }
  .go { border-color: var(--cyan); background: var(--panel-3); color: var(--text); }
  .go:disabled { opacity: 0.4; }
  .note { font-size: 11px; color: var(--dim); } .note.bad { color: var(--red); }
</style>
