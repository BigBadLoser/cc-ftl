<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi, UiCombat, UiPrize, UiShuttles, UiTrade } from './api';
  import Icon from './Icon.svelte';
  import { nodeEntries, NODE_ICONS, type NodeEntry } from './nodeList';
  import { modalOpen } from './keys';
  import { ICON_GAP, markerPlace, measureHud, spread, type Place } from './poiMarkers';

  /**
   * Off-screen points of interest: every other ship or station in the node (the node strip's list) whose centre is outside the camera view gets a
   * marker on the screen edge, on the line from the screen centre toward it, with an arrow at the edge and its icon behind it (the name shows on hover). They are hidden while a modal holds the gate (`modalOpen`). A click pans the camera to it and
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
  /** The HUD geometry `placed` was spread against: a panel that grows or moves re-spreads the markers even when no raw placement changed. */
  let hudKey = '';
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
      // A modal (the Esc menu, the jump confirmation, game over) holds the gate: no markers, so none can be clicked under it.
      if (modalOpen()) {
        if (placed.length) {
          raw = [];
          placed = [];
        }
        return;
      }
      const hud = measureHud(document);
      const next: (Place & NodeEntry)[] = [];
      for (const n of entries) {
        const at = api.shipScreen(n.ship);
        const p = at && markerPlace(at, innerWidth, innerHeight, hud);
        if (p) next.push({ ...n, ...p });
      }
      const key = hud.map((r) => `${Math.round(r.l)},${Math.round(r.t)},${Math.round(r.r)},${Math.round(r.b)}`).join(';');
      const same = key === hudKey && next.length === raw.length && next.every((m, i) => m.ship === raw[i]?.ship && m.x === raw[i].x && m.y === raw[i].y && m.angle === raw[i].angle && m.edge === raw[i].edge && m.room === raw[i].room);
      if (!same) {
        raw = next;
        hudKey = key;
        placed = spread(next, innerWidth, innerHeight, hud);
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
    <button class="poi" class:foe={m.kind === 'hostile'} class:rev={m.grow === 'l'} style="left:{m.x}px; top:{m.y}px; --ix:{-m.ux * ICON_GAP}px; --iy:{-m.uy * ICON_GAP}px; --room:{m.room}px" data-testid="poi-{m.ship}" data-kind={m.kind} data-edge={m.edge} aria-label="{m.name}: off screen, go to" onclick={() => api.selectShip(m.ship)}>
      <svg class="arrow" width="24" height="24" viewBox="-12 -12 24 24" style="transform: rotate({m.angle}deg)" aria-hidden="true"><path d="M-6 0 H5 M0 -5.5 L5.5 0 L0 5.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" /></svg>
      <span class="ico"><Icon name={NODE_ICONS[m.kind]} size={22} /></span>
      <span class="name">{m.name}</span>
    </button>
  {/each}
</div>

<style>
  .pois { position: fixed; inset: 0; z-index: 2; pointer-events: none; }
  /* No box: the arrow sits on the screen edge pointing at the target, the upright icon behind it on the line toward the screen centre (--ix/--iy). The
     button itself is a zero-size anchor; the arrow and icon are its hit areas. The name opens beside the icon, away from the arrow, on hover or focus. */
  .poi { position: absolute; width: 0; height: 0; min-width: 0; min-height: 0; padding: 0; margin: 0; border: 0; background: none; color: var(--cyan); pointer-events: none; overflow: visible; font-size: 12px; }
  .poi.foe { color: var(--red); }
  .arrow, .ico { position: absolute; pointer-events: auto; cursor: pointer; filter: drop-shadow(0 0 1.5px #000) drop-shadow(0 0 3px #000); }
  .arrow { left: -12px; top: -12px; }
  .ico { left: calc(var(--ix) - 15px); top: calc(var(--iy) - 15px); width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; }
  .poi:hover .arrow, .poi:hover .ico, .poi:focus-visible .arrow, .poi:focus-visible .ico { color: #fff; }
  .poi.foe:hover .arrow, .poi.foe:hover .ico { color: #ff8a8a; }
  .poi:focus-visible .ico { outline: 2px solid var(--focus); outline-offset: -2px; }
  .name { display: none; position: absolute; top: calc(var(--iy) - 11px); left: calc(var(--ix) + 19px); max-width: var(--room); height: 22px; line-height: 22px; padding: 0 7px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; background: rgba(6, 9, 13, 0.78); color: var(--text); pointer-events: none; }
  .rev .name { left: auto; right: calc(19px - var(--ix)); }
  .poi:hover .name, .poi:focus-visible .name { display: block; }
</style>
