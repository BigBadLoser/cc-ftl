<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi, UiStory } from './api';
  import { Dialog } from './kit';
  import SignalComms from './SignalComms.svelte';
  import { holdModal, isTypingTarget } from './keys';
  import { keymap } from './keymap';

  /**
   * The incoming-signal window: a forced-decision modal around SignalComms (the comms pieces composed for a story signal). It owns the modal, and the
   * hail and scan keys, which are the story's remote choices.
   */
  let { api, active, busy, pick }: { api: UiApi; active: NonNullable<UiStory['active']>; busy: boolean; pick: (id: string) => void } = $props();
  const c = $derived(active.comms!);

  function keydown(e: KeyboardEvent) {
    if (busy || e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e)) return;
    if (keymap.matches(e, 'ui.hail') && c.hailChoice) { e.preventDefault(); pick(c.hailChoice); }
    else if (keymap.matches(e, 'ui.scan') && c.scanChoice) { e.preventDefault(); pick(c.scanChoice); }
  }
  let binds = $state(keymap.get());
  onMount(() => {
    // A forced decision: the game's own keys (S pans the camera down) stand aside while it is open.
    const release = holdModal();
    window.addEventListener('keydown', keydown);
    const off = keymap.subscribe((b) => (binds = b));
    return () => { window.removeEventListener('keydown', keydown); off(); release(); };
  });
</script>

<Dialog open title={active.title} dismissable={false} testId="story-modal" bare>
  <SignalComms {api} {active} {busy} {pick} {binds} />
</Dialog>
