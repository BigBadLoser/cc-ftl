<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi, UiError } from './api';
  import { copyText } from './clipboard';

  let { api }: { api: UiApi } = $props();
  let errors = $state<UiError[]>([]);
  let open = $state(false);

  onMount(() => api.errors.subscribe((e) => (errors = e)));

  function text(): string {
    return errors.map((e) => `[${new Date(e.time).toISOString()}] ${e.message}\n${e.stack}`).join('\n\n');
  }
  async function copy(ev: MouseEvent) {
    const b = ev.currentTarget as HTMLButtonElement;
    const ok = await copyText(text());
    b.textContent = ok ? 'Copied' : 'Copy failed';
    setTimeout(() => (b.textContent = 'Copy errors'), 1500);
  }
  function dismiss() {
    api.clearErrors();
    open = false;
  }
</script>

{#if errors.length > 0}
  <div class="wrap" role="alert">
    <button class="banner" onclick={() => (open = !open)}>
      <b>{errors.length}</b> {errors[0]?.message}
    </button>
    {#if open}
      <div class="list">
        <div class="actions">
          <button onclick={copy}>Copy errors</button>
          <button onclick={dismiss}>Dismiss</button>
        </div>
        {#each errors as e (e.time + e.message)}
          <pre><strong>{e.message}</strong>
{e.stack}</pre>
        {/each}
      </div>
    {/if}
  </div>
{/if}

<style>
  .wrap { position: fixed; left: calc(8px + var(--sal)); right: calc(8px + var(--sar)); bottom: calc(8px + var(--sab)); z-index: 45; }
  .banner { width: 100%; text-align: left; background: #5b1414; border-color: var(--red); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .banner b { background: var(--red); color: #fff; border-radius: 0; padding: 0 7px; margin-right: 6px; }
  .list { margin-bottom: 4px; max-height: 55vh; overflow: auto; background: var(--panel); border: 1px solid var(--red); border-radius: 0; padding: 8px; touch-action: pan-y; -webkit-user-select: text; user-select: text; }
  .actions { display: flex; gap: 8px; margin-bottom: 8px; }
  pre { margin: 0 0 8px; font-size: 11px; white-space: pre-wrap; word-break: break-word; color: #fca5a5; }
</style>
