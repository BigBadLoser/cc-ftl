<script lang="ts">
  /** The card for a tapped node: what is there, the route to it with fuel, days and the FTL state, and the Jump (or Flee) button. */
  import Icon from './Icon.svelte';
  import PanelHead from './PanelHead.svelte';
  import type { UiStarFaction, UiStarNode, UiStarRoute, UiStarSector } from './starmapApi';
  import { toneColor } from './starmapStyle';

  let { node, sector, factions, route, fleeing = false, onGo, onClear }: {
    node: UiStarNode; sector: UiStarSector | null; factions: UiStarFaction[]; route: UiStarRoute | null;
    /** Flee-target mode: the button flees (a jump away from the fight) instead of jumping. */
    fleeing?: boolean; onGo: () => void; onClear: () => void;
  } = $props();

  const owner = $derived(node.faction ? factions.find((f) => f.id === node.faction) ?? null : null);
  const sub = $derived([sector?.known ? sector.name : null, `Danger ${node.danger}`].filter(Boolean).join(' · '));
  const label = $derived(fleeing ? 'Flee here' : route && route.hops > 1 ? `Jump (1 of ${route.hops})` : 'Jump');
</script>

<aside class="sheet card" data-testid="starmap-panel">
  <PanelHead icon="station" title={node.known ? node.name : 'Unexplored'} {sub} onBack={onClear} backIcon="close" backTitle="Close card" backTestId="starmap-card-close" />
  {#if node.known}
    <div class="row">
      {#if owner}<span class="own" style={`color: ${toneColor(owner.tone)}`}>{owner.name}</span> <em class={owner.tier}>{owner.tier}</em>{:else}Open space{/if}
    </div>
    {#if node.structures.length}<div class="row">{node.structures.join(', ')}</div>{:else}<div class="row dim">Empty space</div>{/if}
    {#if node.resources.length}<div class="row dim">Resources: {node.resources.join(', ')}</div>{/if}
    {#if node.hostiles}<div class="row warn" data-testid="starmap-hostiles"><Icon name="alert" size={14} />{node.hostiles} hostile ship{node.hostiles > 1 ? 's' : ''} present</div>{/if}
    {#if node.others}<div class="row dim">{node.others} other ship{node.others > 1 ? 's' : ''} in the area</div>{/if}
  {/if}
  {#if node.current}
    <div class="row here">Your ship is here.</div>
  {:else if route}
    <div class="cells" data-testid="starmap-route">
      <span class="cell" title="Jumps"><Icon name="fast" size={18} /><b>{route.hops}</b></span>
      <span class="cell" class:bad={!route.fuelOk} title="Fuel for the whole route"><Icon name="fuel" size={18} /><b>{route.fuel}</b></span>
      <span class="cell" title="Days"><Icon name="clock" size={18} /><b>{route.time}</b><small>d</small></span>
      <span class="cell" class:bad={!route.chargeOk} title="FTL charge the next jump needs"><Icon name="bolt" size={18} /><b>{route.nextCharge}</b><small>s</small></span>
    </div>
    {#if !route.fuelOk}<div class="row warn">Not enough fuel for the whole route.</div>{/if}
    <button class="go" disabled={!!route.blocker} onclick={onGo} data-testid="starmap-jump"><Icon name={fleeing ? 'evasion' : 'fast'} size={18} />{label}</button>
    {#if route.blocker}<div class="row dim">{route.blocker}</div>{/if}
  {:else if node.known}
    <div class="row dim">No known route.</div>
  {/if}
</aside>

<style>
  .card { z-index: 12; display: grid; gap: 6px; }
  .row { font-size: 13px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .dim { color: var(--dim); }
  .warn { color: var(--red); }
  .here { color: var(--cyan); }
  .own { font-family: var(--head-font); font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; }
  em { font-style: normal; font: 600 11px var(--head-font); letter-spacing: 0.06em; text-transform: uppercase; padding: 2px 5px; border: 1px solid currentColor; }
  em.hostile { color: var(--red); } em.friendly { color: var(--green); } em.neutral { color: var(--dim); }
  .cells { display: flex; gap: 4px; flex-wrap: wrap; }
  .cell { display: flex; align-items: center; gap: 6px; padding: 6px 8px; min-height: 20px; background: var(--panel-2); border: 1px solid var(--line); color: var(--cyan); }
  .cell b { color: var(--text); font-weight: 600; }
  .cell small { color: var(--dim); font-size: 11px; }
  .cell.bad { border-color: var(--red); color: var(--red); }
  .go { display: flex; align-items: center; justify-content: center; gap: 8px; border-color: var(--cyan); background: var(--panel-3); color: var(--text); font: 600 15px var(--head-font); letter-spacing: 0.08em; text-transform: uppercase; }
  .go:disabled { opacity: 0.4; }
  @media (min-width: 601px) { .card { left: auto; top: auto; right: calc(10px + var(--sar)); bottom: calc(10px + var(--sab)); width: 320px; } }
</style>
