<script lang="ts">
  import type { UiApi } from '../api';
  import type { UiSocialRow } from '../crewDetailApi';
  import DivergingBar from './DivergingBar.svelte';
  import Icon from '../Icon.svelte';
  import Face from './Face.svelte';
  import { ago } from './socialFormat';

  /** An open bond card: summary, both opinions, the merged history and what the bond does now. */
  let { api, row, onToggle }: { api: UiApi; row: UiSocialRow; onToggle: () => void } = $props();
  const whoOf = (w: 'me' | 'them' | 'both'): string => (w === 'me' ? row.myName : w === 'them' ? row.name : 'both');
</script>

<div class="card {row.section}" data-testid="bond-card">
  <button class="head" aria-expanded="true" onclick={onToggle}>
    <Face {api} id={row.id} size={36} />
    <span class="who"><span><b>{row.name}</b>{#if row.tag} <span class="tag" class:one={row.tag === 'one-sided'}>{row.tag}</span>{/if}</span><span class="sum" data-testid="bond-summary">{row.summary}</span></span>
    <span class="car">▴</span>
  </button>
  <div class="feel">
    <span>How {row.myName} feels</span><DivergingBar value={row.mine} label="{row.myName} thinks of {row.name}" />
    <span>How {row.name} feels</span><DivergingBar value={row.theirs} label="{row.name} thinks of {row.myName}" />
  </div>
  {#if row.history.length}
    <h4>History</h4>
    <ul class="hist" data-testid="bond-history">
      {#each row.history as h, i (i)}
        <li><i class="sq" class:bad={!h.good}></i><span class="w">{whoOf(h.who)}</span><span class="tx">{h.text}</span><span class="ago">{ago(h.agoSec)}</span></li>
      {/each}
    </ul>
  {/if}
  {#if row.effects.length}
    <h4>Effects</h4>
    <div class="fx" data-testid="bond-effects">{#each row.effects as e (e.text)}<span class="chip" class:bad={!e.good}>{e.text}</span>{/each}</div>
  {/if}
  {#if row.behaviours.length}
    <ul class="beh" data-testid="bond-behaviours">{#each row.behaviours as b (b.text)}<li><Icon name={b.icon} size={14} />{b.text}</li>{/each}</ul>
  {/if}
</div>

<style>
  .card { margin-bottom: 4px; background: #0a1522; border: 1px solid var(--line-hi); border-left: 3px solid var(--dim); padding: 0 0 8px; }
  .card.friends { border-left-color: var(--green); }
  .card.rivals { border-left-color: var(--red); }
  .head { display: flex; align-items: center; gap: 8px; width: 100%; padding: 8px; background: none; border: 0; border-bottom: 1px solid var(--line); color: var(--text); text-align: left; }
  .who { display: grid; gap: 2px; flex: 1; font-size: 14px; }
  b { font-weight: 600; }
  .tag { font-size: 12px; color: var(--dim); }
  .tag.one { color: var(--amber); }
  .sum { color: var(--dim); font-size: 13px; }
  .car { color: var(--dim); font-size: 11px; }
  .feel { display: grid; grid-template-columns: auto 1fr; gap: 6px 12px; align-items: center; padding: 8px 10px 2px; font-size: 13px; }
  h4 { margin: 10px 10px 4px; color: var(--dim); font: 600 11px var(--head-font); letter-spacing: 0.08em; text-transform: uppercase; }
  .hist { list-style: none; margin: 0; padding: 0 10px; display: grid; gap: 4px; font-size: 13px; }
  .hist li { display: grid; grid-template-columns: 8px 44px 1fr auto; gap: 6px; align-items: baseline; }
  .sq { width: 8px; height: 8px; background: var(--green); align-self: center; }
  .sq.bad { background: var(--red); }
  .w { color: var(--dim); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ago { color: var(--dim); font-size: 12px; white-space: nowrap; }
  .fx { display: flex; flex-wrap: wrap; gap: 4px; padding: 0 10px; }
  .beh { list-style: none; margin: 8px 0 0; padding: 0 10px; display: grid; gap: 3px; color: var(--dim); font-size: 13px; }
  .beh li { display: flex; gap: 6px; align-items: center; }
  .chip { padding: 3px 8px; border: 1px solid var(--green); background: #0c2218; color: var(--text); font-size: 13px; }
  .chip.bad { border-color: var(--red); background: #221012; }
</style>
