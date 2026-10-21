<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi } from './api';
  import type { UiStarmap, UiStarNode, UiStarRoute } from './starmapApi';
  import StarmapPanel from './StarmapPanel.svelte';
  import { fade } from 'svelte/transition';
  import StarmapInfo from './StarmapInfo.svelte';
  import StarmapOuter from './StarmapOuter.svelte';
  import StarmapSector from './StarmapSector.svelte';

  let { api, onClose }: { api: UiApi; onClose: () => void } = $props();

  let map = $state<UiStarmap | null>(null);
  let w = $state(800);
  let h = $state(600);
  /** View centre (map units) and scale (screen px per unit). */
  let cx = $state(0);
  let cy = $state(0);
  let s = $state(1);
  let selected = $state<string | null>(null);
  /** A sector (level 2) or region (level 3) tapped on an outer level. */
  let picked = $state<{ kind: 'sector' | 'region'; id: string } | null>(null);
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
   * Semantic zoom by how much map fits across the shorter side: the sector (nodes), sectors as icons inside regions,
   * then regions as nodes.
   */
  const span = $derived(Math.min(w, h) / s);
  const level = $derived<1 | 2 | 3>(span < 2200 ? 1 : span < 11000 ? 2 : 3);
  /** The visible map rectangle (for pinning labels inside the view). */
  const view = $derived({ x0: cx - w / 2 / s, y0: cy - h / 2 / s, x1: cx + w / 2 / s, y1: cy + h / 2 / s });
  const LEVELS = [
    { n: 1, label: 'Sector', short: 'Sec', span: 0 }, { n: 2, label: 'Region', short: 'Reg', span: 5200 }, { n: 3, label: 'Galaxy', short: 'Gal', span: 12500 },
  ] as const;
  /** Jump to a zoom level, centred on your sector. */
  function setLevel(n: 1 | 2 | 3) {
    picked = null;
    if (!map) return;
    if (n === 1) return focusSector(map.currentSector);
    const sec = sectorById.get(map.currentSector);
    if (sec) {
      cx = sec.x;
      cy = sec.y;
    }
    s = Math.min(w, h) / LEVELS[n - 1]!.span;
  }
  const pickedInfo = $derived.by(() => {
    if (!map || !picked) return null;
    if (picked.kind === 'sector') {
      const sec = sectorById.get(picked.id);
      if (!sec) return null;
      const reg = map.regions.find((r) => r.id === sec.region);
      const owner = map.factions.find((f) => f.id === sec.faction);
      return {
        title: sec.known ? sec.name : 'Uncharted sector', color: sec.known ? sec.color : '#94a3b8', zoomLabel: 'Zoom in',
        lines: [
          `${owner ? owner.name : sec.known ? 'Unclaimed' : 'Owner unknown'} · danger ${sec.danger}`,
          reg?.revealed ? `${reg.name}, ${reg.typeLabel}` : 'Unclaimed space',
          sec.known ? `${sec.nodes} beacons${sec.body ? ` · ${sec.body.kind.replace('_', ' ')}` : ''}${sec.hub ? ' · regional hub' : ''}` : 'Not yet charted by your sensors',
        ],
        zoom: () => focusSector(sec.id),
      };
    }
    const reg = map.regions.find((r) => r.id === picked!.id);
    if (!reg) return null;
    const owner = map.factions.find((f) => f.id === reg.faction);
    return {
      title: reg.revealed ? reg.name : 'Uncharted region', color: reg.revealed ? reg.color : '#94a3b8', zoomLabel: 'Zoom in',
      lines: [
        reg.revealed ? `${reg.typeLabel}${owner ? ` · ${owner.name}` : ''}` : 'Unknown',
        `${reg.sectors} sectors${reg.current ? ' · you are here' : ''}`,
      ],
      zoom: () => {
        cx = reg.x;
        cy = reg.y;
        s = Math.min(w, h) / LEVELS[1].span;
        picked = null;
      },
    };
  });
  const seenFactions = $derived(map ? map.factions.filter((f) => map!.sectors.some((x) => x.known && x.faction === f.id)) : []);

  /** Centre on a sector so it fills most of the shorter side (the default view: your sector). */
  function focusSector(id: string) {
    const sec = sectorById.get(id);
    if (!sec) return;
    cx = sec.x;
    cy = sec.y;
    s = (Math.min(w, h) * 0.62) / (2 * sec.r + 60);
  }
  function recenter() {
    if (map) focusSector(map.currentSector);
  }

  onMount(() =>
    api.starmap.subscribe((m) => {
      const moved = map && map.current !== m.current;
      map = m;
      if (!placed && m.nodes.length) {
        placed = true;
        queueMicrotask(recenter);
      }
      if (moved && selected === m.current) selected = null;
    }),
  );

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
    // Outer levels: a tap zooms one level in, onto the sector (level 2) or region (level 3) under it.
    if (level === 2 && map && map.sectors.length) {
      const near = map.sectors.reduce((b, x) => (Math.hypot(x.x - m.x, x.y - m.y) < Math.hypot(b.x - m.x, b.y - m.y) ? x : b));
      picked = Math.hypot(near.x - m.x, near.y - m.y) < 30 / s + near.r ? { kind: 'sector', id: near.id } : null;
      return;
    }
    if (level === 3 && map && map.regions.length) {
      const near = map.regions.reduce((b, x) => (Math.hypot(x.x - m.x, x.y - m.y) < Math.hypot(b.x - m.x, b.y - m.y) ? x : b));
      picked = Math.hypot(near.x - m.x, near.y - m.y) < 40 / s ? { kind: 'region', id: near.id } : null;
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
    const p = local(e);
    zoomAt(p.x, p.y, e.deltaY < 0 ? 1.18 : 1 / 1.18);
  }
  function key(e: KeyboardEvent) {
    if (e.key === 'Escape' || e.key === 'm') onClose();
  }

  function jump() {
    const next = route?.path[1];
    if (next && !route?.blocker) api.dispatch({ type: 'galaxy.jump', to: next });
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
      {#if here?.region}
        {@const reg = map.regions.find((r) => r.id === here?.region)}
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
          {#key level}
            <g transition:fade={{ duration: 180 }}>
              {#if level === 1}
                <StarmapSector {map} {px} {s} {view} {current} {route} {routePts} {selected} />
              {:else}
                <StarmapOuter {map} {level} {px} picked={picked?.id ?? null} />
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
    <StarmapInfo title={pickedInfo.title} color={pickedInfo.color} lines={pickedInfo.lines} zoomLabel={pickedInfo.zoomLabel} onZoom={pickedInfo.zoom} onClear={() => (picked = null)} />
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
