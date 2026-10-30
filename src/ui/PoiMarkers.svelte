<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi, UiCombat, UiPrize, UiShuttles, UiTrade } from './api';
  import Icon from './Icon.svelte';
  import { nodeEntries, NODE_ICONS, type NodeEntry } from './nodeList';
  import { markerPlace, spread, type Place } from './poiMarkers';

  /**
   * Off-screen points of interest: every other ship or station in the node (the node strip's list) whose centre is outside the camera view gets a
   * marker on the screen edge, on the line from the screen centre toward it, with an arrow, its icon and its name. A click pans the camera to it and
   * selects it, as in the node strip. Positions come from the renderer's screen projection each frame; markers sit inside a safe rectangle that
   * keeps clear of the HUD (the top bars, the right column, the bottom dock).
   */
  let { api }: { api: UiApi } = $props();
  let trade = $state<UiTrade>({ credits: 0, partners: [], deals: [] });
  let prizes = $state<UiPrize[]>([]);
  let combat = $state<UiCombat>({ inCombat: false, player: null, enemies: [] });
  let shuttles = $state<UiShuttles>({ shuttles: [], airlocks: [], targets: [], roster: [], bays: [], regions: [], transfers: [], ferryReady: false });
  let placed = $state<(Place & NodeEntry)[]>([]);
  /** The markers before spreading, to tell whether anything moved. */
  let raw: (Place & NodeEntry)[] = [];
  const entries = $derived(nodeEntries({ trade, prizes, combat, shuttles }));

  onMount(() => {
    const u = [
      api.trade.subscribe((v) => (trade = v)),
      api.prizes.subscribe((v) => (prizes = v)),
      api.combat.subscribe((v) => (combat = v)),
      api.shuttles.subscribe((v) => (shuttles = v)),
    ];
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const next: (Place & NodeEntry)[] = [];
      for (const n of entries) {
        const at = api.shipScreen(n.ship);
        const p = at && markerPlace(at, innerWidth, innerHeight);
        if (p) next.push({ ...n, ...p });
      }
      const same = next.length === raw.length && next.every((m, i) => m.ship === raw[i]?.ship && m.x === raw[i].x && m.y === raw[i].y && m.angle === raw[i].angle);
      if (!same) {
        raw = next;
        placed = spread(next, innerHeight);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      u.forEach((f) => f());
    };
  });
</script>

<div class="pois" data-testid="pois">
  {#each placed as m (m.ship)}
    <button class="poi" class:foe={m.kind === 'hostile'} style="left:{m.x}px; top:{m.y}px" data-testid="poi-{m.ship}" data-kind={m.kind} aria-label="{m.name}: off screen, go to" onclick={() => api.selectShip(m.ship)}>
      <i class="arrow" style="transform: rotate({m.angle}deg)"></i>
      <Icon name={NODE_ICONS[m.kind]} size={18} />
      <span class="name">{m.name}</span>
    </button>
  {/each}
</div>

<style>
  .pois { position: fixed; inset: 0; z-index: 2; pointer-events: none; }
  .poi { position: absolute; transform: translate(-50%, -50%); display: flex; align-items: center; gap: 4px; min-height: 0; min-width: 0; height: 28px; max-width: 180px; padding: 0 8px 0 4px; background: var(--panel); border: 1px solid var(--line-hi); color: var(--cyan); pointer-events: auto; font-size: 12px; }
  .poi:hover { background: var(--panel-3); border-color: var(--cyan); }
  .poi.foe { color: var(--red); border-color: #7a2a2a; }
  /* A small triangle that points along the marker's direction (rotated by its angle; 0 = right). */
  .arrow { flex: none; width: 0; height: 0; margin: 0 2px; border-left: 8px solid currentColor; border-top: 5px solid transparent; border-bottom: 5px solid transparent; }
  .name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text); }
</style>
