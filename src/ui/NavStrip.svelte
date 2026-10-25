<script lang="ts">
  import Icon from './Icon.svelte';

  type Props = {
    overviewOpen: boolean;
    stockOpen: boolean;
    mapOpen: boolean;
    /** In hyperspace the map is the view: it stays open until the ship drops. */
    mapLocked: boolean;
    prioritiesOpen: boolean;
    /** Enemies are present in the node. */
    hostile: boolean;
    combatOpen: boolean;
    jobsOpen: boolean;
    /** Jobs held, shown on the tile. */
    jobCount: number;
    onJobs: () => void;
    onMap: () => void;
    onOverview: () => void;
    onCrew: () => void;
    onStock: () => void;
    onCombat: () => void;
  };
  let { mapOpen, mapLocked, onMap, overviewOpen, stockOpen, prioritiesOpen, hostile, combatOpen, jobsOpen, jobCount, onJobs, onOverview, onCrew, onStock, onCombat }: Props = $props();
</script>

<!-- Global screens: one framed strip of flush icon tiles, the starmap first. -->
<div class="strip" role="toolbar" aria-label="Screens" data-testid="navstrip">
  <button class="tile" class:on={mapOpen} disabled={mapLocked} title={mapLocked ? 'Drop from hyperspace to leave the map' : 'Starmap (M)'} aria-label="Starmap" data-testid="starmap-open" onclick={onMap}><Icon name="map" size={22} /></button>
  <button class="tile" class:on={overviewOpen} title="Ship overview" aria-label="Ship overview" data-testid="overview-open" onclick={onOverview}><Icon name="hull" size={22} /></button>
  <button class="tile" class:on={prioritiesOpen} title="Crew priorities" aria-label="Crew" data-testid="crew-open" onclick={onCrew}><Icon name="person" size={22} /></button>
  <button class="tile" class:on={stockOpen} title="Ship stock" aria-label="Stock" data-testid="stock-open" onclick={onStock}><Icon name="stock" size={22} /></button>
 <button class="tile" class:on={jobsOpen} title="Jobs" aria-label="Jobs" data-testid="jobs-open" onclick={onJobs}><Icon name="list" size={22} />{#if jobCount}<b class="badge">{jobCount}</b>{/if}</button>
  <button class="tile combat" class:on={combatOpen} class:hot={hostile} title={hostile ? 'Combat' : 'No enemies'} aria-label="Combat" aria-disabled={!hostile} data-testid="combat-open" onclick={onCombat}><Icon name="target" size={22} /></button>
</div>

<style>
  .strip button.tile { position: relative; }
  .badge { position: absolute; top: 2px; right: 2px; min-width: 14px; height: 14px; padding: 0 3px; border-radius: 7px; background: #ffb43c; color: #111; font: 700 10px/14px var(--head-font); }
  .strip { display: flex; background: var(--panel); border: 1px solid var(--line-hi); }
  .strip button.tile { border: 0; border-right: 1px solid var(--line); background: transparent; }
  .strip button.tile:last-child { border-right: 0; }
  .strip button.tile:hover { background: var(--panel-3); }
  .strip button.tile.on { background: var(--panel-3); box-shadow: inset 0 0 0 1px var(--cyan); }
  .combat { color: var(--dim); }
  .combat.hot { color: var(--red); animation: pulse 1.6s ease-in-out infinite; }
  @keyframes pulse { 50% { background: #3a1216; } }
  @media (prefers-reduced-motion: reduce) { .combat.hot { animation: none; background: #3a1216; } }
  @media (max-width: 600px) { .strip button.tile { width: 36px; height: 36px; } }
</style>
