<script lang="ts">
  import type { UiApi, UiModule, UiUpgradeItem } from '../api';
  import ItemIcon from '../ItemIcon.svelte';

  /**
   * The upgrade slot in the module inspector: what is fitted (icon, name, effects) with a Remove button, and the fitting upgrades in cargo to
   * install. Both are commands; an engineer does the work and the module is offline meanwhile (amber), so the slot says so while a job is posted.
   * Colours: cyan is the actionable buttons, amber the warning that the module is offline.
   */
  let { api, m }: { api: UiApi; m: UiModule } = $props();
  const slot = $derived(m.upgradeSlot);
  const row = (u: UiUpgradeItem): string => u.effects.join(' · ');
</script>

{#if slot}
  <section data-testid="upgrade-slot">
    <div class="sub">Upgrade slot</div>
    {#if slot.job}
      <div class="job" class:off={slot.job.working} data-testid="upgrade-job">
        <span>{slot.job.item ? `Fitting ${slot.job.item.name}` : 'Removing the upgrade'}{slot.job.working ? ': offline while the work runs' : ': waiting for an engineer'}</span>
        {#if !slot.job.working}
          <button class="act" data-testid="upgrade-cancel" onclick={() => api.dispatch({ type: 'module.cancelUpgrade', moduleId: m.id })}>Cancel</button>
        {/if}
      </div>
    {/if}
    <div class="row fitted" data-testid="upgrade-fitted">
      {#if slot.fitted}
        <ItemIcon {api} item={slot.fitted.item} size={30} />
        <span class="txt"><b>{slot.fitted.name}</b><small>{row(slot.fitted)}</small></span>
        <button class="act" data-testid="upgrade-remove" disabled={!!slot.job} title="An engineer takes it out and puts it back in cargo" onclick={() => api.dispatch({ type: 'module.removeUpgrade', moduleId: m.id })}>Remove</button>
      {:else}
        <span class="empty">Empty</span>
      {/if}
    </div>
    {#each slot.options.filter((o) => o.item !== slot.fitted?.item) as o (o.item)}
      <div class="row" data-testid="upgrade-option">
        <ItemIcon {api} item={o.item} size={30} />
        <span class="txt"><b>{o.name} <em>×{o.count}</em></b><small>{row(o)}</small></span>
        <button class="act" disabled={!!slot.job} title={slot.fitted ? 'Swaps it: the fitted one goes back to cargo' : 'An engineer fetches it from cargo and installs it'} onclick={() => api.dispatch({ type: 'module.fitUpgrade', moduleId: m.id, item: o.item })}>{slot.fitted ? 'Swap' : 'Install'}</button>
      </div>
    {:else}
      {#if !slot.fitted}<div class="none">No upgrades in cargo that fit.</div>{/if}
    {/each}
  </section>
{/if}

<style>
  section { margin-top: 8px; }
  .sub { color: var(--dim); font-size: 12px; margin: 8px 0 4px; }
  .row { display: flex; align-items: center; gap: 8px; min-height: 34px; padding: 2px 0; }
  .txt { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .txt small { color: var(--dim); font-size: 11px; line-height: 1.2; }
  em { font-style: normal; color: var(--dim); font-weight: 400; }
  .empty, .none { color: var(--dim); }
  .none { font-size: 12px; }
  .job { display: flex; justify-content: space-between; align-items: center; gap: 8px; color: var(--amber); font-size: 12px; margin-bottom: 4px; }
  .act { min-height: 28px; padding: 0 10px; color: var(--cyan); border-color: var(--cyan); background: #000; }
  .act:disabled { color: var(--dim); border-color: var(--line, #2a3a48); }
</style>
