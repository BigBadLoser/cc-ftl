<script lang="ts">
  import { Frame, StatusTag } from '../kit';
  import type { UiCombat } from '../api';
  import { stationTags } from './stations';

  type Me = NonNullable<UiCombat['player']>;
  /** The STATIONS frame: weapons, shields, helm (manned or no crew) and engines (online or offline). */
  let { me, style = '' }: { me: Me; style?: string } = $props();
  const tags = $derived(stationTags(me.consoles, me.modules));
</script>

<Frame title="Stations" {style}>
  <div class="tags">
    {#each tags as t (t.tag)}
      <StatusTag tag={t.tag} status={t.status} ok={t.ok} title={t.tip} />
    {/each}
  </div>
</Frame>

<style>
  .tags {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 5px;
    height: 42px;
  }
</style>
