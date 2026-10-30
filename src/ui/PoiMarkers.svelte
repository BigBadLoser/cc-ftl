<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi, UiCombat, UiPrize, UiShuttles, UiTrade } from './api';
  import Icon from './Icon.svelte';
  import { nodeEntries, NODE_ICONS, type NodeEntry } from './nodeList';
  import { markerPlace, measureHud, spread, type Place } from './poiMarkers';

  /**
   * Off-screen points of interest: every other ship or station in the node (the node strip's list) whose centre is outside the camera view gets a
   * marker on the screen edge, on the line from the screen centre toward it, with an arrow and its icon (the name expands on hover). A click pans the camera to it and
   * selects it, as in the node strip. Positions come from the renderer's screen projection each frame; markers hug the screen edge and slide along it
   * clear of the HUD rectangles measured from the page (top bars, right column, tool dock, build menu).
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
      const hud = measureHud(document);
      const next: (Place & NodeEntry)[] = [];
      for (const n of entries) {
        const at = api.shipScreen(n.ship);
        const p = at && markerPlace(at, innerWidth, innerHeight, hud);
        if (p) next.push({ ...n, ...p });
      }
      const same = next.length === raw.length && next.every((m, i) => m.ship === raw[i]?.ship && m.x === raw[i].x && m.y === raw[i].y && m.angle === raw[i].angle && m.edge === raw[i].edge);
      if (!same) {
        raw = next;
        placed = spread(next, innerWidth, innerHeight);
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
    <button class="poi" class:foe={m.kind === 'hostile'} class:rev={m.grow === 'l'} style="left:{m.x}px; top:{m.y}px; transform: translate({m.tx}%, {m.ty}%); --room:{m.room}px" data-testid="poi-{m.ship}" data-kind={m.kind} data-edge={m.edge} aria-label="{m.name}: off screen, go to" onclick={() => api.selectShip(m.ship)}>
      <svg class="arrow" width="12" height="12" viewBox="-6 -6 12 12" style="transform: rotate({m.angle}deg)" aria-hidden="true"><path d="M-5 0 H4 M0 -4.5 L4.5 0 L0 4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
      <Icon name={NODE_ICONS[m.kind]} size={18} />
      <span class="name">{m.name}</span>
    </button>
  {/each}
</div>

<style>
  .pois { position: fixed; inset: 0; z-index: 2; pointer-events: none; }
  /* Compact at rest (arrow and icon); the name expands on hover or focus toward the screen interior, up to the room measured beside the chip. */
  .poi { position: absolute; display: flex; align-items: center; gap: 4px; min-height: 0; min-width: 0; box-sizing: border-box; width: fit-content; height: 28px; padding: 0 6px; background: var(--panel); border: 1px solid var(--line-hi); color: var(--cyan); pointer-events: auto; font-size: 12px; }
  .poi.rev { flex-direction: row-reverse; }
  .poi:hover, .poi:focus-visible { background: var(--panel-3); border-color: var(--cyan); }
  .poi.foe { color: var(--red); border-color: #7a2a2a; }
  .arrow { flex: none; }
  .name { display: block; max-width: 0; margin-left: -4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text); transition: max-width 0.12s ease-out; }
  .rev .name { margin-left: 0; margin-right: -4px; }
  .poi:hover .name, .poi:focus-visible .name { max-width: var(--room); margin: 0; }
</style>
