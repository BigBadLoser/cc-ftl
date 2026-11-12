<script lang="ts">
  import { asset } from '$app/paths';
  import SignalComms from '../../../src/ui/SignalComms.svelte';
  import { keymap } from '../../../src/ui/keymap';
  import type { UiHolo } from '../../../src/ui/comms/types';
  import { apiOf, panelOf } from './panels';
  import signalJson from '../data/generated/panels/signal.json';
  import holoMeta from '../data/guide-shots/signal__stills.json';

  // The game's own Incoming signal window (src/ui/SignalComms.svelte) on a signal recorded from a headless game (the `signal` recipe in
  // scripts/panel-recipes.ts): the pirate skiff's story, hailed and scanned. The caller's portrait and the ship's hologram are drawn by the
  // renderer, which can't run here, so they are stills the capture made of this very caller (scripts/signal-stills.mjs) and the window asks for them
  // where it would ask the renderer.
  const { story } = panelOf('signal', signalJson);
  // The recorded call has the bad-link stutter (a story tell); a page that sits still shouldn't jitter, so the wiki holds the picture steady.
  const active = { ...story.active!, comms: { ...story.active!.comms!, stutter: false } };
  const holo: UiHolo = { ...holoMeta, url: asset('/guides/signal/holo.webp' as Parameters<typeof asset>[0]) };
  const portrait = asset('/guides/signal/portrait.webp' as Parameters<typeof asset>[0]);
  const api = apiOf({}, { lookPortrait: () => portrait, shipHolo: () => Promise.resolve(holo) });
  const none = (): void => {};
</script>

<SignalComms {api} {active} busy={false} pick={none} binds={keymap.get()} />
