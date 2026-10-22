<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi, UiStory } from './api';
  import { Dialog } from './kit';

  /** `hold` keeps popups back (while the starmap animates a jump); they show once it clears. */
  let { api, hold = false }: { api: UiApi; hold?: boolean } = $props();
  let story = $state<UiStory>({ active: null, last: null });
  /** The result the player already dismissed (or that was there when the page loaded). */
  let seenTick = $state<number | null | undefined>(undefined);
  let busy = $state(false);

  onMount(() =>
    api.story.subscribe((s) => {
      if (seenTick === undefined) seenTick = s.last?.tick ?? null;
      if (!s.active) busy = false;
      story = s;
    }),
  );

  const active = $derived(story.active);
  const result = $derived(!active && story.last && story.last.tick !== seenTick ? story.last : null);

  function pick(id: string) {
    if (busy) return;
    busy = true;
    api.chooseStory(id);
  }
</script>

{#if hold}
  <!-- held back until the jump animation ends -->
{:else if active}
  <Dialog open title={active.title} dismissable={false} testId="story-modal">
    <p class="text">{active.text}</p>
    <div class="choices">
      {#each active.choices as c (c.id)}
        <button class="choice" class:locked={!c.enabled} disabled={!c.enabled || busy} data-testid="story-choice" data-choice={c.id} onclick={() => pick(c.id)}>
          <span class="label">{c.label}</span>
          {#if c.hint}<span class="hint">{c.hint}</span>{/if}
          {#if c.odds}<span class="odds" data-testid="story-odds">{c.odds.label}</span>{/if}
          {#if c.cost.length}<span class="cost">Costs {c.cost.join(', ')}</span>{/if}
          {#each c.reasons as r (r)}<span class="reason">{r}</span>{/each}
        </button>
      {/each}
    </div>
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
  .choices { display: grid; gap: 8px; }
  .choice { display: grid; gap: 2px; text-align: left; padding: 9px 12px; min-height: 44px; }
  .label { font-weight: 600; }
  .hint { color: var(--dim); font-size: 12px; }
  .odds { color: var(--cyan); font-size: 12px; font-weight: 600; }
  .cost { color: var(--amber); font-size: 12px; }
  .reason { color: #ff8d8d; font-size: 12px; }
  .choice.locked { opacity: 1; background: #141b28; border-style: dashed; color: var(--dim); }
  .choice.locked .label { color: #7a8aa3; }
  .result { left: 50%; transform: translateX(-50%); bottom: 12px; width: min(420px, calc(100vw - 24px)); display: grid; gap: 4px; z-index: 12; touch-action: pan-y; }
  .result b { color: var(--cyan); }
  .chose { color: var(--dim); font-size: 12px; }
  .result .text { margin: 4px 0; }
  ul { margin: 0 0 4px; padding-left: 18px; color: var(--amber); }
  @media (max-width: 600px) {
    .result { left: 0; right: 0; transform: none; bottom: 0; width: auto; }
  }
</style>
