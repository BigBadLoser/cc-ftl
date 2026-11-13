<script lang="ts">
  import type { UiApi, UiStory } from './api';
  import { Chip } from './kit';
  import ItemIcon from './ItemIcon.svelte';
  import CommsWindow from './comms/CommsWindow.svelte';
  import PaneHeader from './comms/PaneHeader.svelte';
  import VideoFeed from './comms/VideoFeed.svelte';
  import CallerCard from './comms/CallerCard.svelte';
  import Transcript from './comms/Transcript.svelte';
  import SensorPanel from './comms/SensorPanel.svelte';
  import { DecisionBar } from './kit';
  import { storyOptions } from './storyOptions';
  import type { Callout, ReadoutRow, UiHolo } from './comms/types';
  import { keyLabel, type Bindings } from './keymap';

  /**
   * The incoming-signal window's contents (SignalWindow puts them in a modal, the wiki shows them on a page): the comms pieces (src/ui/comms) composed for a story signal. It only wires the story's data to them: the hail and
   * scan buttons are the story's remote choices, the footer holds its other choices, and the portrait and ship picture are fetched from the api.
   */
  let { api, active, busy, pick, binds }: { api: UiApi; active: NonNullable<UiStory['active']>; busy: boolean; pick: (id: string) => void; binds: Bindings } = $props();
  const c = $derived(active.comms!);

  let face = $state<string | null>(null);
  $effect(() => {
    const look = c.look;
    face = null;
    if (!look) return;
    const t = setInterval(() => {
      const f = api.lookPortrait(look);
      if (f) { face = f; clearInterval(t); }
    }, 120);
    return () => clearInterval(t);
  });

  let holo = $state<UiHolo | null>(null);
  let holoDone = $state(false);
  // The ship is drawn in the background from the moment the window opens, so the scan shows it at once.
  $effect(() => {
    const req = c.holo;
    holo = null;
    holoDone = false;
    if (!req) return;
    let live = true;
    const t = setTimeout(() => void api.shipHolo(req).then((h) => { if (live) { holo = h; holoDone = true; } }), 250);
    return () => { live = false; clearTimeout(t); };
  });

  /** Callouts the picture has an anchor for are pinned; the others fall back into the readout. */
  const pinned = $derived.by(() => {
    const out: Callout[] = [];
    const loose: ReadoutRow[] = [];
    for (const k of c.callouts) {
      const at = holo?.anchors[k.id];
      if (at) out.push({ ...k, at });
      else loose.push({ label: k.label, value: k.value, wide: true });
    }
    return { out, loose };
  });
  const readout = $derived([...c.readout.slice(0, 1), ...pinned.loose, ...c.readout.slice(1)]);

  const decisions = $derived(storyOptions(active.choices));
  /** A call with no scene ship (a checkpoint cutter) has nothing to scan. */
  const hasSensors = $derived(!!c.holo || !!c.scanChoice || c.scanned);

</script>

{#snippet videoCol()}
  <PaneHeader label="Video" done={c.hailed ? 'CONNECTED' : undefined} />
  <div class="col">
    <VideoFeed src={c.hailed ? face : null} stutter={c.stutter} />
    {#if c.caller}<CallerCard caller={c.caller} />{/if}
  </div>
{/snippet}
{#snippet commsCol()}
  <PaneHeader label="Comms" />
  <div class="col scroll">
    <Transcript lines={c.transcript} hint={c.hint}>
      {#if c.hailed && (c.goods.length || c.credits !== undefined)}
        <div class="stock">
          {#each c.goods as q (q.item)}<Chip size="md" caps={false} title={q.name}><ItemIcon {api} item={q.item} size={20} />{q.name}<em>×{q.count}</em></Chip>{/each}
          {#if c.credits !== undefined}<Chip size="md" tone="gold" icon="credits" title="Credits to buy with">{c.credits}</Chip>{/if}
        </div>
      {/if}
    </Transcript>
  </div>
{/snippet}
{#snippet sensorsCol()}
  <PaneHeader label="Sensors" done={c.scanned ? 'SCANNED' : undefined} action={c.scanChoice ? { label: (c.scanKind ?? 'scan').toUpperCase(), key: keyLabel(binds, 'ui.scan'), onclick: () => pick(c.scanChoice!), disabled: busy } : undefined} testId="signal-scan" />
  <SensorPanel scanned={c.scanned} {holo} pending={!!c.holo && !holoDone} title={c.hullTitle ?? undefined} callouts={pinned.out} {readout} hint={c.scanHint} />
{/snippet}
{#snippet decisionBar()}
  <DecisionBar options={decisions} onpick={pick} {busy} />
{/snippet}

<CommsWindow title="Incoming signal" subtitle={active.title} video={c.caller ? videoCol : undefined} comms={commsCol} sensors={hasSensors ? sensorsCol : undefined} footer={decisionBar} />

<style>
  .col { padding: 12px; display: grid; gap: 12px; align-content: start; }
  .scroll { max-height: 420px; overflow-y: auto; }
  .stock { display: flex; flex-wrap: wrap; gap: 4px; }
  .stock em { font-style: normal; color: var(--dim); }
</style>
