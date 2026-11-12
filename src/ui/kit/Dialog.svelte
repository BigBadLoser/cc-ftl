<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Dialog } from 'bits-ui';
  import Frame from './Frame.svelte';
  import Icon from '../Icon.svelte';

  /**
   * A modal: dim veil, a rail frame (kit/Frame: the title in the top line, a close tile when dismissable) centred on desktop and a bottom sheet on phones. `dismissable` false = only your own buttons close it. Focus moves
   * in and is trapped while it is open. `bare`: no card, the children bring their own panel (the Esc menu); the title is for screen readers
   * only. `initialFocus`: a selector focused on open instead of the first control. `onCloseFocus`: where focus goes on close (default: back to
   * whatever had it before).
   */
  let { open, onOpenChange, title, children, dismissable = true, testId, bare = false, initialFocus, onCloseFocus }: {
    open: boolean; onOpenChange?: (open: boolean) => void; title: string; children: Snippet; dismissable?: boolean; testId?: string;
    bare?: boolean; initialFocus?: string; onCloseFocus?: () => void;
  } = $props();
  const openFocus = (e: Event) => {
    const el = initialFocus ? document.querySelector<HTMLElement>(initialFocus) : null;
    if (!el) return;
    e.preventDefault();
    el.focus();
  };
  const closeFocus = (e: Event) => {
    if (!onCloseFocus) return;
    e.preventDefault();
    onCloseFocus();
  };
  const guard = $derived(dismissable ? 'close' : 'ignore');
</script>

<Dialog.Root {open} onOpenChange={(o) => onOpenChange?.(o)}>
  <Dialog.Portal>
    <Dialog.Overlay class="kit-veil" />
    <Dialog.Content class={bare ? 'kit-bare' : 'kit-card'} data-testid={testId} interactOutsideBehavior={guard} escapeKeydownBehavior={guard} onOpenAutoFocus={openFocus} onCloseAutoFocus={closeFocus}>
      <Dialog.Title class="kit-sr">{title}</Dialog.Title>
      {#if bare}
        {@render children()}
      {:else}
        <Frame {title} style="background: var(--card-bg, var(--panel-2)); max-height: calc(100dvh - 32px); padding: var(--sp-3) 0 0; box-shadow: var(--shadow-window);">
          {#snippet right()}
            {#if dismissable}<Dialog.Close class="kit-card-x" aria-label="Close"><Icon name="close" size={12} /></Dialog.Close>{/if}
          {/snippet}
          <div class="kit-card-body">{@render children()}</div>
        </Frame>
      {/if}
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>

<style>
  :global(.kit-veil) { position: fixed; inset: 0; z-index: 30; background: var(--veil); touch-action: none; }
  :global(.kit-card) { position: fixed; z-index: 31; left: 50%; top: 50%; transform: translate(-50%, -50%); box-sizing: border-box; width: min(520px, calc(100% - 32px)); outline: none; }
  :global(.kit-card-body) { padding: 12px 16px 16px; overflow-y: auto; min-height: 0; }
  :global(.kit-card-x) { width: 18px; height: 18px; min-width: 0; min-height: 0; margin-left: 4px; padding: 0; display: grid; place-items: center; border: 1px solid var(--frame-line); border-radius: 0; background: var(--band-tile); color: #fff; cursor: pointer; }
  :global(.kit-card-x:hover) { background: var(--panel-3); }
  :global(.kit-bare) { position: fixed; z-index: 31; left: 50%; top: 50%; transform: translate(-50%, -50%); outline: none; }
  :global(.kit-sr) { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
</style>
