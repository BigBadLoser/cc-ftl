<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi, UiStory } from './api';
  import { Dialog } from './kit';
  import Icon from './Icon.svelte';
  import ItemIcon from './ItemIcon.svelte';

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
    {#each active.intel as it, i (i)}
      <section class="intel {it.kind}" data-testid="story-intel" data-kind={it.kind}>
        <header><Icon name={it.kind === 'scan' ? 'target' : 'hail'} size={14} /><span class="tag">{it.kind === 'scan' ? 'Scan' : 'Hail answered'}</span><b>{it.ship}</b></header>
        {#if it.rows.length}<dl>{#each it.rows as r (r.label)}<dt>{r.label}</dt><dd>{r.value}</dd>{/each}</dl>{/if}
        {#if it.quote}<p class="quote">"{it.quote}"</p>{/if}
        {#if it.stock?.length || it.credits !== undefined}
          <div class="stock">
            {#each it.stock ?? [] as q (q.item)}<span class="chip" title={q.name}><ItemIcon {api} item={q.item} size={20} />{q.name}<em>×{q.count}</em></span>{/each}
            {#if it.credits !== undefined}<span class="chip cr" title="Credits to buy with"><Icon name="credits" size={14} />{it.credits}</span>{/if}
          </div>
        {/if}
      </section>
    {/each}
    <div class="choices">
      {#each active.choices as c (c.id)}
        <button class="choice" class:locked={!c.enabled && !c.done} class:done={c.done} disabled={!c.enabled || busy} data-testid="story-choice" data-choice={c.id} onclick={() => pick(c.id)}>
          <span class="label">{c.label}</span>
          {#if c.hint}<span class="hint">{c.hint}</span>{/if}
          {#if c.odds}<span class="odds" data-testid="story-odds">{c.odds.label}</span>{/if}
          {#if c.cost.length}<span class="cost">Costs {c.cost.join(', ')}</span>{/if}
          {#each c.reasons as r (r)}<span class="reason">{r}</span>{/each}
          {#if c.done}<span class="did"><Icon name="check" size={12} />Done</span>{/if}
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
  .chip { display: inline-flex; align-items: center; gap: 4px; padding: 1px 6px 1px 2px; font-size: 12px; background: var(--panel-3); border: 1px solid var(--line); }
  .chip em { font-style: normal; color: var(--dim); }
  .chip.cr { padding-left: 6px; color: var(--amber); }
  .choice.done:not(.locked) { background: transparent; border-style: solid; border-color: var(--line); color: var(--dim); opacity: 1; }
  .choice.done:not(.locked) .label { color: var(--dim); }
  .did { display: inline-flex; align-items: center; gap: 4px; color: var(--green); font-size: 12px; }
  .choices { display: grid; gap: 8px; }
  .choice { display: grid; gap: 2px; text-align: left; padding: 9px 12px; min-height: 44px; }
  .label { font-weight: 600; }
  .hint { color: var(--dim); font-size: 12px; }
  .odds { color: var(--ink-accent); font-size: 12px; font-weight: 600; }
  .cost { color: var(--amber); font-size: 12px; }
  .reason { color: #ff8d8d; font-size: 12px; }
  .choice:not(.locked) { border-color: var(--act-edge); }
  .choice.locked { opacity: 1; background: var(--panel-3); border-style: dashed; color: var(--dim); }
  .choice.locked .label { color: var(--dim); }
  .result { left: 50%; transform: translateX(-50%); bottom: 12px; width: min(420px, calc(100vw - 24px)); display: grid; gap: 4px; z-index: 12; touch-action: pan-y; }
  .result b { color: var(--ink-accent); }
  .chose { color: var(--dim); font-size: 12px; }
  .result .text { margin: 4px 0; }
  ul { margin: 0 0 4px; padding-left: 18px; color: var(--amber); }
  @media (max-width: 600px) {
    .result { left: 0; right: 0; transform: none; bottom: 0; width: auto; }
  }
</style>
