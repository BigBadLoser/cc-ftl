<script lang="ts">
  import { resolve } from '$app/paths';
  import { entries, entryOf, type DataEntry } from './game-data';

  // A table of modules straight from the game's content. String props, because markdown pages can't pass objects:
  //   ids="module.reactor, module.reactor.mk2"   picks modules in that order; otherwise
  //   where="power" | "draw"                     keeps modules that supply or draw power / only draw it, and
  //   sort="powerPriority"                       orders by a field, then name.
  //   columns="power:Power:signed, powerPriority:Order"   field:label[:signed] per column.
  let { ids, where, sort, columns }: { ids?: string; where?: 'power' | 'draw'; sort?: string; columns: string } = $props();

  const list = (value: string) => value.split(',').map((part) => part.trim()).filter(Boolean);
  const cols = $derived(list(columns).map((spec) => {
    const [field = '', label = field, flag] = spec.split(':');
    return { field, label, signed: flag === 'signed' };
  }));
  const rows = $derived.by(() => {
    const picked = ids ? list(ids).map((id) => [id, entryOf('modules', id)] as const) : entries('modules');
    const power = (m: DataEntry) => (typeof m.power === 'number' ? m.power : 0);
    const kept = picked.filter(([, m]) => (where === 'power' ? power(m) !== 0 : where === 'draw' ? power(m) < 0 : true));
    const key = (v: unknown) => (typeof v === 'number' ? v : Number.POSITIVE_INFINITY);
    return ids || !sort ? kept : [...kept].sort(([, a], [, b]) => key(a[sort]) - key(b[sort]) || a.name.localeCompare(b.name));
  });
  const cell = (value: unknown, signed?: boolean) => {
    if (value === undefined) return '—';
    if (typeof value !== 'number') return String(value);
    return value < 0 ? '−' + -value : (signed && value > 0 ? '+' : '') + value;
  };
</script>

<table class="wiki-module-table">
  <thead><tr><th>Module</th>{#each cols as c (c.field)}<th>{c.label}</th>{/each}</tr></thead>
  <tbody>
    {#each rows as [id, m] (id)}
      <tr>
        <td><a href={resolve('reference/modules/') + m.slug + '/'}>{m.name}</a></td>
        {#each cols as c (c.field)}<td class="num">{cell(m[c.field], c.signed)}</td>{/each}
      </tr>
    {/each}
  </tbody>
</table>

<style>
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  a { color: #2c6699; text-decoration: underline; text-underline-offset: 2px; }
  :global(:root.dark) a { color: #9acff6; }
</style>
