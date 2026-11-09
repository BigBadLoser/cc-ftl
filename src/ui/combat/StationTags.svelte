<script lang="ts">
  import { Frame, StatusTag } from '../kit';
  import type { UiCombat } from '../api';
  import { stationTags } from './stations';

  type Me = NonNullable<UiCombat['player']>;
  /** The STATIONS frame: weapons, shields, helm (manned or no crew) and engines (online or offline). */
  let { me, style = '' }: { me: Me; style?: string } = $props();
  const tags = $derived(stationTags(me.consoles, me.modules));
  const why = $derived(tags.find((t) => t.why));
</script>

<Frame title="Stations" {style}>
  <div class="tags">
    {#each tags as t (t.tag)}
      <StatusTag tag={t.tag} status={t.status} ok={t.ok} warn={t.warn} title={t.tip} />
    {/each}
  </div>
  {#if why}<div class="why" data-testid="stations-why">{why.tag}: {why.why}</div>{/if}
</Frame>

<style>
  .why { font-size: 11px; color: var(--dim); padding-top: 3px; line-height: 1.2; }
  .tags {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 5px;
    flex: 1;
    min-height: 42px;
  }
</style>
