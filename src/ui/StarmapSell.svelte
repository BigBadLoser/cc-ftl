<script lang="ts">
  /**
   * Where to sell (issue #222): every good aboard that markets trade, with the known ports in sensor range that pay most for it now, dearest
   * first, and the jumps to each. A row picks its node on the map (the drawer then plots the route). Prices follow each port's stock, so they
   * move as ships trade.
   */
  import Icon from './Icon.svelte';
  import PanelHead from './PanelHead.svelte';
  import type { UiSellGood } from './starmapApi';

  let { goods, current, onPick, onClose }: { goods: UiSellGood[]; current: string; onPick: (node: string) => void; onClose: () => void } = $props();
  const hops = (n: number): string => (n === 0 ? 'here' : `${n} jump${n > 1 ? 's' : ''}`);
</script>

<aside class="sheet sell steel-tokens" data-testid="starmap-sell">
  <PanelHead icon="trade" title="Where to sell" sub={goods.length ? `${goods.length} good${goods.length > 1 ? 's' : ''} aboard` : 'nothing to sell'} onBack={onClose} backIcon="close" backTitle="Close" backTestId="starmap-sell-close" />
  {#if goods.length}
    <ul>
      {#each goods as g (g.item)}
        <li data-testid="starmap-sell-good">
          <div class="good"><b>{g.name}</b><span class="dim">{g.count} aboard</span></div>
          {#if g.best.length}
            {#each g.best as p, i (p.node)}
              <button class="port" class:top={i === 0} class:here={p.node === current} onclick={() => onPick(p.node)} title="Show {p.name} on the map">
                <span class="name">{#if i === 0}<Icon name="chevUp" size={11} />{/if}{p.name}</span>
                <span class="hops">{hops(p.hops)}</span>
                <span class="price">{p.price}₵</span>
              </button>
            {/each}
          {:else}
            <p class="dim none">No market in range buys it.</p>
          {/if}
        </li>
      {/each}
    </ul>
    <p class="dim foot">Price per unit, what the port pays now. Only ports your sensors can see.</p>
  {:else}
    <p class="dim">Nothing aboard that markets buy.</p>
  {/if}
</aside>

<style>
  .sell { position: absolute; z-index: 12; display: grid; gap: 6px; align-content: start; overflow-y: auto; box-sizing: border-box; left: 8px; top: 54px; width: 300px; max-height: min(70%, 560px); }
  ul { margin: 0; padding: 0; list-style: none; display: grid; gap: 6px; }
  li { display: grid; gap: 2px; padding: 6px 8px; background: var(--panel-2); border: 1px solid var(--line); }
  .good { display: flex; justify-content: space-between; align-items: baseline; font-size: 13px; margin-bottom: 2px; }
  .good b { font: 600 14px var(--head-font); letter-spacing: 0.04em; }
  .port {
    display: grid; grid-template-columns: 1fr auto 44px; gap: 8px; align-items: center; min-height: 26px; padding: 0 6px;
    background: transparent; border: 1px solid transparent; color: var(--rest, var(--text)); font-size: 13px; text-align: left;
  }
  .port:hover { border-color: var(--cyan); color: var(--text); }
  .port.top { color: var(--text); }
  .port.top .price { color: var(--green); }
  .name { display: inline-flex; align-items: center; gap: 3px; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .hops { color: var(--dim); font-size: 12px; }
  .here .hops { color: var(--text); }
  .price { text-align: right; font: 600 13px var(--head-font); }
  .dim { color: var(--dim); margin: 0; font-size: 13px; }
  .none, .foot { font-size: 12px; }
</style>
