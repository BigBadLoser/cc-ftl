<script lang="ts">
  import type { Card } from './blocks';

  /** An item's stats card (on hover of a slot): a title bar with the name and kind, stat rows, then value under a rule, then flavour. */
  let { card }: { card: Card } = $props();
</script>

<div class="card" data-testid="item-card">
  <div class="ph"><span class="t">{card.title}</span><small>{card.sub}</small></div>
  <div class="b">
    {#each card.rows as r (r.label)}
      <div class="r"><span class="l">{r.label}</span><span>{r.value}{#if r.note} <small>{r.note}</small>{/if}{#if r.extra} <small class:pos={r.extra.good} class:neg={!r.extra.good}>{r.extra.text}</small>{/if}</span></div>
    {/each}
    {#if card.foot.length}<hr />{/if}
    {#each card.foot as r (r.label)}
      <div class="r"><span class="l">{r.label}</span><span>{r.value}{#if r.note} <small>{r.note}</small>{/if}</span></div>
    {/each}
    {#if card.flavour}<p><i>{card.flavour}</i></p>{/if}
  </div>
</div>

<style>
  .card { width: 310px; background: var(--panel); border: 1px solid var(--cyan); box-shadow: 0 6px 20px rgba(0, 0, 0, 0.6); text-align: left; }
  .ph { display: flex; align-items: center; gap: 8px; margin: 0; min-height: 28px; padding: 0 10px; }
  .ph .t { flex: 1; }
  .ph small { font: 12px var(--head-font); color: var(--dim); letter-spacing: 0.05em; }
  .b { padding: 8px 10px; }
  .r { display: grid; grid-template-columns: 84px 1fr; white-space: nowrap; gap: 8px; align-items: center; min-height: 20px; font-size: 12px; color: var(--text); }
  .l { color: var(--dim); }
  small { margin-left: 4px; font-size: 11px; color: var(--dim); }
  small.pos { color: #9fe0a8; } small.neg { color: #ff9a9a; }
  hr { border: 0; border-top: 1px solid var(--line); margin: 6px 0; }
  p { margin: 6px 0 0; font-size: 11px; color: var(--dim); }
</style>
