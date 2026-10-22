<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import type { UiApi } from './api';
  import type { UiStarmap, UiStarNode, UiStarRoute } from './starmapApi';
  import StarmapNebula from './StarmapNebula.svelte';
  import StarmapPanel from './StarmapPanel.svelte';
  import { fade } from 'svelte/transition';
  import StarmapInfo from './StarmapInfo.svelte';
  import StarmapGalaxy from './StarmapGalaxy.svelte';
  import StarmapCluster from './StarmapCluster.svelte';
  import StarmapSector from './StarmapSector.svelte';

  let { api, onClose, onSlide }: { api: UiApi; onClose: () => void; onSlide?: (on: boolean) => void } = $props();

  let map = $state<UiStarmap | null>(null);
  let w = $state(800);
  let h = $state(600);
  /** View centre (map units) and scale (screen px per unit). */
  let cx = $state(0);
  let cy = $state(0);
  let s = $state(1);
  let selected = $state<string | null>(null);
  /** A sector (level 2) or cluster (level 3) tapped on an outer level. */
  let picked = $state<{ kind: 'sector' | 'cluster'; id: string } | null>(null);
  let placed = false;

  const nodeById = $derived(new Map((map?.nodes ?? []).map((n) => [n.id, n])));
  const sectorById = $derived(new Map((map?.sectors ?? []).map((x) => [x.id, x])));
  const current = $derived(map ? nodeById.get(map.current) ?? null : null);
  const sel = $derived(selected ? nodeById.get(selected) ?? null : null);
  /** Recomputed whenever the map or its fuel/charge figures change. */
  const route = $derived<UiStarRoute | null>(map && sel && sel.known && !sel.current ? api.planRoute(sel.id) : null);
  const routePts = $derived(route ? route.path.map((id) => nodeById.get(id)).filter((n): n is UiStarNode => !!n).map((n) => `${n.x},${n.y}`).join(' ') : '');
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
    { n: 1, label: 'Sector', short: 'Sec', span: 0 }, { n: 2, label: 'Cluster', short: 'Reg', span: 5200 }, { n: 3, label: 'Galaxy', short: 'Gal', span: 12500 },
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
        title: sec.known ? sec.name : 'Uncharted sector', color: sec.known ? sec.color : '#94a3b8', zoomLabel: 'Zoom in',
        lines: [
          `${owner ? owner.name : sec.known ? 'Unclaimed' : 'Owner unknown'} · danger ${sec.danger}`,
          reg?.revealed ? `${reg.name}, ${reg.typeLabel}` : 'Unclaimed space',
          sec.known ? `${sec.nodes} beacons${sec.body ? ` · ${sec.body.kind.replace('_', ' ')}` : ''}${sec.hub ? ' · clusteral hub' : ''}` : 'Not yet charted by your sensors',
          sec.id === map.currentSector ? 'You are here' : route ? `Route: ${route.hops} jump${route.hops > 1 ? 's' : ''} · ⛽ ${route.fuel} fuel · ${route.time} d` : 'No known route yet',
        ],
        zoom: () => focusSector(sec.id),
        action: route && !route.blocker ? { label: route.hops > 1 ? `Jump (1 of ${route.hops})` : 'Jump', run: jump } : null,
        warn: route?.blocker ?? (route && !route.fuelOk ? 'Not enough fuel for the whole route.' : null),
      };
    }
    const reg = map.clusters.find((r) => r.id === picked!.id);
    if (!reg) return null;
    const owner = map.factions.find((f) => f.id === reg.faction);
    return {
      title: reg.revealed ? reg.name : 'Uncharted cluster', color: reg.revealed ? reg.color : '#94a3b8', zoomLabel: 'Zoom in',
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

  onMount(() =>
    api.starmap.subscribe((m) => {
      const moved = map && map.current !== m.current;
      if (moved && map) startSlide(map, m);
      map = m;
      if (!placed && m.nodes.length) {
        placed = true;
        queueMicrotask(() => focusSector(m.currentSector, true));
      }
      if (moved && selected === m.current) selected = null;
    }),
  );

  /**
   * The jump animation: the ship marker slides along the lane from the old node to the new one (longer lanes take
   * longer), and if the jump enters another sector the camera glides to it. The bridge generates ahead meanwhile.
   */
  let slide = $state<{ fx: number; fy: number; tx: number; ty: number; t: number } | null>(null);
  let raf = 0;
  function startSlide(prev: UiStarmap, next: UiStarmap) {
    const a = prev.nodes.find((n) => n.id === prev.current);
    const b = next.nodes.find((n) => n.id === next.current);
    if (!a || !b) return;
    const dur = Math.min(1600, 600 + Math.hypot(b.x - a.x, b.y - a.y) * 0.8);
    const cam0 = { cx, cy, s };
    const sec = next.sectors.find((x) => x.id === next.currentSector);
    const follow = level === 1 && sec && prev.currentSector !== next.currentSector;
    const cam1 = follow ? { cx: sec.x, cy: sec.y, s: (Math.min(w, h) * 0.62) / (2 * sec.r + 60) } : cam0;
    const t0 = performance.now();
    cancelAnimationFrame(raf);
    if (follow) cancelAnimationFrame(camRaf);
    onSlide?.(true);
    const frame = (now: number) => {
      const t = Math.min(1, (now - t0) / dur);
      const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      slide = t < 1 ? { fx: a.x, fy: a.y, tx: b.x, ty: b.y, t: e } : null;
      if (!slide) onSlide?.(false);
      if (follow) {
        cx = cam0.cx + (cam1.cx - cam0.cx) * e;
        cy = cam0.cy + (cam1.cy - cam0.cy) * e;
        s = cam0.s + (cam1.s - cam0.s) * e;
      }
      if (t < 1) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  }
  onDestroy(() => {
    cancelAnimationFrame(raf);
    cancelAnimationFrame(camRaf);
    onSlide?.(false);
  });
  const ship = $derived(slide ? { x: slide.fx + (slide.tx - slide.fx) * slide.t, y: slide.fy + (slide.ty - slide.fy) * slide.t, fx: slide.fx, fy: slide.fy, tx: slide.tx, ty: slide.ty } : null);

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
    if (!prev) return;
    const p = local(e);
    if (pointers.size === 1) {
      cx -= (p.x - prev.x) / s;
      cy -= (p.y - prev.y) / s;
      moved += Math.hypot(p.x - prev.x, p.y - prev.y);
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
    if (!pointers.size) downAt = null;
  }
  function tap(p: { x: number; y: number }) {
    const m = toMap(p.x, p.y);
    // Outer levels: a tap zooms one level in, onto the sector (level 2) or cluster (level 3) under it.
    if (level === 2 && map && map.sectors.length) {
      const near = map.sectors.reduce((b, x) => (Math.hypot(x.x - m.x, x.y - m.y) < Math.hypot(b.x - m.x, b.y - m.y) ? x : b));
      picked = Math.hypot(near.x - m.x, near.y - m.y) < 30 / s + near.r ? { kind: 'sector', id: near.id } : null;
      selected = picked ? routeInto(picked.id) : null;
      return;
    }
    // Galaxy level: the cluster of the sector under the tap (clusters are drawn as areas), else a cluster centre nearby.
    if (level === 3 && map && map.clusters.length) {
      const sec = map.sectors.reduce((b, x) => (Math.hypot(x.x - m.x, x.y - m.y) < Math.hypot(b.x - m.x, b.y - m.y) ? x : b));
      const near = map.clusters.reduce((b, x) => (Math.hypot(x.x - m.x, x.y - m.y) < Math.hypot(b.x - m.x, b.y - m.y) ? x : b));
      const id = sec.cluster && Math.hypot(sec.x - m.x, sec.y - m.y) < 30 / s + sec.r * 1.5 ? sec.cluster : Math.hypot(near.x - m.x, near.y - m.y) < 40 / s ? near.id : null;
      picked = id ? { kind: 'cluster', id } : null;
      return;
    }
    let best: UiStarNode | null = null;
    let bd = 22 / s;
    for (const n of map?.nodes ?? []) {
      const d = Math.hypot(n.x - m.x, n.y - m.y);
      if (d < bd && (n.known || s > 0.5)) {
        bd = d;
        best = n;
      }
    }
    selected = best?.id ?? null;
  }
  function wheel(e: WheelEvent) {
    e.preventDefault();
    cancelAnimationFrame(camRaf);
    const p = local(e);
    zoomAt(p.x, p.y, e.deltaY < 0 ? 1.18 : 1 / 1.18);
  }
  function key(e: KeyboardEvent) {
    if (e.key === 'Escape' || e.key === 'm') onClose();
  }

  function jump() {
    const next = route?.path[1];
    if (next && !route?.blocker) api.dispatch({ type: 'galaxy.jump', ship: map!.ship, to: next });
  }

  const GLOW: Record<string, string> = { star: '#fbbf24', red_dwarf: '#f87171', blue_giant: '#60a5fa', gas_giant: '#f59e0b', nebula: '#a855f7', black_hole: '#f97316' };
  const px = (v: number) => v / s;
</script>

<svelte:window onkeydown={key} />

<div class="starmap" data-testid="starmap">
  <header>
    <strong>Starmap</strong>
    {#if map}
      <span class="chip" class:bad={route && !route.fuelOk} data-testid="starmap-fuel">⛽ {map.fuel}</span>
      <span class="chip" class:bad={route && !route.chargeOk}>FTL {map.charge}/{map.chargeMax}s</span>
      <span class="chip dim long">{map.jumps} jumps · {map.days} d</span>
      {#if here?.cluster}
        {@const reg = map.clusters.find((r) => r.id === here?.cluster)}
        {#if reg}<span class="chip long" style={`color:${reg.color}`}>{reg.name} · <span class="dim">{reg.typeLabel}</span></span>{/if}
      {/if}
    {/if}
    <span class="grow"></span>
    <span class="levels" role="group" aria-label="Zoom level">
      {#each LEVELS as l (l.n)}
        <button class:on={level === l.n} onclick={() => setLevel(l.n)} data-testid={`starmap-level-${l.n}`} aria-label={l.label}><span class="long">{l.label}</span><span class="short">{l.short}</span></button>
      {/each}
    </span>
    <button class="zoom" onclick={() => zoomAt(w / 2, h / 2, 1.4)} aria-label="Zoom in">+</button>
    <button class="zoom" onclick={() => zoomAt(w / 2, h / 2, 1 / 1.4)} aria-label="Zoom out">−</button>
    <button onclick={recenter} aria-label="Centre on ship">⌖</button>
    <button onclick={onClose} aria-label="Close starmap" data-testid="starmap-close">✕</button>
  </header>
  <div class="view" bind:clientWidth={w} bind:clientHeight={h}>
    <svg bind:this={svg} width={w} height={h} role="application" aria-label="Starmap"
      onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up} onwheel={wheel}>
      {#if map}
        <defs>
          {#each Object.entries(GLOW) as [kind, col] (kind)}
            <radialGradient id={`sm-glow-${kind}`}><stop offset="0" stop-color={col} stop-opacity="0.5" /><stop offset="1" stop-color={col} stop-opacity="0" /></radialGradient>
          {/each}
        </defs>
        <g transform={`translate(${w / 2 - cx * s} ${h / 2 - cy * s}) scale(${s})`}>
          {#if level < 3}<StarmapNebula tiles={map.nebula} opacity={level === 1 ? 0.6 : 1} />{/if}
          {#key level}
            <g transition:fade={{ duration: 180 }}>
              {#if level === 1}
                <StarmapSector {map} {px} {s} {view} {current} {route} {routePts} {selected} {ship} />
              {:else if level === 2}
                <StarmapCluster {map} {px} picked={picked?.id ?? null} {routePts} {routeSectors} />
              {:else}
                <StarmapGalaxy {map} {px} picked={picked?.id ?? null} />
              {/if}
            </g>
          {/key}
        </g>
      {/if}
    </svg>
    {#if seenFactions.length}
      <ul class="legend">
        {#each seenFactions as f (f.id)}
          <li><i style={`background:${f.color}`}></i>{f.name} <em class={f.tier}>{f.tier}</em></li>
        {/each}
      </ul>
    {/if}
  </div>
  {#if pickedInfo && level > 1}
    <StarmapInfo title={pickedInfo.title} color={pickedInfo.color} lines={pickedInfo.lines} zoomLabel={pickedInfo.zoomLabel} onZoom={pickedInfo.zoom}
      action={'action' in pickedInfo ? pickedInfo.action : null} warn={'warn' in pickedInfo ? pickedInfo.warn : null} onClear={() => ((picked = null), (selected = null))} />
  {/if}
  {#if sel && map && level === 1}
    <StarmapPanel node={sel} sector={sectorById.get(sel.sector) ?? null} factions={map.factions} {route} onJump={jump} onClear={() => (selected = null)} />
  {/if}
</div>

<style>
  .starmap { position: fixed; inset: 0; z-index: 11; display: flex; flex-direction: column; background: #05080e; padding: var(--sat) var(--sar) 0 var(--sal); }
  header { display: flex; align-items: center; gap: 6px; padding: 8px; border-bottom: 1px solid var(--line); background: var(--panel); }
  header strong { color: var(--cyan); margin-right: 4px; }
  .chip { padding: 3px 8px; border: 1px solid var(--line); border-radius: 12px; font-size: 13px; white-space: nowrap; }
  .chip.bad { border-color: var(--red); color: #ffb4b4; }
  .dim { color: var(--dim); }
  .grow { flex: 1; }
  .view { position: relative; flex: 1; min-height: 0; overflow: hidden; }
  svg { display: block; touch-action: none; cursor: grab; }
  .levels { display: inline-flex; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }
  .levels button { border: 0; border-radius: 0; padding: 4px 10px; background: transparent; color: var(--dim); }
  .levels button.on { background: #0e4a56; color: var(--cyan); }
  .short { display: none; }
  .legend { position: absolute; left: 8px; top: 8px; margin: 0; padding: 6px 8px; list-style: none; background: var(--panel); border: 1px solid var(--line); border-radius: 8px; font-size: 12px; display: grid; gap: 2px; pointer-events: none; }
  .legend i { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 6px; vertical-align: -1px; }
  .legend em { font-style: normal; margin-left: 4px; font-size: 11px; }
  em.hostile { color: #fca5a5; } em.friendly { color: #86efac; } em.neutral { color: var(--dim); }
  @media (max-width: 600px) {
    header { padding: 6px 8px; gap: 4px; }
    header .chip { padding: 3px 6px; font-size: 12px; }
    .zoom { display: none; }
    header button { min-width: 36px; min-height: 36px; padding: 0 8px; }
    .long { display: none; }
    .legend { font-size: 11px; padding: 4px 6px; }
    .levels button { min-width: 0; padding: 4px 6px; font-size: 12px; }
    .short { display: inline; }
    header strong { display: none; }
  }
</style>
