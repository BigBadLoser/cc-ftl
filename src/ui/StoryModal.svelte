<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi, UiStory } from './api';
  import { Chip, DecisionBar, Dialog } from './kit';
  import { storyOptions } from './storyOptions';
  import Icon from './Icon.svelte';
  import ItemIcon from './ItemIcon.svelte';
  import SignalWindow from './SignalWindow.svelte';

  /** `hold` keeps popups back (while the starmap animates a jump); they show once it clears. */
  let { api, hold = false }: { api: UiApi; hold?: boolean } = $props();
  let story = $state<UiStory>({ active: null, last: null });
  /** The result the player already dismissed (or that was there when the page loaded). */
  let seenTick = $state<number | null | undefined>(undefined);
  let busy = $state(false);
  /** Which choices were open: a remote action (scan, hail) keeps the decision up, and marking it done frees the other buttons again. */
  let openSig = '';

  onMount(() =>
    api.story.subscribe((s) => {
      if (seenTick === undefined) seenTick = s.last?.tick ?? null;
      const sig = s.active ? s.active.choices.map((c) => (c.enabled ? 1 : 0)).join('') : '';
      if (!s.active || sig !== openSig) busy = false;
      openSig = sig;
      story = s;
    }),
  );

  const active = $derived(story.active);
  // A choice with nothing to report (no text, no effects shown: dropping out into a scene) needs no card.
  const result = $derived(!active && story.last && story.last.tick !== seenTick && (story.last.text || story.last.lines.length) ? story.last : null);

  /** Info actions (scan, probe, hail): small buttons that fill in a readout below; not choices. */
  const remotes = $derived((active?.choices ?? []).filter((c) => c.remote));

  function pick(id: string) {
    if (busy) return;
    busy = true;
    api.chooseStory(id);
  }
</script>

{#if hold}
  <!-- held back until the jump animation ends -->
{:else if active?.comms}
  <SignalWindow {api} {active} {busy} {pick} />
{:else if active}
  <Dialog open title={active.title} dismissable={false} testId="story-modal">
    <p class="text">{active.text}</p>
    {#if remotes.length}
      <div class="remotes">
        {#each remotes as r (r.id)}
          <button class="remote" class:done={r.done} disabled={!r.enabled || busy} data-testid="story-remote" data-choice={r.id} onclick={() => pick(r.id)}>
            <Icon name={r.remote === 'scan' ? 'target' : r.remote === 'probe' ? 'target' : 'hail'} size={13} />{r.label}{#if r.done}<Icon name="check" size={12} />{/if}
          </button>
        {/each}
      </div>
    {/if}
    {#each active.intel as it, i (i)}
      <section class="intel {it.kind}" data-testid="story-intel" data-kind={it.kind}>
        <header><Icon name={it.kind === 'scan' ? 'target' : 'hail'} size={14} /><span class="tag">{it.kind === 'scan' ? 'Scan' : 'Hail answered'}</span><b>{it.ship}</b></header>
        {#if it.rows.length}<dl>{#each it.rows as r (r.label)}<dt>{r.label}</dt><dd>{r.value}</dd>{/each}</dl>{/if}
        {#if it.quote}<p class="quote">"{it.quote}"</p>{/if}
        {#if it.stock?.length || it.credits !== undefined}
          <div class="stock">
            {#each it.stock ?? [] as q (q.item)}<Chip size="md" caps={false} title={q.name}><ItemIcon {api} item={q.item} size={20} />{q.name}<em>×{q.count}</em></Chip>{/each}
            {#if it.credits !== undefined}<Chip size="md" tone="gold" icon="credits" title="Credits to buy with">{it.credits}</Chip>{/if}
          </div>
        {/if}
      </section>
    {/each}
    <div class="decide"><DecisionBar options={storyOptions(active.choices, 'story-choice')} onpick={pick} {busy} /></div>
  </Dialog>
{:else if result}
  <div class="result sheet" data-testid="story-result">
    <b>{result.title}</b>
    <span class="chose">{result.choice}{result.success === null ? '' : result.success ? ': success' : ': failed'}</span>
    {#if result.text}<p class="text">{result.text}</p>{/if}
    {#if result.lines.length}<ul>{#each result.lines as l, i (i)}<li>{l}</li>{/each}</ul>{/if}
    <button onclick={() => (seenTick = result.tick)}>Continue</button>
  </div>
{/if}

<style>
  .text { margin: 0 0 12px; color: var(--text); line-height: 1.45; }
  /* Revealed intel: a readout per ship, set off from the story text by a cyan edge (a hail's in green), like the inspector's sections. */
  .intel { margin: 0 0 10px; padding: 8px 10px; background: var(--panel-2); border: 1px solid var(--line); border-left: 2px solid var(--cyan); display: grid; gap: 6px; }
  .intel.hail { border-left-color: var(--green); }
  .intel header { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--ink-accent); }
  .intel.hail header { color: var(--green); }
  .intel .tag { font: 600 11px var(--head-font); letter-spacing: 0.08em; text-transform: uppercase; }
  .intel header b { color: var(--text); font-weight: 600; margin-left: auto; }
  dl { display: grid; grid-template-columns: auto 1fr; gap: 2px 14px; margin: 0; font-size: 13px; }
  dt { color: var(--dim); }
  dd { margin: 0; color: var(--text); }
  .quote { margin: 0; font-size: 13px; font-style: italic; color: var(--text); line-height: 1.4; }
  .stock { display: flex; flex-wrap: wrap; gap: 4px; }
  .stock em { font-style: normal; color: var(--dim); }
  .remotes { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 0 10px; }
  .remote { display: inline-flex; align-items: center; gap: 6px; min-height: 0; padding: 4px 10px; font-size: 12px; border-color: var(--act-edge); }
  .remote.done { border-color: var(--line); color: var(--dim); }
  .decide { margin: 12px -16px -16px; }
  .result { left: 50%; transform: translateX(-50%); bottom: 12px; width: min(420px, calc(100vw - 24px)); display: grid; gap: 4px; z-index: 12; touch-action: pan-y; }
  .result b { color: var(--ink-accent); }
  .chose { color: var(--dim); font-size: 12px; }
  .result .text { margin: 4px 0; }
  ul { margin: 0 0 4px; padding-left: 18px; color: var(--amber); }
  @media (max-width: 600px) {
    .result { left: 0; right: 0; transform: none; bottom: 0; width: auto; }
  }
</style>
