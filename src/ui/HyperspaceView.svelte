<script lang="ts">
  /** The game view while the ship is in hyperspace and the starmap is closed: a cheap placeholder (CSS streaks) with where the trip stands. */
  import type { UiApi } from './api';
  import Icon from './Icon.svelte';
  import PanelHead from './PanelHead.svelte';
  import type { UiStarmap } from './starmapApi';

  let { api, map, onOpenMap }: { api: UiApi; map: UiStarmap; onOpenMap: () => void } = $props();
  const t = $derived(map.travel);
  const status = $derived(
    !t ? 'Dropping out.'
    : t.phase === 'arrived' ? `Arrived at ${t.names[t.at]}.`
    : t.phase === 'noFuel' ? `Out of fuel at ${t.names[t.at]} (the next hop needs ${t.need}).`
    : `Hop ${t.at + 1} of ${t.route.length - 1}, to ${t.names[t.at + 1]}.`,
  );
</script>

<div class="hyper" data-testid="hyperspace-view">
  <div class="streaks" aria-hidden="true"></div>
  <div class="sheet panel">
    <PanelHead icon="fast" title="In hyperspace" sub={`Turn ${map.turn}`} />
    <p data-testid="hyperspace-status">{status}</p>
    <div class="two">
      <button onclick={onOpenMap} data-testid="hyperspace-open-map"><Icon name="map" size={18} />Open starmap</button>
      <button class="go" onclick={() => api.dispatch({ type: 'galaxy.drop' })} data-testid="hyperspace-drop"><Icon name="back" size={18} />Drop from hyperspace</button>
    </div>
  </div>
</div>

<style>
  .hyper { position: fixed; inset: 0; z-index: 6; background: var(--bg); overflow: hidden; display: grid; place-items: center; }
  .streaks { position: absolute; inset: -50%; background: repeating-linear-gradient(100deg, transparent 0 46px, color-mix(in srgb, var(--cyan) 22%, transparent) 46px 48px, transparent 48px 120px, color-mix(in srgb, var(--cyan) 10%, transparent) 120px 121px); animation: rush 0.9s linear infinite; }
  @keyframes rush { to { transform: translateX(-120px); } }
  @media (prefers-reduced-motion: reduce) { .streaks { animation: none; } }
  .panel { position: relative; width: min(420px, calc(100vw - 24px)); display: grid; gap: 8px; border-width: 1px; }
  p { margin: 0; font-size: 14px; }
  .two { display: flex; gap: 6px; flex-wrap: wrap; }
  .two button { flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px; font: 600 14px var(--head-font); letter-spacing: 0.06em; text-transform: uppercase; white-space: nowrap; }
  .go { border-color: var(--cyan); background: var(--panel-3); color: var(--text); }
  @media (max-width: 600px) { .panel { position: relative; left: auto; right: auto; bottom: auto; border-width: 1px; padding: 10px; } }
</style>
