<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Dialog } from 'bits-ui';

  /** A modal: dim veil, card centred on desktop and a bottom sheet on phones. `dismissable` false = only your own buttons close it. */
  let { open, onOpenChange, title, children, dismissable = true, testId }: {
    open: boolean; onOpenChange?: (open: boolean) => void; title: string; children: Snippet; dismissable?: boolean; testId?: string;
  } = $props();
  const guard = $derived(dismissable ? 'close' : 'ignore');
</script>

<Dialog.Root {open} onOpenChange={(o) => onOpenChange?.(o)}>
  <Dialog.Portal>
    <Dialog.Overlay class="kit-veil" />
    <Dialog.Content class="kit-card" data-testid={testId} interactOutsideBehavior={guard} escapeKeydownBehavior={guard}>
      <Dialog.Title class="kit-card-title">{title}</Dialog.Title>
      {@render children()}
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>

<style>
  :global(.kit-veil) { position: fixed; inset: 0; z-index: 30; background: rgba(4, 8, 14, 0.62); touch-action: none; }
  :global(.kit-card) { position: fixed; z-index: 31; left: 50%; top: 50%; transform: translate(-50%, -50%); box-sizing: border-box; width: min(520px, calc(100% - 32px)); max-height: calc(100dvh - 32px); overflow-y: auto; touch-action: pan-y; background: var(--panel-2); border: 1px solid var(--cyan); border-radius: var(--kit-dialog-radius); padding: 16px; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.6); outline: none; }
  :global(.kit-card-title) { margin: 0 0 6px; font-size: 18px; color: var(--cyan); }
  /* Phone: a bottom sheet instead of a centred card. */
  @media (max-width: 600px) {
    :global(.kit-card) { left: 0; right: 0; top: auto; bottom: 0; transform: none; width: auto; max-height: 88dvh; border-radius: var(--kit-dialog-radius) var(--kit-dialog-radius) 0 0; border-width: 1px 0 0; padding: 14px 14px calc(14px + var(--sab)); }
  }
</style>
