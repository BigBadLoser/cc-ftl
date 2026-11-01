<script lang="ts">
  import type { BreakdownRow } from './blocks';

  /**
   * A signed-modifier breakdown on the inspector grid: a base, then each term with its sign and size (points or a factor),
   * green when it helps and red when it hurts, then the total; values sit in the `--ins-value` column. `inline` packs it into
   * one line of plain small text (skill and stat rows).
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
  <span class="in" data-testid={testId}>{[...(base ? [`${base.value} ${base.label}`] : []), ...rows.map((r) => `${text(r)} ${r.label}`), ...(note ? [note] : [])].join(' \u00b7 ')}</span>
{:else}
  <ul class="list" data-testid={testId}>
    {#if base}<li><span>{base.label}</span><b>{base.value}</b></li>{/if}
    {#each rows as r, i (i)}
      <li class:pos={good(r) && !flat(r)} class:neg={!good(r) && !flat(r)}><span>{r.label}{#if r.tag} <small>({r.tag})</small>{/if}</span><b>{text(r)}</b></li>
    {/each}
    {#if total}<li class="t"><span>{total.label}</span><b>{total.value}</b></li>{/if}
    {#if note}<li class="note"><span>{note}</span></li>{/if}
  </ul>
{/if}

<style>
  .in { font-size: 11px; color: var(--dim); }
  .list { list-style: none; margin: 0; padding: 0; display: grid; }
  .list li { display: grid; grid-template-columns: 1fr var(--ins-value, 80px); gap: 10px; align-items: center; min-height: 24px; font-size: 13px; color: var(--text); border-bottom: 1px solid var(--panel-3); }
  .list b { font-weight: 400; text-align: right; }
  .list li.t { border-bottom: 0; border-top: 1px solid var(--line-hi); font-weight: 600; }
  .list li.t b { font-weight: 600; }
  .list li.note { display: block; border: 0; color: var(--dim); font-size: 11px; min-height: 0; padding-top: 4px; }
  .pos { color: #9fe0a8 !important; } .neg { color: #ff9a9a !important; }
  small { margin-left: 4px; font-size: 11px; color: var(--dim); }
</style>
