<script lang="ts">
  import Icon, { type IconName } from './Icon.svelte';

  let { icon, title, sub = '', foe = false, onBack }: { icon: IconName; title: string; sub?: string; foe?: boolean; onBack?: () => void } = $props();
</script>

<div class="ph head" class:foe>
  {#if onBack}
    <button class="tile back" title="Back to ship (Esc)" aria-label="Back to ship" data-testid="sel-back" onclick={onBack}><Icon name="back" size={18} /></button>
  {:else}
    <span class="ico"><Icon name={icon} size={18} /></span>
  {/if}
  <span class="t">{title}</span>
  {#if sub}<small>{sub}</small>{/if}
</div>

<style>
  .head { display: flex; align-items: center; gap: 8px; padding-top: 0; padding-bottom: 0; min-height: 32px; }
  .back { width: 32px; height: 32px; margin-left: -10px; border-width: 0 1px 0 0; background: #0a3a52; color: #fff; }
  .ico { display: inline-flex; color: var(--cyan); }
  .t { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  small { font: 12px var(--head-font); color: #9fd6ea; letter-spacing: 0.05em; white-space: nowrap; }
  .foe { background: #6a1f1f; }
</style>
