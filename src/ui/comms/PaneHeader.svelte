<script lang="ts">
  import KeyBadge from '../kit/KeyBadge.svelte';

  /**
   * A column header bar: the `label` on the left; on the right either an action button (`action`: label, hotkey badge, handler) or, once done, a green
   * `done` word (CONNECTED, SCANNED). Takes no state of its own.
   */
  let { label, action, done, testId }: {
    label: string; action?: { label: string; key?: string; onclick: () => void; disabled?: boolean }; done?: string; testId?: string;
  } = $props();
</script>

<header>
  <span class="label">{label}</span>
  {#if done}
    <span class="done">{done}</span>
  {:else if action}
    <button class="act" disabled={action.disabled} onclick={action.onclick} data-testid={testId}>{action.label}{#if action.key}<KeyBadge tone="dim" size="sm">{action.key}</KeyBadge>{/if}</button>
  {/if}
</header>

<style>
  header { display: flex; align-items: center; justify-content: space-between; height: 34px; padding: 0 10px; border-bottom: 1px solid var(--line); background: #0d1115; box-sizing: border-box; }
  .label { font: 600 12px var(--head-font); letter-spacing: 0.14em; color: var(--dim); text-transform: uppercase; }
  .done { font: 600 11px var(--head-font); letter-spacing: 0.12em; color: var(--green); }
  .act { display: flex; align-items: center; gap: 8px; padding: 3px 9px; min-height: 0; font: 700 12px var(--head-font); letter-spacing: 0.12em; color: var(--cyan); border: 1px solid var(--cyan); background: rgba(54, 212, 255, 0.1); border-radius: 0; cursor: pointer; }
  .act:hover:not(:disabled) { background: rgba(54, 212, 255, 0.2); }
  .act:disabled { opacity: 0.5; cursor: default; }
</style>
