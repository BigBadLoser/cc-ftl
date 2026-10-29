<script lang="ts">
  import { resolve } from '$app/paths';
  import { entryOf, valueOf, type DataKind } from './game-data';

  // A number from the game's content, e.g. <Stat id="module.reactor" field="power" />. With `link`, it links to the
  // entry's reference page. `signed` prints a leading + on positive values.
  let { kind = 'modules', id, field, unit = '', signed = false, link = false }: {
    kind?: DataKind | 'tuning'; id: string; field?: string; unit?: string; signed?: boolean; link?: boolean;
  } = $props();

  const value = $derived(valueOf(kind, id, field));
  const shown = $derived((signed && typeof value === 'number' && value > 0 ? '+' : '') + String(value) + (unit ? ' ' + unit : ''));
  // resolve() only takes literal routes.
  const bases: Record<DataKind, string> = {
    modules: resolve('reference/modules/'), items: resolve('reference/items/'), weapons: resolve('reference/weapons/'),
    vehicles: resolve('reference/vehicles/'), research: resolve('reference/research/'),
  };
  const href = $derived(link && kind !== 'tuning' ? bases[kind] + entryOf(kind, id).slug + '/' : null);
</script>

{#if href}<a class="wiki-stat" {href}>{shown}</a>{:else}<span class="wiki-stat">{shown}</span>{/if}

<style>
  .wiki-stat { font-variant-numeric: tabular-nums; font-weight: 600; }
</style>
