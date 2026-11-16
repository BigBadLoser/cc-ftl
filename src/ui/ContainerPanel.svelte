<script lang="ts">
  import type { UiApi, UiContainer } from './api';
  import { PaneHead } from './kit';
  import InspectorAction from './InspectorAction.svelte';

  /** A lost container's inspector: unknown contents and the Open order (DESIGN.md "Salvaging derelicts", lost cargo). */
  let { api, container, onBack }: { api: UiApi; container: UiContainer; onBack: () => void } = $props();
  /** The sim's own refusal codes (`openRefusal`), in words. */
  const REASONS: Record<string, string> = { notDriftingContainer: 'This box cannot be opened.' };
  const reason = $derived(container.refusal ? (REASONS[container.refusal] ?? container.refusal) : null);
  const cutting = $derived(container.state === 'cutting');
  const message = $derived(cutting ? 'A crew member is cutting it open…' : (reason ?? 'Crew cut it open in spacesuits'));
  const buttons = $derived([
    { label: cutting ? 'Cutting…' : 'Open', testid: 'container-open', action: true, disabled: cutting || !!reason, title: 'Crew go out by shuttle and cut it open; the goods spill for loading', onclick: () => api.openContainer(container.entity) },
  ]);
</script>

<div data-testid="container-panel" aria-label="Container">
  <PaneHead icon="grid" title={container.name} sub={container.faction ?? ''} {onBack} />
  <p class="dim" data-testid="container-contents">Contents unknown until opened.</p>
  <InspectorAction {message} alert={!!reason && !cutting} {buttons} testid="container-action" resetKey={container.id} />
</div>

<style>
  .dim { color: var(--dim); margin: 8px 0; }
</style>
