<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import type { UiApi } from './api';
  import type { UiJumpWarnings, UiStarmap, UiStarNode, UiStarRoute } from './starmapApi';
  import Icon from './Icon.svelte';
  import PanelHead from './PanelHead.svelte';
  import StarmapNebula from './StarmapNebula.svelte';
  import StarmapDrawer from './StarmapDrawer.svelte';
  import StarmapStats from './StarmapStats.svelte';
  import { fade } from 'svelte/transition';
  import StarmapInfo from './StarmapInfo.svelte';
  import StarmapGalaxy from './StarmapGalaxy.svelte';
  import StarmapCluster from './StarmapCluster.svelte';
  import StarmapSector from './StarmapSector.svelte';
  import { jumpCommand, toggleTake } from './starmapJump';
  import { BODY_LOOK, toneColor } from './starmapStyle';

  /**
   * The starmap screen. `flee`: the player's ship id when it was opened from the combat panel to pick where to flee to (only the
   * nodes one jump away can be picked, the cheapest affordable one is preselected); null for ordinary browsing and jumping.
   */
  let { api, flee = null, onClose, onSlide }: { api: UiApi; flee?: number | null; onClose: () => void; onSlide?: (on: boolean) => void } = $props();

  let map = $state<UiStarmap | null>(null);
  /** Flee-target mode: only while the ship is still in the node (once it is in hyperspace the map is the ordinary trip view). */
  const fleeing = $derived(flee !== null && map?.state !== 'hyperspace' && map?.state !== 'deploying');
  let w = $state(800);
  let h = $state(600);
  /** View centre (map units) and scale (screen px per unit). */
  let cx = $state(0);
  let cy = $state(0);
  let s = $state(1);
  let selected = $state<string | null>(null);
  /** A sector (level 2) or cluster (level 3) tapped on an outer level. */
  let picked = $state<{ kind: 'sector' | 'cluster'; id: string } | null>(null);
  /** The map thing under the cursor: a node (level 1), sector (2) or cluster (3) id. */
  let hover = $state<string | null>(null);
  let dragging = $state(false);
  let placed = false;
  let preselected = false;
  /** The jump confirm step (what the jump would leave behind) and which docked shuttles come along. */
  let confirming = $state<UiJumpWarnings | null>(null);
  let taking = $state<number[]>([]);

  const nodeById = $derived(new Map((map?.nodes ?? []).map((n) => [n.id, n])));
  const sectorById = $derived(new Map((map?.sectors ?? []).map((x) => [x.id, x])));
  const current = $derived(map ? nodeById.get(map.current) ?? null : null);
  const sel = $derived(selected ? nodeById.get(selected) ?? null : null);
  /** Recomputed whenever the map or its fuel/charge figures change. */
  const route = $derived<UiStarRoute | null>(map && sel && sel.known && !sel.current ? api.planRoute(sel.id) : null);
  const travelPts = $derived(map?.travel ? map.travel.route.slice(map.travel.at).map((id) => nodeById.get(id)).filter((n): n is UiStarNode => !!n).map((n) => `${n.x},${n.y}`).join(' ') : '');
  const routePts = $derived(travelPts || (route ? route.path.map((id) => nodeById.get(id)).filter((n): n is UiStarNode => !!n).map((n) => `${n.x},${n.y}`).join(' ') : ''));
  const here = $derived(map ? sectorById.get(map.currentSector) ?? null : null);
  /**
   * Semantic zoom by how much map fits across the shorter side: the sector (nodes), sectors as icons inside clusters,
   * then clusters as nodes.
   */
  const span = $derived(Math.min(w, h) / s);
  const level = $derived<1 | 2 | 3>(span < 2200 ? 1 : span < 11000 ? 2 : 3);
  /** The visible map rectangle (for pinning labels inside the view). */
  const view = $derived({ x0: cx - w / 2 / s, y0: cy - h / 2 / s, x1: cx + w / 2 / s, y1: cy + h / 2 / s });
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
        action: route && !route.blocker ? { label: fleeing ? 'Flee' : route.hops > 1 ? `Jump (1 of ${route.hops})` : 'Jump', run: go } : null,
        warn: route?.blocker ?? (route && !route.fuelOk ? 'Not enough fuel for the whole route.' : null),
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
  const drawerOpen = $derived(!!map && level < 3 && (!!map.travel || !!sel));
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
      s = from.s * (to / from.s) ** e;
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

  /** The nodes one jump away that can be picked in flee mode (null when browsing). */
  const only = $derived(fleeing && map ? new Set(map.nodes.filter((n) => n.reachable).map((n) => n.id)) : null);
  /** Flee preselect: the cheapest target that can go now (least fuel, then charge), else the cheapest of all. */
  function cheapestTarget(m: UiStarmap): string | null {
    const options = m.nodes.filter((n) => n.reachable).flatMap((n) => {
      const r = api.planRoute(n.id);
      return r ? [{ id: n.id, ok: !r.blocker, fuel: r.fuel, charge: r.nextCharge }] : [];
    });
    options.sort((p, q) => Number(q.ok) - Number(p.ok) || p.fuel - q.fuel || p.charge - q.charge || (p.id < q.id ? -1 : 1));
    return options[0]?.id ?? null;
  }

  onMount(() => {
    api.setStarmapOpen(true);
    const unsub = api.starmap.subscribe((m) => {
      const moved = map && map.current !== m.current;
      map = m;
      if (!placed && m.nodes.length) {
        placed = true;
        queueMicrotask(() => focusSector(m.currentSector, true));
      }
      if (moved && selected === m.current) selected = null;
      if (fleeing && !preselected && m.nodes.length) {
        preselected = true;
        selected = cheapestTarget(m);
      }
    });
    // A wheel listener must not be passive to stop the page from scrolling.
    svg.addEventListener('wheel', wheel, { passive: false });
    return () => {
      unsub();
      svg.removeEventListener('wheel', wheel);
    };
  });

  /**
   * The ship's glide along the route: visual only (a fixed tween per hop, independent of the sim's pace). `glide` is a float index
   * along `travel.route`; it moves toward the node being headed for (the next one while a hop is under way) at one hop per
   * GLIDE_MS, never overshooting, so fast sim turns queue up and play one after another.
   */
  const GLIDE_MS = 700;
  let glide = $state<number | null>(null);
  let tripKey = '';
  let follow = false;
  let raf = 0;
  let lastFrame = 0;
  function frame(now: number) {
    const dt = lastFrame ? Math.min(100, now - lastFrame) : 16;
    lastFrame = now;
    const tr = map?.travel;
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
      if (follow && level === 1 && ship) {
        cx += (ship.x - cx) * 0.12;
        cy += (ship.y - cy) * 0.12;
      }
    } else if (glide !== null) {
      glide = null;
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
  const ship = $derived.by(() => {
    const tr = map?.travel;
    if (!tr || glide === null) return null;
    const i = Math.min(tr.route.length - 2, Math.max(0, Math.floor(glide)));
    const a = nodeById.get(tr.route[i] as string);
    const b = nodeById.get(tr.route[i + 1] as string);
    if (!a || !b) return null;
    const t = Math.min(1, glide - i);
    const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
    return { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e, fx: a.x, fy: a.y, tx: b.x, ty: b.y };
  });

  const toMap = (px: number, py: number) => ({ x: cx + (px - w / 2) / s, y: cy + (py - h / 2) / s });
  const MIN_S = 0.015;
  const MAX_S = 6;
  function zoomAt(px: number, py: number, f: number) {
    const before = toMap(px, py);
    s = Math.min(MAX_S, Math.max(MIN_S, s * f));
    const after = toMap(px, py);
    cx += before.x - after.x;
    cy += before.y - after.y;
  }

  // Pointer handling: one finger pans, two pinch; a press that barely moves is a tap (selects the nearest node).
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- pointer bookkeeping, nothing renders from it
  const pointers = new Map<number, { x: number; y: number }>();
  let downAt: { x: number; y: number } | null = null;
  let moved = 0;
  let svg: SVGSVGElement;
  const local = (e: PointerEvent | WheelEvent) => {
    const r = svg.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  function down(e: PointerEvent) {
    cancelAnimationFrame(camRaf);
    svg.setPointerCapture(e.pointerId);
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
      if (d < bd && (n.known || s > 0.5) && (!only || only.has(n.id) || n.current)) {
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
    else if (hit && hit.id === selected && route && !route.blocker && map?.state === 'active') go();
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
    hoverRaf = requestAnimationFrame(() => (hover = hitAt(p)?.id ?? null));
  }
  function wheel(e: WheelEvent) {
    e.preventDefault();
    cancelAnimationFrame(camRaf);
    const p = local(e);
    zoomAt(p.x, p.y, e.deltaY < 0 ? 1.18 : 1 / 1.18);
  }
  function key(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }

  /**
   * Set off along the plotted route (the second tap on the picked node, or the drawer's Jump). Flee goes at once as a one-hop trip;
   * a jump that would leave crew or shuttles behind opens the confirm step in the drawer first.
   */
  function go() {
    if (!route || route.blocker || !map || map.state !== 'active') return;
    if (fleeing) {
      api.dispatch({ type: 'combat.flee', ship: flee as number, to: route.path[1] });
      return;
    }
    const w = api.jumpWarnings(map.ship);
    if (w.crew.length || w.vehicles.length || w.hostileDocked.length) {
      confirming = w;
      taking = [];
    } else fly();
  }
  /** Enter hyperspace with the plotted route (and the docked shuttles picked in the confirm step). */
  function fly() {
    if (!route || !map) return;
    api.dispatch(jumpCommand(map.ship, route.path, taking));
    confirming = null;
    taking = [];
    selected = null;
  }
  const toggle = (id: number) => (taking = toggleTake(taking, id));
  const drop = () => api.dispatch({ type: 'galaxy.drop' });
  const px = (v: number) => v / s;
</script>

<svelte:window onkeydown={key} />

<div class="starmap" data-testid="starmap" data-mode={fleeing ? 'flee' : 'browse'}>
  <div class="head">
    <PanelHead icon="map" title={fleeing ? 'Flee: pick a target' : 'Starmap'} sub={here?.cluster ? (map?.clusters.find((c) => c.id === here.cluster)?.name ?? '') : ''}
      onBack={onClose} backTitle="Back to ship (Esc)" backTestId="starmap-close" />
  </div>
  <div class="statbar">
    {#if map}<StarmapStats {map} fuelBad={!!route && !route.fuelOk} chargeBad={!!route && !route.chargeOk} />{/if}
  </div>
  <div class="view" bind:clientWidth={w} bind:clientHeight={h}>
    <svg bind:this={svg} width={w} height={h} role="application" aria-label="Starmap" class:drag={dragging} class:over={!!hover && !dragging}
      onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up} onpointerleave={() => (hover = null)}>
      {#if map}
        <defs>
          {#each Object.entries(BODY_LOOK) as [kind, look] (kind)}
            <radialGradient id={`sm-glow-${kind}`}><stop offset="0" style={`stop-color: ${look.glow}; stop-opacity: 0.5`} /><stop offset="1" style={`stop-color: ${look.glow}; stop-opacity: 0`} /></radialGradient>
          {/each}
        </defs>
        <g transform={`translate(${w / 2 - cx * s} ${h / 2 - cy * s}) scale(${s})`}>
          {#if level < 3}<StarmapNebula tiles={map.nebula} opacity={level === 1 ? 0.6 : 1} />{/if}
          {#key level}
            <g transition:fade={{ duration: 180 }}>
              {#if level === 1}
                <StarmapSector {map} {px} {s} {view} {current} {route} {routePts} {selected} {hover} {only} {ship} />
              {:else if level === 2}
                <StarmapCluster {map} {px} picked={picked?.id ?? null} {hover} {routePts} {routeSectors} />
              {:else}
                <StarmapGalaxy {map} {px} picked={picked?.id ?? null} {hover} />
              {/if}
            </g>
          {/key}
        </g>
      {/if}
    </svg>
    <div class="levels" role="group" aria-label="Zoom level">
      {#each LEVELS as l (l.n)}
        <button class:on={level === l.n} onclick={() => setLevel(l.n)} data-testid={`starmap-level-${l.n}`} aria-pressed={level === l.n}>{l.label}</button>
      {/each}
    </div>
    <div class="tools" class:shift={drawerOpen} role="toolbar" aria-label="Map view">
      <button class="tile" title="Zoom in" aria-label="Zoom in" onclick={() => zoomAt(w / 2, h / 2, 1.4)}><Icon name="zoomIn" size={22} /></button>
      <button class="tile" title="Zoom out" aria-label="Zoom out" onclick={() => zoomAt(w / 2, h / 2, 1 / 1.4)}><Icon name="zoomOut" size={22} /></button>
      <button class="tile" title="Centre on your ship" aria-label="Centre on your ship" onclick={recenter}><Icon name="recenter" size={22} /></button>
    </div>
    {#if seenFactions.length && !cardOpen}
      <ul class="legend" aria-label="Territory">
        <li class="lh">Territory</li>
        {#each seenFactions as f (f.id)}
          <li><i style={`background: ${toneColor(f.tone)}`}></i>{f.name}<em class={f.tier}>{f.tier}</em></li>
        {/each}
      </ul>
    {/if}
  {#if map && drawerOpen}
      <StarmapDrawer {map} node={sel} sector={sel ? sectorById.get(sel.sector) ?? null : null} cluster={sel ? map.clusters.find((c) => c.id === sectorById.get(sel.sector)?.cluster) ?? null : null}
        factions={map.factions} {route} nodes={nodeById} {fleeing} warnings={confirming} taking={new Set(taking)}
        onGo={go} onConfirm={fly} onCancel={() => (confirming = null)} onToggle={toggle} onDrop={drop} onClear={() => ((selected = null), (confirming = null))} />
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
  svg { display: block; touch-action: none; cursor: default; }
  svg.over { cursor: pointer; }
  svg.drag { cursor: grab; }
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
  .legend { position: absolute; left: 8px; bottom: 8px; margin: 0; padding: 6px 10px; list-style: none; background: var(--panel); border: 1px solid var(--line-hi); font-size: 12px; display: grid; gap: 3px; pointer-events: none; }
  .legend .lh { font: 600 12px var(--head-font); letter-spacing: 0.08em; text-transform: uppercase; color: var(--cyan); }
  .legend i { display: inline-block; width: 10px; height: 10px; margin-right: 6px; vertical-align: -1px; }
  .legend em { font-style: normal; margin-left: 6px; font: 600 11px var(--head-font); letter-spacing: 0.06em; text-transform: uppercase; }
  em.hostile { color: var(--red); } em.friendly { color: var(--green); } em.neutral { color: var(--dim); }
  @media (max-width: 600px) {
    .levels button { min-width: 0; padding: 0 10px; }
    .tools button.tile { width: 40px; height: 40px; }
  }
</style>
