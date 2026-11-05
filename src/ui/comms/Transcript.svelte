<script lang="ts">
  import type { Snippet } from 'svelte';
  import FlickerText from './FlickerText.svelte';
  import type { CommsLine } from './types';

  /**
   * The comms log: narration in grey italics, and each quoted line behind a cyan bar with its speaker's name (which flickers to `speakerAlt` if set).
   * Takes `lines`, an optional dim `hint` under them, and `force` to hold the flicker for stills. Children render after the lines (goods, say).
   */
  let { lines, hint, force = false, children }: { lines: CommsLine[]; hint?: string | null; force?: boolean; children?: Snippet } = $props();
</script>

<div class="log" data-testid="comms-transcript">
  {#each lines as l, i (i)}
    {#if l.kind === 'narration'}
      <p class="nar">{l.text}</p>
    {:else}
      <div class="q">
        {#if l.speaker}<span class="sp"><FlickerText value={l.speaker} alt={l.speakerAlt ?? null} {force} /></span>{/if}
        “{l.text}”
      </div>
    {/if}
  {/each}
  {#if children}{@render children()}{/if}
  {#if hint}<p class="hint">{hint}</p>{/if}
</div>

<style>
  .log { display: grid; gap: 8px; align-content: start; }
  .nar { margin: 0; color: #b9c1c8; font-style: italic; }
  .q { padding-left: 10px; border-left: 2px solid var(--cyan); color: var(--text); line-height: 1.4; }
  .sp { display: block; font: 600 11px var(--head-font); letter-spacing: 0.12em; text-transform: uppercase; color: var(--cyan); margin-bottom: 1px; }
  .hint { margin: 4px 0 0; color: var(--dim); font-size: 12.5px; font-style: italic; }
</style>
