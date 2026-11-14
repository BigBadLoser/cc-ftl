<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi, UiStory } from './api';
  import { Dialog } from './kit';
  import SignalComms from './SignalComms.svelte';
  import { storyKeys } from './storyKeys';
  import { keymap } from './keymap';

  /**
   * The incoming-signal window: a forced-decision modal around SignalComms (the comms pieces composed for a story signal). It owns the modal, and the
   * scan key, which is the story's remote choice.
   */
  let { api, active, busy, pick }: { api: UiApi; active: NonNullable<UiStory['active']>; busy: boolean; pick: (id: string) => void } = $props();
  let binds = $state(keymap.get());
  onMount(() => {
    const off = keymap.subscribe((b) => (binds = b));
    const stop = storyKeys(() => ({ active, busy, pick }));
    return () => { off(); stop(); };
  });
</script>

<Dialog open title={active.title} dismissable={false} testId="story-modal" bare>
  <SignalComms {api} {active} {busy} {pick} {binds} />
</Dialog>
