<script lang="ts">
  import { resolve } from '$app/paths';
  import { entries, entryOf } from './game-data';

  // A table of modules straight from the game's content. `ids` picks modules in order; otherwise `where` filters
  // ('power': supplies or draws power) and `sort` orders by a field, then name.
  type Column = { field: string; label: string; signed?: boolean };
  let { ids, where, sort, columns }: { ids?: string[]; where?: 'power'; sort?: string; columns: Column[] } = $props();

  const rows = $derived.by(() => {
    const list = ids ? ids.map((id) => [id, entryOf('modules', id)] as const) : entries('modules');
    const kept = list.filter(([, m]) => where !== 'power' || (typeof m.power === 'number' && m.power !== 0));
    const key = (v: unknown) => (typeof v === 'number' ? v : Number.POSITIVE_INFINITY);
    return ids || !sort ? kept : [...kept].sort(([, a], [, b]) => key(a[sort]) - key(b[sort]) || a.name.localeCompare(b.name));
  });
  const cell = (value: unknown, signed?: boolean) =>
    value === undefined ? '—' : (signed && typeof value === 'number' && value > 0 ? '+' : '') + String(value);
</script>

<table class="wiki-module-table">
  <thead><tr><th>Module</th>{#each columns as c (c.field)}<th>{c.label}</th>{/each}</tr></thead>
  <tbody>
    {#each rows as [id, m] (id)}
      <tr>
        <td><a href={resolve('reference/modules/') + m.slug + '/'}>{m.name}</a></td>
        {#each columns as c (c.field)}<td class="num">{cell(m[c.field], c.signed)}</td>{/each}
      </tr>
    {/each}
  </tbody>
</table>

<style>
  .num { text-align: right; font-variant-numeric: tabular-nums; }
</style>
