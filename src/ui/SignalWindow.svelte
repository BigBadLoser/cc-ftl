<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi, UiStory } from './api';
  import { Dialog } from './kit';
  import ItemIcon from './ItemIcon.svelte';
  import Icon from './Icon.svelte';
  import CommsWindow from './comms/CommsWindow.svelte';
  import PaneHeader from './comms/PaneHeader.svelte';
  import VideoFeed from './comms/VideoFeed.svelte';
  import CallerCard from './comms/CallerCard.svelte';
  import Transcript from './comms/Transcript.svelte';
  import SensorPanel from './comms/SensorPanel.svelte';
  import DecisionBar from './comms/DecisionBar.svelte';
  import type { Callout, DecisionOption, ReadoutRow, UiHolo } from './comms/types';
  import { isTypingTarget } from './keys';

  /**
   * The incoming-signal window: the comms pieces (src/ui/comms) composed for a story signal. It only wires the story's data to them: the hail and
   * scan buttons are the story's remote choices, the footer holds its other choices, and the portrait and ship picture are fetched from the api.
   */
  let { api, active, busy, pick }: { api: UiApi; active: NonNullable<UiStory['active']>; busy: boolean; pick: (id: string) => void } = $props();
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

  const decisions = $derived<DecisionOption[]>(active.choices.filter((x) => !x.remote).map((x, i) => ({
    id: x.id, label: x.label, primary: i === 0, disabled: !x.enabled,
    note: [x.hint, x.odds?.label, x.cost.length ? `Costs ${x.cost.join(', ')}` : ''].filter(Boolean).join(' · ') || undefined,
    ...(x.reasons.length ? { reason: x.reasons.join('. ') } : {}),
  })));

  function keydown(e: KeyboardEvent) {
    if (busy || e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e)) return;
    const k = e.key.toLowerCase();
    if (k === 'h' && c.hailChoice) { e.preventDefault(); pick(c.hailChoice); }
    else if (k === 's' && c.scanChoice) { e.preventDefault(); pick(c.scanChoice); }
  }
  onMount(() => {
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  });
</script>

{#snippet videoCol()}
  <PaneHeader label="Video" done={c.hailed ? 'CONNECTED' : undefined} action={c.hailChoice ? { label: 'HAIL', key: 'H', onclick: () => pick(c.hailChoice!), disabled: busy } : undefined} testId="signal-hail" />
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
          {#each c.goods as q (q.item)}<span class="chip" title={q.name}><ItemIcon {api} item={q.item} size={20} />{q.name}<em>×{q.count}</em></span>{/each}
          {#if c.credits !== undefined}<span class="chip cr" title="Credits to buy with"><Icon name="credits" size={14} />{c.credits}</span>{/if}
        </div>
      {/if}
    </Transcript>
  </div>
{/snippet}
{#snippet sensorsCol()}
  <PaneHeader label="Sensors" done={c.scanned ? 'SCANNED' : undefined} action={c.scanChoice ? { label: 'SCAN', key: 'S', onclick: () => pick(c.scanChoice!), disabled: busy } : undefined} testId="signal-scan" />
  <SensorPanel scanned={c.scanned} {holo} pending={!!c.holo && !holoDone} title={c.hullTitle ?? undefined} callouts={pinned.out} {readout} hint={c.scanHint} />
{/snippet}
{#snippet decisionBar()}
  <DecisionBar options={decisions} onpick={pick} {busy} />
{/snippet}

<Dialog open title={active.title} dismissable={false} testId="story-modal" bare>
  <!-- A scene with no ship (a derelict) has no one to call: the video column goes. -->
  <CommsWindow title="Incoming signal" subtitle={active.title} video={c.caller ? videoCol : undefined} comms={commsCol} sensors={sensorsCol} footer={decisionBar} />
</Dialog>

<style>
  .col { padding: 12px; display: grid; gap: 12px; align-content: start; }
  .scroll { max-height: 420px; overflow-y: auto; }
  .stock { display: flex; flex-wrap: wrap; gap: 4px; }
  .chip { display: inline-flex; align-items: center; gap: 4px; padding: 1px 6px 1px 2px; font-size: 12px; background: var(--panel-3); border: 1px solid var(--line); }
  .chip em { font-style: normal; color: var(--dim); }
  .chip.cr { padding-left: 6px; color: var(--amber); }
</style>
