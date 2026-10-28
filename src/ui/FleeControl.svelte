<script lang="ts">
  import Icon from './Icon.svelte';

  /**
   * The combat panel's flee control: the Flee button, the FTL charge bar and what the drive is doing. The drive charges by itself while the helm is
   * manned. Once it is full, one click jumps the ship out of the fight into hyperspace, where the starmap picks the destination.
   */
  let { charge, max, helmManned, active, onFlee }: { charge: number; max: number; helmManned: boolean; active: boolean; onFlee: () => void } = $props();

  const ready = $derived(charge >= max && active);
  const pct = $derived(Math.min(100, Math.round((charge / max) * 100)));
  const status = $derived(
    ready ? 'Ready' : !helmManned ? 'Helm unmanned: the drive is not charging' : `Charging ${Math.floor(charge)}/${max} s`,
  );
</script>

<div class="flee" class:ready data-testid="flee-control">
  <button class="go" disabled={!ready} title={ready ? 'Flee: jump out of the fight, then pick where to go on the starmap' : 'The drive charges while the helm is manned'} aria-label="Flee" data-testid="combat-flee" onclick={onFlee}>
    <Icon name="fast" size={16} />Flee
  </button>
  <span class="bar" title="FTL charge"><i style="width:{pct}%"></i></span>
  <span class="st" class:warn={!helmManned && !ready} data-testid="flee-status">{status}</span>
</div>

<style>
  .flee { display: flex; align-items: center; gap: 8px; padding: 4px 6px; background: var(--panel-2); border: 1px solid var(--line); }
  .flee.ready { border-color: var(--green); }
  button { min-height: 0; min-width: 0; height: 28px; padding: 0 10px; display: inline-flex; align-items: center; gap: 6px; font: 600 14px var(--head-font); letter-spacing: 0.06em; text-transform: uppercase; }
  button:not(:disabled) { background: #0b4f3a; border-color: var(--green); color: #fff; }
  .bar { flex: 1; display: block; height: 4px; background: #0b1220; } .bar > i { display: block; height: 100%; background: var(--cyan); } .ready .bar > i { background: var(--green); }
  .st { font-size: 11px; color: var(--dim); white-space: nowrap; } .st.warn { color: var(--amber); } .ready .st { color: var(--green); font-weight: 600; }
</style>
