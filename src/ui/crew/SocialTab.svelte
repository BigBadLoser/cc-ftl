<script lang="ts">
  import type { UiApi, UiCrew } from '../api';
  import type { UiCrewDetail, UiSocialRow } from '../crewDetailApi';
  import BondCard from './BondCard.svelte';
  import BondRow from './BondRow.svelte';
  import SectionBand from './SectionBand.svelte';
  import { folded, signed, toggleSection, type SocialSection } from './socialFormat';

  /** The crew Social tab: Friends, Rivals and the rest of the crew as foldable sections of slim rows, one of which opens into a card. */
  let { api, c, d }: { api: UiApi; c: UiCrew; d: UiCrewDetail | null } = $props();
  let openId = $state(0);
  // A different selection starts with everything closed.
  const crewId = $derived(c.id);
  $effect(() => { void crewId; openId = 0; });
  const s = $derived(d?.social ?? null);
  const sections = $derived<{ key: SocialSection; title: string; rows: UiSocialRow[]; cap: number; tone: 'friend' | 'rival' | 'plain' }[]>(s ? [
    { key: 'friends', title: 'Friends', rows: s.friends, cap: s.caps.friends, tone: 'friend' },
    { key: 'rivals', title: 'Rivals', rows: s.rivals, cap: s.caps.rivals, tone: 'rival' },
    { key: 'crew', title: 'Crew', rows: s.crew, cap: 0, tone: 'plain' },
  ] : []);
</script>

<div class="social" data-testid="crew-social">
  {#if s}
    <div class="list">
      {#each sections as sec (sec.key)}
        <SectionBand title={sec.title} open={!$folded[sec.key]} onToggle={() => toggleSection(sec.key)} used={sec.rows.length} cap={sec.cap} count={sec.rows.length} tone={sec.tone} testId="social-{sec.key}" />
        {#if !$folded[sec.key]}
          {#each sec.rows as row (row.id)}
            {#if openId === row.id}<BondCard {api} {row} onToggle={() => (openId = 0)} />{:else}<BondRow {api} {row} open={false} onToggle={() => (openId = row.id)} />{/if}
          {:else}<p class="none">Nobody yet.</p>{/each}
        {/if}
      {/each}
    </div>
    <p class="mood" data-testid="social-mood">Mood from people:
      {#each s.moodLine as m, i (i)}{i ? ' · ' : ' '}<b class="it">{m.who} nearby {signed(m.value)}</b>{:else} <span class="dim">nobody close by</span>{/each}</p>
  {/if}
</div>

<style>
  .list { max-height: min(560px, calc(100vh - 380px)); overflow-y: auto; }
  .none { margin: 2px 0 6px 10px; color: var(--dim); font-size: 13px; }
  /* Docked at the foot of the window, edge to edge like the tab strip (the body pads 10px); the list scrolls above it. */
  .mood { margin: 10px -10px -10px; padding: 9px 12px; background: var(--band); border-top: 1px solid var(--line); color: var(--dim); font-size: 14px; }
  .it { white-space: nowrap; }
  .mood b { color: var(--text); font-weight: 400; }
</style>
