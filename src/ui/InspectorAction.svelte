<script lang="ts" module>
  /** One button of an inspector action. With `confirm`, the first tap shows its warning and asks again before `onclick`. */
  export interface InspectorButton {
    label: string;
    testid: string;
    onclick: () => void;
    title?: string;
    disabled?: boolean;
    /** Drawn as a destructive action. */
    danger?: boolean;
    confirm?: { warning: string; label: string; cancel: string };
  }
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon from './Icon.svelte';

  /**
   * A boxed action in an inspector: a line saying what it is about (`message`, with an alert icon when `alert`), anything
   * else it needs to show (`children`, such as a progress bar), and its buttons as one centred group. `resetKey`: a
   * pending confirmation is dropped when it changes (another object selected).
   */
  let { message, alert = false, buttons, testid, resetKey, children }: {
    message: string; alert?: boolean; buttons: InspectorButton[]; testid?: string; resetKey?: unknown; children?: Snippet;
  } = $props();

  let pending = $state<InspectorButton | null>(null);
  $effect(() => {
    void resetKey;
    pending = null;
  });
  function tap(b: InspectorButton) {
    if (b.confirm && pending !== b) {
      pending = b;
      return;
    }
    pending = null;
    b.onclick();
  }
</script>

<div class="act" class:alert data-testid={testid}>
  <p class="msg">{#if alert}<Icon name="alert" size={16} />{/if}{message}</p>
  {@render children?.()}
  {#if pending?.confirm}<p class="warn" data-testid="{pending.testid}-warning">{pending.confirm.warning}</p>{/if}
  <div class="group">
    {#if pending?.confirm}
      <button data-testid="{pending.testid}-cancel" onclick={() => (pending = null)}>{pending.confirm.cancel}</button>
      <button class="danger" data-testid={pending.testid} onclick={() => pending && tap(pending)}>{pending.confirm.label}</button>
    {:else}
      {#each buttons as b (b.testid)}
        <button class:danger={b.danger} title={b.title} disabled={b.disabled} data-testid={b.testid} onclick={() => tap(b)}>{b.label}</button>
      {/each}
    {/if}
  </div>
</div>

<style>
  .act { display: grid; gap: 6px; margin: 0 0 8px; padding: 8px; background: var(--panel-2); border: 1px solid var(--line); }
  .act.alert { border-color: var(--amber); }
  p { margin: 0; font-size: 12px; }
  .msg { display: flex; align-items: center; gap: 4px; color: var(--text); }
  .alert .msg { color: var(--amber); }
  .warn { color: var(--amber); }
  .group { display: flex; justify-content: center; gap: 8px; }
  .group button { min-height: 32px; padding: 0 14px; }
  .group button.danger { border-color: var(--red); color: var(--red); }
</style>
