<script lang="ts">
  import type { UiStarFaction, UiStarNode, UiStarRoute, UiStarSector } from './starmapApi';

  let { node, sector, factions, route, onJump, onClear }: {
    node: UiStarNode; sector: UiStarSector | null; factions: UiStarFaction[]; route: UiStarRoute | null;
    onJump: () => void; onClear: () => void;
  } = $props();

  const owner = $derived(node.faction ? factions.find((f) => f.id === node.faction) ?? null : null);
</script>

<aside class="panel" data-testid="starmap-panel">
  <div class="top">
    <div>
      <h3>{node.known ? node.name : 'Unexplored'}</h3>
      <div class="sub">
        {[sector?.known ? sector.name : null, `Danger ${node.danger}`].filter(Boolean).join(' · ')}
        {#if node.known}
          ·&nbsp;{#if owner}<span style={`color:${owner.color}`}>{owner.name}</span> <em class={owner.tier}>{owner.tier}</em>{:else}open space{/if}
        {/if}
      </div>
    </div>
    <button class="x" onclick={onClear} aria-label="Clear selection">✕</button>
  </div>
  {#if node.known}
    {#if node.structures.length}<div class="row">{node.structures.join(', ')}</div>{:else}<div class="row dim">Empty space</div>{/if}
    {#if node.resources.length}<div class="row dim">Resources: {node.resources.join(', ')}</div>{/if}
    {#if node.hostiles}<div class="row warn" data-testid="starmap-hostiles">⚠ {node.hostiles} hostile ship{node.hostiles > 1 ? 's' : ''} present</div>{/if}
    {#if node.others}<div class="row dim">{node.others} other ship{node.others > 1 ? 's' : ''} in the area</div>{/if}
  {/if}
  {#if node.current}
    <div class="row here">Your ship is here.</div>
  {:else if route}
    <div class="route" data-testid="starmap-route">
      <span>{route.hops} jump{route.hops > 1 ? 's' : ''}</span>
      <span class:bad={!route.fuelOk}>⛽ {route.fuel} fuel</span>
      <span>{route.time} d</span>
      <span class:bad={!route.chargeOk}>Next jump: {route.nextCharge}s FTL</span>
    </div>
    {#if !route.fuelOk}<div class="row warn">Not enough fuel for the whole route.</div>{/if}
    <button class="jump" disabled={!!route.blocker} onclick={onJump} data-testid="starmap-jump">
      {route.hops > 1 ? `Jump (1 of ${route.hops})` : 'Jump'}
    </button>
    {#if route.blocker}<div class="row dim">{route.blocker}</div>{/if}
  {:else if node.known}
    <div class="row dim">No known route.</div>
  {/if}
</aside>

<style>
  .panel { position: fixed; z-index: 12; right: calc(10px + var(--sar)); bottom: calc(10px + var(--sab)); width: min(340px, calc(100vw - 20px)); background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; display: grid; gap: 6px; }
  .top { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
  h3 { margin: 0; font-size: 16px; }
  .sub { color: var(--dim); font-size: 12px; }
  .row { font-size: 13px; }
  .dim { color: var(--dim); }
  .warn { color: #fca5a5; }
  .here { color: var(--cyan); }
  .route { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 13px; padding: 6px 8px; background: #0b1220; border-radius: 6px; border-left: 3px solid var(--amber); }
  .bad { color: #fca5a5; }
  .jump { background: #0e4a56; border-color: var(--cyan); font-weight: 600; }
  .x { min-width: 32px; min-height: 32px; padding: 0; }
  em { font-style: normal; font-size: 11px; }
  em.hostile { color: #fca5a5; } em.friendly { color: #86efac; } em.neutral { color: var(--dim); }
  @media (max-width: 600px) {
    .panel { left: 0; right: 0; bottom: 0; width: auto; border-radius: 14px 14px 0 0; border-width: 1px 0 0; padding: 10px 14px calc(12px + var(--sab)); }
  }
</style>
