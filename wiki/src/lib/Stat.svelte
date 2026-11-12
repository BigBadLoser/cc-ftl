<script lang="ts">
  import { resolve } from '$app/paths';
  import { entryOf, valueOf, type DataKind } from './game-data';

  // A number from the game's content, e.g. <Stat id="module.reactor" field="power" />. With `link`, it links to the
  // entry's reference page. `signed` prints a leading + on positive values. Shaping, applied in this order:
  // `index` picks from a number array, `scale` multiplies (e.g. 1/60 for ticks to seconds), `percent` shows a fraction
  // as a percentage (0.4 -> 40%), `round` sets decimal places (default: up to 2 when shaped).
  let { kind = 'modules', id, field, unit = '', signed = false, link = false, index, scale, percent = false, round }: {
    kind?: DataKind | 'tuning'; id: string; field?: string; unit?: string; signed?: boolean; link?: boolean;
    index?: number; scale?: number; percent?: boolean; round?: number;
  } = $props();

  const value = $derived.by(() => {
    let v = valueOf(kind, id, field);
    if (index !== undefined) {
      if (!Array.isArray(v) || v[index] === undefined) throw Error(`Guide index ${index} out of range for ${kind} ${id} ${field ?? ''}`);
      v = v[index];
    }
    if (scale === undefined && !percent && round === undefined) return v;
    if (typeof v !== 'number') throw Error(`Guide shapes a non-number: ${kind} ${id} ${field ?? ''}`);
    const n = v * (scale ?? 1) * (percent ? 100 : 1);
    const places = round ?? 2;
    return (Number(n.toFixed(places)) + (percent ? '%' : ''));
  });
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
