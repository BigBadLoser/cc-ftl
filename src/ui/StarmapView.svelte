<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import type { UiApi, UiFtl } from './api';
  import type { UiEncounterChoice, UiJumpWarnings, UiStarArt, UiStarmap, UiStarNode, UiStarRoute } from './starmapApi';
  import Icon from './Icon.svelte';
  import PanelHead from './PanelHead.svelte';
  import InterdictModal from './InterdictModal.svelte';
  import StarmapDrawer from './StarmapDrawer.svelte';
  import StarmapStats from './StarmapStats.svelte';
  import StarmapInfo from './StarmapInfo.svelte';
  import StarmapNews from './StarmapNews.svelte';
  import { jumpCommand, toggleTake } from './starmapJump';
  import { toneColor } from './starmapStyle';
  import { snapScale, wheelFactor, zoomTarget, type StarmapGlide, type StarmapGpu } from './starmapGpu';

  /** The starmap screen. `focusNode`: a node to centre on when it opens. (Fleeing a fight is the combat panel's flee control, not this map.) */
  let { api, focusNode = null, onClose, onSlide }: { api: UiApi; focusNode?: string | null; onClose: () => void; onSlide?: (on: boolean) => void } = $props();

  let map = $state<UiStarmap | null>(null);
  /** The starmap's sprites (null until loaded: the levels draw their code shapes meanwhile). */
  let art = $state<UiStarArt | null>(null);
  /** In hyperspace the map cannot be closed: it is the view until the ship drops. */
  /** Adrift: a flee left the ship in hyperspace with no route. The map is the way to pick one (and can be closed: the ship stays adrift). */
  const adrift = $derived(map?.travel?.phase === 'adrift');
  const locked = $derived(map?.state === 'hyperspace' && !adrift);
  /** The trip under way (not the adrift state, which has no route to draw). */
  const trip = $derived(map?.travel && !adrift ? map.travel : null);
  let w = $state(800);
  let h = $state(600);
  /**
   * View centre (map units) and scale (screen px per unit). Plain numbers: the map is drawn by Pixi (`gpu`), and every change goes through
   * `setCam`, which tells it and works out the zoom level. Nothing reactive is touched per frame.
   */
  let cx = 0;
  let cy = 0;
  let s = 1;
  /** The zoom target, unsnapped: zoom inputs add to it and `s` is its snapped value. */
  let sTarget = 1;
  let gpu: StarmapGpu | null = null;
  let stage: HTMLDivElement;
  let selected = $state<string | null>(null);
  /** A sector (level 2) or cluster (level 3) tapped on an outer level. */
  let picked = $state<{ kind: 'sector' | 'cluster'; id: string } | null>(null);
  /** The map thing under the cursor: a node (level 1), sector (2) or cluster (3) id. */
  let hover = $state<string | null>(null);
  let dragging = $state(false);
  let placed = false;
  /** The jump confirm step (what the jump would leave behind) and which docked shuttles come along. */
  let confirming = $state<UiJumpWarnings | null>(null);
  let taking = $state<number[]>([]);
  /** The FTL drive and its order, and whether the open confirm step is for "Jump when charged". */
  let ftl = $state<UiFtl | null>(null);
  let queueing = false;
  let overcharging = false;

  const nodeById = $derived(new Map((map?.nodes ?? []).map((n) => [n.id, n])));
  const sectorById = $derived(new Map((map?.sectors ?? []).map((x) => [x.id, x])));
  const current = $derived(map ? nodeById.get(map.current) ?? null : null);
  const sel = $derived(selected ? nodeById.get(selected) ?? null : null);
  /** Recomputed whenever the map or its fuel/charge figures change. */
  const route = $derived<UiStarRoute | null>(map && sel && sel.known && !sel.current ? api.planRoute(sel.id) : null);
  const travelPts = $derived(trip ? trip.route.slice(trip.at).map((id) => nodeById.get(id)).filter((n): n is UiStarNode => !!n).map((n) => `${n.x},${n.y}`).join(' ') : '');
  const routePts = $derived(travelPts || (route ? route.path.map((id) => nodeById.get(id)).filter((n): n is UiStarNode => !!n).map((n) => `${n.x},${n.y}`).join(' ') : ''));
  const here = $derived(map ? sectorById.get(map.currentSector) ?? null : null);
  /**
   * Semantic zoom by how much map fits across the shorter side: the sector (nodes), sectors as icons inside clusters,
   * then clusters as nodes.
   */
  let level = $state<1 | 2 | 3>(1);
  /** Camera changed: pass it to the GPU view and take the semantic zoom level from it. */
  function setCam() {
    const span = Math.min(w, h) / s;
    const l = span < 2200 ? 1 : span < 11000 ? 2 : 3;
    if (l !== level) level = l;
    gpu?.camera(cx, cy, s, w, h);
  }
  $effect(() => {
    void w;
    void h;
    setCam();
  });
  const LEVELS = [
    { n: 1, label: 'Sector', span: 0 }, { n: 2, label: 'Cluster', span: 5200 }, { n: 3, label: 'Galaxy', span: 12500 },
  ] as const;
  /** Jump to a zoom level, centred on your sector. */
  function setLevel(n: 1 | 2 | 3) {
    picked = null;
    if (!map) return;
    if (n === 1) return focusSector(map.currentSector);
    const sec = sectorById.get(map.currentSector);
    flyTo(sec?.x ?? cx, sec?.y ?? cy, Math.min(w, h) / LEVELS[n - 1]!.span);
  }
  const pickedInfo = $derived.by(() => {
    if (!map || !picked) return null;
    if (picked.kind === 'sector') {
      const sec = sectorById.get(picked.id);
      if (!sec) return null;
      const reg = map.clusters.find((r) => r.id === sec.cluster);
      const owner = map.factions.find((f) => f.id === sec.faction);
      return {
        title: sec.known ? sec.name : 'Uncharted sector', zoomLabel: 'Zoom in',
        lines: [
          `${owner ? owner.name : sec.known ? 'Unclaimed' : 'Owner unknown'} · danger ${sec.danger}`,
          reg?.revealed ? `${reg.name}, ${reg.typeLabel}` : 'Unclaimed space',
          sec.known ? `${sec.nodes} nodes${sec.body ? ` · ${sec.body.kind.replace('_', ' ')}` : ''}${sec.hub ? ' · cluster hub' : ''}` : 'Not yet charted by your sensors',
          sec.id === map.currentSector ? 'You are here' : route ? `Route: ${route.hops} jump${route.hops > 1 ? 's' : ''} · ${route.fuel} fuel · ${route.time} d` : 'No known route yet',
        ],
        zoom: () => focusSector(sec.id),
        action: route && !route.blocker && !route.overweight ? { label: route.hops > 1 ? `Jump (1 of ${route.hops})` : 'Jump', run: () => go() } : null,
        warn: route?.blocker ?? (route?.overweight ? `Overweight: hull ${route.overweight.tiles} / ${route.overweight.capacity}.` : null) ?? (route && !route.fuelOk ? 'Not enough fuel for the whole route.' : null),
      };
    }
    const reg = map.clusters.find((r) => r.id === picked!.id);
    if (!reg) return null;
    const owner = map.factions.find((f) => f.id === reg.faction);
    return {
      title: reg.revealed ? reg.name : 'Uncharted cluster', zoomLabel: 'Zoom in',
      lines: [
        reg.revealed ? `${reg.typeLabel}${owner ? ` · ${owner.name}` : ''}` : 'Unknown',
        `${reg.sectors} sectors${reg.current ? ' · you are here' : ''}`,
      ],
      zoom: () => {
        flyTo(reg.x, reg.y, Math.min(w, h) / LEVELS[1].span);
        picked = null;
      },
    };
  });
  let newsOpen = $state(false);
  /** News the player has not looked at: ids above the newest one seen when the panel was last open (the panel starts closed, so the map stays clear). */
  let newsSeen = $state(0);
  const newestNews = $derived(map?.news.reduce((m, n) => Math.max(m, n.id), 0) ?? 0);
  const unread = $derived(newsOpen ? 0 : (map?.news.filter((n) => n.id > newsSeen).length ?? 0));
  $effect(() => { if (newsOpen) newsSeen = newestNews; });
  const drawerOpen = $derived(!!map && level < 3 && (!!map.travel || !!sel));
  const interdiction = $derived(map?.encounters.find((e) => e.kind === 'interdict' || !!e.contraband) ?? null);
  const cardOpen = $derived(drawerOpen || (!!pickedInfo && level === 3));
  const seenFactions = $derived(map ? map.factions.filter((f) => map!.sectors.some((x) => x.known && x.faction === f.id)) : []);

  /** Centre on a sector so it fills most of the shorter side (the default view: your sector); `instant` skips the glide. */
  function focusSector(id: string, instant = false) {
    const sec = sectorById.get(id);
    if (sec) flyTo(sec.x, sec.y, (Math.min(w, h) * 0.62) / (2 * sec.r + 60), instant ? 0 : undefined);
  }
  /** Glide the camera to (x, y) at scale `to` over `ms` (zoom eased on a log scale, so it feels even); any drag stops it. */
  let camRaf = 0;
  function flyTo(x: number, y: number, to: number, ms = 450) {
    cancelAnimationFrame(camRaf);
    const from = { cx, cy, s };
    const t0 = performance.now();
    const step = (now: number) => {
      const t = ms > 0 ? Math.min(1, (now - t0) / ms) : 1;
      const e = 1 - (1 - t) ** 3;
      cx = from.cx + (x - from.cx) * e;
      cy = from.cy + (y - from.cy) * e;
      sTarget = from.s * (to / from.s) ** e;
      s = snapScale(sTarget);
      setCam();
      if (t < 1) camRaf = requestAnimationFrame(step);
    };
    if (ms > 0) camRaf = requestAnimationFrame(step);
    else step(t0);
  }
  /** The node of a sector that is cheapest to reach (fewest jumps, then fuel), to plot a route into it; null if none. */
  function routeInto(id: string): string | null {
    if (!map || id === map.currentSector) return null;
    let best: { id: string; hops: number; fuel: number } | null = null;
    for (const n of map.nodes) {
      if (n.sector !== id || !n.known) continue;
      const r = api.planRoute(n.id);
      if (r && (!best || r.hops < best.hops || (r.hops === best.hops && r.fuel < best.fuel))) best = { id: n.id, hops: r.hops, fuel: r.fuel };
    }
    return best?.id ?? null;
  }
  const routeSectors = $derived(new Set(route ? route.path.map((id) => nodeById.get(id)?.sector ?? '') : []));
  function recenter() {
    if (map) focusSector(map.currentSector);
  }

  onMount(() => {
    api.setStarmapOpen(true);
    const unsub = api.starmap.subscribe((m) => {
      const moved = map && map.current !== m.current;
      map = m;
      if (!placed && m.nodes.length) {
        placed = true;
        queueMicrotask(() => {
          const n = focusNode ? m.nodes.find((x) => x.id === focusNode) : undefined;
          const sec = n ? sectorById.get(n.sector) : undefined;
          if (n && sec) flyTo(n.x, n.y, (Math.min(w, h) * 0.62) / (2 * sec.r + 60), 0); // a log entry or alert about a node: open on it
          else focusSector(m.currentSector, true);
        });
      }
      if (moved && selected === m.current) selected = null;
    });
    const unsubFtl = api.ftl.subscribe((f) => (ftl = f));
    const unsubArt = api.starmapArt.subscribe((a) => (art = a));
    gpu = api.createStarmapGpu(stage);
    setCam();
    // A wheel listener must not be passive to stop the page from scrolling.
    stage.addEventListener('wheel', wheel, { passive: false });
    return () => {
      unsub();
      unsubFtl();
      unsubArt();
      stage.removeEventListener('wheel', wheel);
      gpu?.destroy();
      gpu = null;
    };
  });

  /**
   * The ship's glide along the route: visual only (a fixed tween per hop, independent of the sim's pace). `glide` is a float index
   * along `travel.route`; it moves toward the node being headed for (the next one while a hop is under way) at one hop per
   * GLIDE_MS, never overshooting, so fast sim turns queue up and play one after another.
   */
  const GLIDE_MS = 700;
  let glide: number | null = null;
  let ship: StarmapGlide | null = null;
  let tripKey = '';
  let follow = false;
  let raf = 0;
  let lastFrame = 0;
  function frame(now: number) {
    const dt = lastFrame ? Math.min(100, now - lastFrame) : 16;
    lastFrame = now;
    const tr = trip;
    if (tr) {
      const key = `${tr.route[0]}>${tr.route.length}`;
      if (key !== tripKey && (tripKey === '' || tr.at === 0)) {
        tripKey = key;
        glide = tr.at;
        follow = true;
        const first = nodeById.get(tr.route[0] as string);
        if (first && level === 1) flyTo(first.x, first.y, s, 250);
      }
      const target = tr.phase === 'hop' ? tr.at + 1 : tr.at;
      const g = glide ?? tr.at;
      glide = g < target ? Math.min(target, g + dt / GLIDE_MS) : target;
      onSlide?.(g < target);
      ship = shipAt(glide);
      gpu?.glide(ship);
      if (follow && level === 1 && ship) {
        cx += (ship.x - cx) * 0.12;
        cy += (ship.y - cy) * 0.12;
        setCam();
      }
    } else if (glide !== null) {
      glide = null;
      ship = null;
      gpu?.glide(null);
      tripKey = '';
      onSlide?.(false);
    }
    raf = requestAnimationFrame(frame);
  }
  onMount(() => {
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  });
  onDestroy(() => {
    api.setStarmapOpen(false);
    cancelAnimationFrame(camRaf);
    onSlide?.(false);
  });
  /** The ship marker on the lane it is gliding along (ends of the lane for the heading). */
  function shipAt(glide: number): StarmapGlide | null {
    const tr = trip;
    if (!tr) return null;
    const i = Math.min(tr.route.length - 2, Math.max(0, Math.floor(glide)));
    const a = nodeById.get(tr.route[i] as string);
    const b = nodeById.get(tr.route[i + 1] as string);
    if (!a || !b) return null;
    const t = Math.min(1, glide - i);
    const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
    return { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e, fx: a.x, fy: a.y, tx: b.x, ty: b.y };
  }

  const toMap = (px: number, py: number) => ({ x: cx + (px - w / 2) / s, y: cy + (py - h / 2) / s });
  const MIN_S = 0.015;
  const MAX_S = 6;
  function zoomAt(px: number, py: number, f: number) {
    const before = toMap(px, py);
    sTarget = zoomTarget(sTarget, f, MIN_S, MAX_S);
    s = Math.min(MAX_S, Math.max(MIN_S, snapScale(sTarget)));
    const after = toMap(px, py);
    cx += before.x - after.x;
    cy += before.y - after.y;
    setCam();
  }

  // Pointer handling: one finger pans, two pinch; a press that barely moves is a tap (selects the nearest node).
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- pointer bookkeeping, nothing renders from it
  const pointers = new Map<number, { x: number; y: number }>();
  let downAt: { x: number; y: number } | null = null;
  let moved = 0;
  const local = (e: PointerEvent | WheelEvent) => {
    const r = stage.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  function down(e: PointerEvent) {
    cancelAnimationFrame(camRaf);
    stage.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, local(e));
    if (pointers.size === 1) {
      downAt = local(e);
      moved = 0;
    }
  }
  function move(e: PointerEvent) {
    const prev = pointers.get(e.pointerId);
    if (!prev) return hovering(e);
    const p = local(e);
    if (pointers.size === 1) {
      cx -= (p.x - prev.x) / s;
      cy -= (p.y - prev.y) / s;
      setCam();
      moved += Math.hypot(p.x - prev.x, p.y - prev.y);
      dragging = moved >= 8;
    } else if (pointers.size === 2) {
      const other = [...pointers.entries()].find(([id]) => id !== e.pointerId)?.[1];
      if (other) {
        const d0 = Math.hypot(prev.x - other.x, prev.y - other.y);
        const d1 = Math.hypot(p.x - other.x, p.y - other.y);
        if (d0 > 4) zoomAt((p.x + other.x) / 2, (p.y + other.y) / 2, d1 / d0);
      }
      moved = 99;
    }
    pointers.set(e.pointerId, p);
  }
  function up(e: PointerEvent) {
    const was = pointers.size;
    pointers.delete(e.pointerId);
    if (was === 1 && downAt && moved < 8) tap(local(e));
    if (!pointers.size) {
      downAt = null;
      dragging = false;
    }
  }
  type Hit = { kind: 'node' | 'sector' | 'cluster'; id: string };
  /** What is under a screen point at the current level (nodes at level 1, sectors at 2, clusters at 3). */
  function hitAt(p: { x: number; y: number }): Hit | null {
    if (!map) return null;
    const m = toMap(p.x, p.y);
    if (level === 2 && map.sectors.length) {
      const near = map.sectors.reduce((b, x) => (Math.hypot(x.x - m.x, x.y - m.y) < Math.hypot(b.x - m.x, b.y - m.y) ? x : b));
      return Math.hypot(near.x - m.x, near.y - m.y) < 30 / s + near.r ? { kind: 'sector', id: near.id } : null;
    }
    // Galaxy level: the cluster of the sector under the point (clusters are drawn as areas), else a cluster centre nearby.
    if (level === 3 && map.clusters.length) {
      const sec = map.sectors.reduce((b, x) => (Math.hypot(x.x - m.x, x.y - m.y) < Math.hypot(b.x - m.x, b.y - m.y) ? x : b));
      const near = map.clusters.reduce((b, x) => (Math.hypot(x.x - m.x, x.y - m.y) < Math.hypot(b.x - m.x, b.y - m.y) ? x : b));
      const id = sec.cluster && Math.hypot(sec.x - m.x, sec.y - m.y) < 30 / s + sec.r * 1.5 ? sec.cluster : Math.hypot(near.x - m.x, near.y - m.y) < 40 / s ? near.id : null;
      return id ? { kind: 'cluster', id } : null;
    }
    if (level !== 1) return null;
    let best: UiStarNode | null = null;
    let bd = 24 / s;
    for (const n of map.nodes) {
      const d = Math.hypot(n.x - m.x, n.y - m.y);
      if (d < bd && (n.known || s > 0.5)) {
        bd = d;
        best = n;
      }
    }
    return best ? { kind: 'node', id: best.id } : null;
  }
  function tap(p: { x: number; y: number }) {
    const hit = hitAt(p);
    if (level === 2) {
      picked = hit ? { kind: 'sector', id: hit.id } : null;
      selected = picked ? routeInto(picked.id) : null;
    } else if (level === 3) picked = hit ? { kind: 'cluster', id: hit.id } : null;
    else if (hit && hit.id === selected && route && !route.blocker && !route.overweight && (map?.state === 'active' || adrift)) go();
    else {
      selected = hit?.id ?? null;
      confirming = null;
      // On a phone the drawer is a bottom sheet over the lower part of the map: bring the picked node above it.
      const n = hit ? nodeById.get(hit.id) : null;
      if (n && w <= 600) flyTo(n.x, n.y + (0.22 * h) / s, s, 300);
    }
  }
  let hoverRaf = 0;
  function hovering(e: PointerEvent) {
    if (pointers.size || e.pointerType === 'touch') return;
    const p = local(e);
    cancelAnimationFrame(hoverRaf);
    hoverRaf = requestAnimationFrame(() => {
      hover = hitAt(p)?.id ?? null;
      stage.title = (level === 1 && gpu?.tip(p.x, p.y)) || '';
    });
  }
  function wheel(e: WheelEvent) {
    e.preventDefault();
    cancelAnimationFrame(camRaf);
    const p = local(e);
    zoomAt(p.x, p.y, wheelFactor(e.deltaY, e.deltaMode));
  }
  function key(e: KeyboardEvent) {
    if (e.key === 'Escape' && !locked) onClose();
  }

  /**
   * Set off along the plotted route (the second tap on the picked node, or the drawer's Jump). A jump that would leave crew or shuttles behind opens the confirm step in the drawer first.
   */
  function go(queue = false, overcharge = false) {
    if (!route || !map || (map.state !== 'active' && !adrift)) return;
    if (queue ? route.chargeOk : route.blocker) return;
    // A hull over what the engines carry only goes by the Overcharge button.
    if (route.overweight && !overcharge) return;
    overcharging = overcharge;
    queueing = queue;
    if (adrift) return fly(); // nothing is left behind: the ship has already left the node
    const w = api.jumpWarnings(map.ship);
    if (w.crew.length || w.vehicles.length || w.hostileDocked.length) {
      confirming = w;
      taking = [];
    } else fly();
  }
  /** Enter hyperspace with the plotted route (and the docked shuttles picked in the confirm step). */
  function fly() {
    if (!route || !map) return;
    const jump = jumpCommand(map.ship, route.path, taking);
    const oc = overcharging ? { overcharge: true } : {};
    api.dispatch(queueing ? { type: 'ftl.charge', ship: map.ship, jump: jump.route, ...(jump.withDocked ? { withDocked: jump.withDocked } : {}), ...oc } : { ...jump, ...oc });
    queueing = false;
    overcharging = false;
    confirming = null;
    taking = [];
    selected = null;
  }
  const toggle = (id: number) => (taking = toggleTake(taking, id));
  const drop = () => api.dispatch({ type: 'galaxy.drop' });
  const respond = (encounter: number, choice: UiEncounterChoice['choice']) => api.dispatch({ type: 'galaxy.respond', encounter, choice });
  /** The GPU view's scene: the data and the screen state the levels colour themselves by. */
  $effect(() => {
    if (!map || !gpu) return;
    gpu.scene({
      map, art, level, current, selected, hover, picked: picked?.id ?? null, route, routePts, routeSectors,
      inset: drawerOpen && w > 600 ? 340 : 0,
    });
  });
