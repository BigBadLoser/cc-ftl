<script lang="ts">
  import type { UiApi, UiContainer } from './api';
  import { PaneHead, tip } from './kit';

  let { api, container, onBack }: { api: UiApi; container: UiContainer; onBack: () => void } = $props();
  /** The sim's own refusal codes (`openRefusal`), in words. */
  const REASONS: Record<string, string> = { notDriftingContainer: 'This box cannot be opened.' };
  const reason = $derived(container.refusal ? (REASONS[container.refusal] ?? container.refusal) : null);
  const cutting = $derived(container.state === 'cutting');
</script>

<div data-testid="container-panel" aria-label="Container">
  <PaneHead icon="grid" title={container.name} sub={container.faction ? `Livery: ${container.faction}` : ''} {onBack} />
  <div class="sub">Contents</div>
  <p class="dim" data-testid="container-contents">Contents unknown until opened.</p>
  {#if cutting}
    <p data-testid="container-cutting">A crew member is cutting it open.</p>
  {:else if reason}
    <p class="dim" data-testid="container-refusal">{reason}</p>
  {/if}
  <button class="full" disabled={cutting || !!reason} data-testid="container-open" use:tip={{ text: 'Crew go out by shuttle and cut it open; the goods spill for loading' }} onclick={() => api.openContainer(container.entity)}>
    {cutting ? 'Cutting…' : 'Open'}
  </button>
</div>

<style>
  .sub { color: var(--dim); font-size: 12px; margin: 8px 0 4px; }
  .dim { color: var(--dim); margin: 0; }
  .full { width: 100%; margin-top: 10px; }
</style>
