<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi } from './api';
  import PaneHeader from './comms/PaneHeader.svelte';
  import VideoFeed from './comms/VideoFeed.svelte';
  import type { Contact } from './stationChannel';

  /** The left pane: the open call with the contact of the service on screen. Switching contact cuts to static for a moment, then the new face. */
  let { api, contact, station }: { api: UiApi; contact: Contact; station: string } = $props();
  let face = $state<string | null>(null);
  let cutting = $state(true);
  let secs = $state(0);
  onMount(() => {
    const t = setInterval(() => secs++, 1000);
    return () => clearInterval(t);
  });
  $effect(() => {
    const look = contact.look;
    cutting = true;
    face = null;
    let poll: ReturnType<typeof setInterval> | undefined;
    const cut = setTimeout(() => {
      cutting = false;
      poll = setInterval(() => {
        const f = api.lookPortrait(look);
        if (f) { face = f; clearInterval(poll); }
      }, 100);
    }, 650);
    return () => { clearTimeout(cut); clearInterval(poll); };
  });
  const clock = $derived(`${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`);
</script>

<PaneHeader label="VIDEO" done={cutting ? undefined : 'CONNECTED'} />
<div class="feed" data-testid="station-video">
  <VideoFeed src={cutting ? null : face} label={cutting ? 'CONNECTING' : 'NO VIDEO'} />
  {#if !cutting && face}<span class="tc">{clock}</span>{/if}
</div>
<div class="who">
  <b data-testid="station-contact">{contact.name}</b>
  <span>{contact.title} · {station}</span>
</div>

<style>
  .feed { position: relative; margin: 10px; }
  .tc { position: absolute; right: 6px; bottom: 5px; font: 9px var(--pixel-font); color: #cfd6dc; opacity: 0.8; }
  .who { padding: 0 10px; display: grid; gap: 1px; }
  .who b { font: 700 18px var(--head-font); letter-spacing: 0.02em; }
  .who span { color: var(--dim); font-size: 12.5px; }
</style>
