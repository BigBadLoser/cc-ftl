<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi, UiOpinionHover } from './api';

  /**
   * "Friend: fought together at Ithra": a small line by the pointer while it rests on a crewmate and another is selected, saying what
   * the selected one thinks of them and why (docs/TRAITS.md section 6). Shown only when there is an opinion worth a line.
   */
  let { api }: { api: UiApi } = $props();
  let op = $state<UiOpinionHover | null>(null);
  let at = $state({ x: 0, y: 0 });

  onMount(() => {
    const off = api.opinionHover.subscribe((v) => (op = v));
    const move = (e: PointerEvent) => (at = { x: e.clientX, y: e.clientY });
    window.addEventListener('pointermove', move);
    return () => (off(), window.removeEventListener('pointermove', move));
  });
</script>

{#if op}
  <div class="tip {op.tone}" style="left:{at.x + 16}px; top:{at.y + 18}px" data-testid="opinion-hover" role="status">
    <b>{op.name}</b> <span>{op.line}</span>
  </div>
{/if}

<style>
  .tip {
    position: fixed; z-index: 30; pointer-events: none; padding: 4px 8px; background: var(--panel); border: 1px solid var(--line-hi);
    font-size: 13px; white-space: nowrap; max-width: 320px; overflow: hidden; text-overflow: ellipsis;
  }
  .tip b { font-weight: 600; margin-right: 4px; }
  .tip span { color: var(--dim); }
  .good { border-color: var(--green, #4cd964); }
  .bad { border-color: var(--red); }
</style>
