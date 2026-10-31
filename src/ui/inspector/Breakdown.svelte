<script lang="ts">
  import type { BreakdownRow } from './blocks';
  /**
   * A signed-modifier breakdown: a base, then each term with its sign and size (points or a factor) in green when it helps
   * and red when it hurts, then the total. `inline` packs it into one wrapped line of terms (skill and stat rows).
   */
  let { base, rows, total, inline = false, invert = false, note, testId }: {
    base?: { label: string; value: number | string }; rows: BreakdownRow[]; total?: { label: string; value: number | string };
    inline?: boolean; invert?: boolean; note?: string; testId?: string;
  } = $props();
  const text = (r: BreakdownRow) => (r.op === 'mul' ? `x${Math.round(r.value * 100) / 100}` : `${r.value >= 0 ? '+' : '−'}${Math.abs(r.value)}`);
  const good = (r: BreakdownRow) => ((r.op === 'mul' ? r.value > 1 : r.value > 0) !== invert);
  const flat = (r: BreakdownRow) => (r.op === 'mul' ? r.value === 1 : r.value === 0);
</script>

{#if inline}
  <span class="in" data-testid={testId}>
    {#if base}<span class="b">{base.value} {base.label}</span>{/if}
    {#each rows as r, i (i)}<span class:pos={good(r) && !flat(r)} class:neg={!good(r) && !flat(r)}>{text(r)} {r.label}</span>{/each}
    {#if note}<span class="note">{note}</span>{/if}
  </span>
{:else}
  <ul class="list" data-testid={testId}>
    {#if base}<li class="b"><span>{base.label}</span><b>{base.value}</b></li>{/if}
    {#each rows as r, i (i)}
      <li class:pos={good(r) && !flat(r)} class:neg={!good(r) && !flat(r)}><span>{r.label}{#if r.tag}<i>{r.tag}</i>{/if}</span><b>{text(r)}</b></li>
    {/each}
    {#if total}<li class="t"><span>{total.label}</span><b>{total.value}</b></li>{/if}
    {#if note}<li class="note"><span>{note}</span></li>{/if}
  </ul>
{/if}

<style>
  .in { display: flex; flex-wrap: wrap; gap: 3px 8px; font-size: 11px; color: var(--dim); }
  .in .b { color: #c9ced3; }
  .in .note { margin-left: auto; }
  .list { list-style: none; margin: 0; padding: 0; display: grid; gap: 1px; font-size: 13px; }
  .list li { display: flex; justify-content: space-between; gap: 8px; padding: 2px 6px; background: var(--panel-2); }
  .list b { font-weight: 600; min-width: 36px; text-align: right; }
  .list li.b { color: var(--text); }
  .list li.t { margin-top: 2px; border-top: 1px solid var(--line-hi); background: var(--panel-3); color: #fff; font-weight: 600; }
  .list li.note { background: none; color: var(--dim); font-size: 11px; }
  .pos { color: #9fe0a8; } .neg { color: #ff9a9a; }
  i { margin-left: 6px; font: 600 10px var(--head-font); font-style: normal; text-transform: uppercase; letter-spacing: 0.05em; color: var(--cyan); }
</style>
