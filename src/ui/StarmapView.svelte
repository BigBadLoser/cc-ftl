<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi } from './api';
  import type { UiStarmap, UiStarNode, UiStarRoute } from './starmapApi';
  import StarmapPanel from './StarmapPanel.svelte';
  import StarmapBody from './StarmapBody.svelte';
  import StarmapOuter from './StarmapOuter.svelte';

  let { api, onClose }: { api: UiApi; onClose: () => void } = $props();

  let map = $state<UiStarmap | null>(null);
  let w = $state(800);
  let h = $state(600);
  /** View centre (map units) and scale (screen px per unit). */
  let cx = $state(0);
  let cy = $state(0);
  let s = $state(1);
  let selected = $state<string | null>(null);
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
    if (level === 2 && map) {
      const near = map.sectors.reduce((b, x) => (Math.hypot(x.x - m.x, x.y - m.y) < Math.hypot(b.x - m.x, b.y - m.y) ? x : b));
      if (Math.hypot(near.x - m.x, near.y - m.y) < 30 / s + near.r) focusSector(near.id);
      return;
    }
    if (level === 3 && map && map.regions.length) {
      const near = map.regions.reduce((b, x) => (Math.hypot(x.x - m.x, x.y - m.y) < Math.hypot(b.x - m.x, b.y - m.y) ? x : b));
      cx = near.x;
      cy = near.y;
      s = Math.min(w, h) / 6000;
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
  const BADGE: Record<string, string> = { T: '#4ade80', M: '#60a5fa', R: '#c4b5fd', A: '#a3a3a3', D: '#fb923c' };
  const px = (v: number) => v / s;
  /** Danger tier label colours: calm cyan through amber to red. */
  const DANGER = ['#67e8f9', '#86efac', '#bef264', '#fde047', '#fbbf24', '#fb923c', '#f87171', '#ef4444', '#dc2626', '#e879f9'];
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
          {#if level === 1}
            {#each map.sectors as sec (sec.id)}
              <path d={sec.outline} class="outline" class:known={sec.known} class:cur={sec.id === map.currentSector} style={`--c:${sec.color}`} fill-rule="evenodd" />
            {/each}
            {#each map.sectors as sec (sec.id)}
              {#if sec.known && sec.body}<StarmapBody kind={sec.body.kind} x={sec.body.x} y={sec.body.y} r={sec.body.r} dim={sec.id === map.currentSector ? 1 : 0.6} />{/if}
            {/each}
            {#each map.edges as e (e.id)}
              <line x1={e.ax} y1={e.ay} x2={e.bx} y2={e.by} class={e.kind} class:anchor={e.anchor} class:gate={e.gate} class:rift={e.rift} />
            {/each}
            {#if current}
              {#each map.nodes.filter((n) => n.reachable) as n (n.id)}
                <line x1={current.x} y1={current.y} x2={n.x} y2={n.y} class="reach" />
              {/each}
            {/if}
            {#if routePts}
              <polyline points={routePts} class="route" class:blocked={!!route?.blocker} />
            {/if}
            {#each map.nodes as n (n.id)}
              {#if n.known}
                {#if n.hostiles}<circle cx={n.x} cy={n.y} r={px(9)} class="hostile" />{/if}
                <circle cx={n.x} cy={n.y} r={px(n.current ? 6 : 4.5)} class="node" class:visited={n.visited} class:cur={n.current} />
                {#if n.reachable}<circle cx={n.x} cy={n.y} r={px(8.5)} class="reachable" />{/if}
                {#if n.current}<circle cx={n.x} cy={n.y} r={px(11)} class="here" />{/if}
                {#if s > 0.7}
                  {#each n.badges as b, i (i)}
                    <rect x={n.x + px(9 + i * 12)} y={n.y - px(5)} width={px(11)} height={px(11)} rx={px(2)} fill={BADGE[b] ?? '#999'} />
                    <text x={n.x + px(14.5 + i * 12)} y={n.y + px(3.2)} class="badge" font-size={px(9)}>{b}</text>
                  {/each}
                {/if}
                {#if s > 1.5}<text x={n.x} y={n.y + px(17)} class="nname" font-size={px(10)} stroke-width={px(3)}>{n.name}</text>{/if}
              {:else}
                <circle cx={n.x} cy={n.y} r={px(1.6)} class="unknown" />
              {/if}
              {#if selected === n.id}<circle cx={n.x} cy={n.y} r={px(14)} class="sel" />{/if}
            {/each}
            {#each map.sectors as sec (sec.id)}
              {#if sec.known}
                <text x={sec.x} y={sec.top - px(22)} class="sname" class:cur={sec.id === map.currentSector} font-size={px(13)} stroke-width={px(3)}>{sec.name}</text>
                <text x={sec.x} y={sec.top - px(8)} class="sdanger" font-size={px(10)} stroke-width={px(3)} fill={DANGER[Math.min(DANGER.length - 1, sec.danger)]}>Danger {sec.danger}</text>
              {/if}
            {/each}
          {:else}
            <StarmapOuter {map} {level} {px} />
          {/if}
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
  {#if sel && map}
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
  .outline { fill: var(--c); fill-opacity: 0.02; stroke: var(--c); stroke-opacity: 0.22; stroke-dasharray: 4 5; vector-effect: non-scaling-stroke; }
  .outline.known { fill-opacity: 0.07; stroke-opacity: 0.5; stroke-dasharray: none; stroke-width: 1.4; }
  .outline.cur { fill-opacity: 0.12; stroke-opacity: 0.85; stroke-width: 2; }
  line.hyperlane.gate { stroke-width: 2.6; stroke-opacity: 0.9; }
  line.hyperlane.rift { stroke: #a78bfa; stroke-dasharray: 3 6; }
  line.reach { stroke: #4ade80; stroke-opacity: 0.8; stroke-width: 2.4; vector-effect: non-scaling-stroke; }
  .reachable { fill: none; stroke: #4ade80; stroke-width: 2; vector-effect: non-scaling-stroke; }
  line { vector-effect: non-scaling-stroke; }
  line.hyperlane { stroke: #7dd3fc; stroke-opacity: 0.7; stroke-width: 1.8; }
  line.hyperlane.anchor { stroke-dasharray: 7 4; }
  line.route { stroke: #8195b3; stroke-opacity: 0.6; stroke-width: 1; }
  polyline.route { fill: none; stroke: var(--amber); stroke-opacity: 1; stroke-width: 3.5; stroke-linejoin: round; vector-effect: non-scaling-stroke; }
  polyline.route.blocked { stroke-dasharray: 8 5; }
  .node { fill: #cbd5e1; stroke: #05080e; stroke-width: 1; vector-effect: non-scaling-stroke; }
  .node.visited { fill: #67e8f9; }
  .node.cur { fill: var(--cyan); }
  .here { fill: none; stroke: var(--cyan); stroke-width: 2; vector-effect: non-scaling-stroke; }
  .sel { fill: none; stroke: var(--amber); stroke-width: 2; stroke-dasharray: 4 3; vector-effect: non-scaling-stroke; }
  .hostile { fill: rgba(239, 68, 68, 0.25); stroke: var(--red); stroke-width: 1.5; vector-effect: non-scaling-stroke; }
  .unknown { fill: #34445c; }
  .badge { fill: #05080e; text-anchor: middle; font-weight: 700; pointer-events: none; }
  .nname { fill: var(--dim); text-anchor: middle; pointer-events: none; }
  .sname { fill: #e2e8f0; fill-opacity: 0.85; text-anchor: middle; font-weight: 600; letter-spacing: 0.15em; text-transform: uppercase; pointer-events: none; paint-order: stroke; stroke: #05080e; stroke-linejoin: round; }
  .sname.cur { fill: var(--cyan); fill-opacity: 1; }
  .sdanger { text-anchor: middle; font-weight: 600; pointer-events: none; paint-order: stroke; stroke: #05080e; stroke-linejoin: round; }
  .nname { paint-order: stroke; stroke: #05080e; stroke-linejoin: round; }
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
  }
</style>
