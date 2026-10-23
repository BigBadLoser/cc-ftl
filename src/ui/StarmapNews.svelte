<script lang="ts">
  /**
   * The news and rumours panel of the starmap: what the world did lately, newest first. News inside the ship's sensor range names ships and places;
   * anything farther is a rumour (factions and the region only, dimmed).
   */
  import Icon from './Icon.svelte';
  import PanelHead from './PanelHead.svelte';
  import type { UiNews } from './starmapApi';
  import { toneColor } from './starmapStyle';

  let { news, turn, onClose }: { news: UiNews[]; turn: number; onClose: () => void } = $props();
  const age = (n: UiNews): string => (turn - n.turn <= 0 ? 'now' : `${turn - n.turn} turn${turn - n.turn > 1 ? 's' : ''} ago`);
</script>

<aside class="sheet news" data-testid="starmap-news">
  <PanelHead icon="list" title="News" sub={news.length ? `${news.length} recent` : 'quiet'} onBack={onClose} backIcon="close" backTitle="Close news" backTestId="starmap-news-close" />
  {#if news.length}
    <ul>
      {#each news as n (n.id)}
        <li class:rumour={n.rumour} data-testid="starmap-news-item">
          <span class="ic" style={`color: ${toneColor(n.tone)}`}><Icon name={n.icon} size={16} /></span>
          <span class="tx">{#if n.rumour}<em>Rumour</em> {/if}{n.text}</span>
          <small>{age(n)} · {n.place}</small>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="dim">Nothing has happened that you have heard of.</p>
  {/if}
</aside>

<style>
  .news { position: absolute; z-index: 12; display: grid; gap: 6px; align-content: start; overflow-y: auto; box-sizing: border-box; }
  ul { margin: 0; padding: 0; list-style: none; display: grid; gap: 2px; }
  li { display: grid; grid-template-columns: auto 1fr; column-gap: 8px; row-gap: 1px; align-items: start; padding: 4px 8px; background: var(--panel-2); border: 1px solid var(--line); font-size: 13px; }
  li.rumour { color: var(--dim); }
  li.rumour .tx { font-style: italic; }
  .ic { display: inline-flex; padding-top: 1px; }
  .tx em { font: 600 11px var(--head-font); letter-spacing: 0.08em; text-transform: uppercase; font-style: normal; color: var(--amber); margin-right: 6px; }
  small { grid-column: 2; color: var(--dim); font-size: 11px; }
  .dim { color: var(--dim); margin: 0; font-size: 13px; }
  @media (min-width: 601px) { .news { left: 8px; top: 54px; bottom: auto; right: auto; width: 280px; max-height: min(46%, 420px); } }
  @media (max-width: 600px) { .news { left: 0; right: 0; bottom: 0; max-height: 42%; } }
</style>