</script>

<svelte:window onkeydown={key} />

<div class="starmap legacy" data-testid="starmap" data-mode="browse">
  <div class="head">
    <PanelHead icon="map" title="Starmap" sub={locked ? 'Drop from hyperspace to leave the map' : here?.cluster ? (map?.clusters.find((c) => c.id === here.cluster)?.name ?? '') : ''}
      onBack={locked ? undefined : onClose} backTitle="Back to ship (Esc)" backTestId="starmap-close" />
  </div>
  <div class="statbar">
    {#if map}<StarmapStats {map} fuelBad={!!route && !route.fuelOk} chargeBad={!!route && !route.chargeOk} />{/if}
  </div>
  <div class="view" bind:clientWidth={w} bind:clientHeight={h}>
    <div bind:this={stage} class="stage" role="application" aria-label="Starmap" class:drag={dragging} class:over={!!hover && !dragging}
      onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up} onpointerleave={() => (hover = null)}></div>
    <div class="levels" role="group" aria-label="Zoom level">
      {#each LEVELS as l (l.n)}
        <button class:on={level === l.n} onclick={() => setLevel(l.n)} data-testid={`starmap-level-${l.n}`} aria-pressed={level === l.n}>{l.label}</button>
      {/each}
    </div>
    <div class="tools" class:shift={drawerOpen} role="toolbar" aria-label="Map view">
      <button class="tile" title="Zoom in" aria-label="Zoom in" onclick={() => zoomAt(w / 2, h / 2, 1.4)}><Icon name="zoomIn" size={22} /></button>
      <button class="tile" title="Zoom out" aria-label="Zoom out" onclick={() => zoomAt(w / 2, h / 2, 1 / 1.4)}><Icon name="zoomOut" size={22} /></button>
      <button class="tile" title="Centre on your ship" aria-label="Centre on your ship" onclick={recenter}><Icon name="recenter" size={22} /></button>
      <button class="tile" class:on={newsOpen} title="News and rumours" aria-label="News and rumours" aria-pressed={newsOpen} onclick={() => (newsOpen = !newsOpen)} data-testid="starmap-news-toggle"><Icon name="list" size={22} />{#if unread}<b class="badge" data-testid="starmap-news-unread">{unread > 9 ? '9+' : unread}</b>{/if}</button>
    </div>
    {#if seenFactions.length && !cardOpen && !newsOpen}
      <ul class="legend" aria-label="Territory">
        {#if map && (map.heat.notoriety > 0 || map.heat.hunters.length)}
          <li class="heat" class:wanted={map.heat.wanted} data-testid="starmap-heat">Notoriety {map.heat.notoriety}{#if map.heat.wanted}&nbsp;· wanted{/if}{#if map.heat.hunters.length}<br />Hunted by {map.heat.hunters.join(', ')}{/if}</li>
        {/if}
        <li class="lh">Territory</li>
        {#each seenFactions as f (f.id)}
          <li><i style={`background: ${toneColor(f.tone)}`}></i>{f.name}<em class={f.tier} title="Your standing with them">{f.tier} {f.standing > 0 ? '+' : ''}{f.standing}</em></li>
        {/each}
      </ul>
    {/if}
  {#if map && newsOpen && !drawerOpen}<StarmapNews news={map.news} turn={map.turn} onClose={() => (newsOpen = false)} />{/if}
  {#if interdiction}<InterdictModal encounter={interdiction} onChoose={respond} />{/if}
  {#if map && drawerOpen}
      <StarmapDrawer {map} node={sel} sector={sel ? sectorById.get(sel.sector) ?? null : null} cluster={sel ? map.clusters.find((c) => c.id === sectorById.get(sel.sector)?.cluster) ?? null : null}
        factions={map.factions} {route} nodes={nodeById} warnings={confirming} taking={new Set(taking)}
        {ftl} onGo={() => go()} onQueue={() => go(true)} onOvercharge={() => go(!!route && !route.chargeOk, true)} onCharge={() => map && api.dispatch({ type: 'ftl.charge', ship: map.ship })} onCancelCharge={() => map && api.dispatch({ type: 'ftl.cancelCharge', ship: map.ship })} onConfirm={fly} onCancel={() => (confirming = null)} onToggle={toggle} onDrop={drop} onRespond={respond} onClear={() => ((selected = null), (confirming = null))} />
  {/if}
  </div>
  {#if pickedInfo && level === 3}
    <StarmapInfo title={pickedInfo.title} lines={pickedInfo.lines} zoomLabel={pickedInfo.zoomLabel} onZoom={pickedInfo.zoom}
      action={'action' in pickedInfo ? pickedInfo.action : null} warn={'warn' in pickedInfo ? pickedInfo.warn : null} onClear={() => ((picked = null), (selected = null))} />
  {/if}
</div>

<style>
  .starmap { position: fixed; inset: 0; z-index: 11; display: flex; flex-direction: column; background: var(--bg); padding: var(--sat) var(--sar) 0 var(--sal); }
  .head { flex: none; padding: 10px 10px 0; border-bottom: 1px solid var(--line-hi); background: var(--panel); }
  .head :global(.ph) { margin: -10px -10px 0; }
  .statbar { flex: none; padding: 6px 10px; background: var(--panel); border-bottom: 1px solid var(--line); min-height: 34px; box-sizing: border-box; }
  .view { position: relative; flex: 1; min-height: 0; overflow: hidden; }
  .stage { position: absolute; inset: 0; touch-action: none; cursor: default; }
  .stage.over { cursor: pointer; }
  .stage.drag { cursor: grab; }
  .levels { position: absolute; left: 8px; top: 8px; display: flex; background: var(--panel); border: 1px solid var(--line-hi); }
  .levels button { border: 0; border-right: 1px solid var(--line); background: transparent; font: 600 14px var(--head-font); letter-spacing: 0.08em; text-transform: uppercase; color: var(--dim); }
  .levels button:last-child { border-right: 0; }
  .levels button:hover { background: var(--panel-3); }
  .levels button.on { background: var(--panel-3); box-shadow: inset 0 0 0 1px var(--cyan); color: var(--text); }
  .tools { position: absolute; right: 8px; top: 8px; display: flex; flex-direction: column; background: var(--panel); border: 1px solid var(--line-hi); }
  @media (min-width: 601px) { .tools.shift { right: 348px; } }
  .tools button.tile { border: 0; border-bottom: 1px solid var(--line); background: transparent; }
  .tools button.tile:last-child { border-bottom: 0; }
  .tools button.tile:hover { background: var(--panel-3); }
  .tools button.tile { position: relative; }
  .badge { position: absolute; top: 2px; right: 2px; min-width: 14px; height: 14px; padding: 0 3px; box-sizing: border-box; display: grid; place-items: center; font: 700 10px/1 var(--head-font); color: var(--bg); background: var(--amber); }
  .tools button.tile.on { box-shadow: inset 0 0 0 1px var(--cyan); }
  .legend { position: absolute; left: 8px; bottom: 8px; margin: 0; padding: 6px 10px; list-style: none; background: var(--panel); border: 1px solid var(--line-hi); font-size: 12px; display: grid; gap: 3px; pointer-events: none; }
  .legend .heat { color: #ffb43c; } .legend .heat.wanted { color: var(--red); }
  .legend .lh { font: 600 12px var(--head-font); letter-spacing: 0.08em; text-transform: uppercase; color: var(--cyan); }
  .legend i { display: inline-block; width: 10px; height: 10px; margin-right: 6px; vertical-align: -1px; }
  .legend em { font-style: normal; margin-left: 6px; font: 600 11px var(--head-font); letter-spacing: 0.06em; text-transform: uppercase; }
  em.hostile { color: var(--red); } em.friendly { color: var(--green); } em.neutral { color: var(--dim); }
  @media (max-width: 600px) {
    .levels button { min-width: 0; padding: 0 10px; }
    .tools button.tile { width: 40px; height: 40px; }
  }
</style>
