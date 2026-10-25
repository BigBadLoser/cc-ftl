<script lang="ts">
  /**
   * Starmap zoom level 1, drawn inside the map transform: sector outlines, central bodies, lanes, nodes, the planned
   * route, jumps reachable now, and the exits from your sector labelled where they lead (pinned inside the view).
   * `px(v)` converts screen pixels to map units; `view` is the visible map rectangle. Colours: starmapStyle.ts.
   */
  import type { UiStarArt, UiStarmap, UiStarNode, UiStarRoute } from './starmapApi';
  import StarmapBody from './StarmapBody.svelte';
  import { boxAt, placeLabels, type Box, type LabelItem } from './starmapLabels';
  import { BADGE, dangerColor, toneColor } from './starmapStyle';
  import { pixelArrow, pixelDiamond, pixelLine, pixelOutline, pixelPolyline, pixelSquare } from './starmapPixel';

  let { map, art = null, px, s, view, current, route, routePts, selected, hover, only = null, ship, inset = 0 }: {
    map: UiStarmap; art?: UiStarArt | null; px: (v: number) => number; s: number; view: { x0: number; y0: number; x1: number; y1: number };
    current: UiStarNode | null; route: UiStarRoute | null; routePts: string; selected: string | null; hover: string | null;
    /** Screen px at the right edge that the side drawer (and the map tools beside it) cover: labels stay clear of it. */
    inset?: number;
    /** Flee-target mode: only these nodes can be picked, the rest are dimmed. */
    only?: Set<string> | null;
    /** While a jump animates: the ship's position on the lane and the lane's ends. */
    ship: { x: number; y: number; fx: number; fy: number; tx: number; ty: number } | null;
  } = $props();

  /** The pixel grid: two screen pixels at this zoom (the size of the game's art pixels). Lines step on it, shapes snap to it. */
  const g = $derived(px(2));
  const sq = (x: number, y: number, r: number) => pixelSquare(x, y, px(r), g);
  const clampX = (x: number, m: number) => Math.max(view.x0 + px(m), Math.min(view.x1 - px(inset) - px(m), x));
  const clampY = (y: number, top: number, bottom: number) => Math.max(view.y0 + px(top), Math.min(view.y1 - px(bottom), y));
  /**
   * Exits grouped by the sector they lead to (one label each), at the far gateway pinned into the view; labels that would
   * overlap another label or a sector name step up or down, and are left out when nothing is free.
   */
  const exitLabels = $derived.by(() => {
    const k = px(1);
    // eslint-disable-next-line svelte/prefer-svelte-reactivity -- a temporary built inside $derived, never mutated after
    const by = new Map<string, UiStarmap['exits'][number]>();
    for (const e of map.exits) if (!by.has(e.to)) by.set(e.to, e);
    const obstacles: Box[] = map.sectors
      .filter((x) => x.known && x.x > view.x0 && x.x < view.x1 && x.y > view.y0 && x.y < view.y1)
      .map((x) => boxAt(clampX(x.x, 80), clampY(x.top - px(24), 24, 50) - 15 * k, 200 * k, 34 * k));
    // Node names, the level tabs (top left), the zoom tools (top right) and the legend (bottom left) are in the way too.
    for (const n of map.nodes) {
      if (named(n) && n.x > view.x0 && n.x < view.x1 && n.y > view.y0 && n.y < view.y1) obstacles.push(boxAt(n.x, n.y + 7 * k, (n.name.length * 7.6 + 10) * k, 18 * k));
    }
    obstacles.push({ x0: view.x0, y0: view.y1 - 96 * k, x1: view.x0 + 210 * k, y1: view.y1 });
    // The level tabs (top left) and the zoom tools (top right) sit over the map.
    obstacles.push({ x0: view.x0, y0: view.y0, x1: view.x0 + 296 * k, y1: view.y0 + 46 * k }, { x0: view.x1 - (inset + 64) * k, y0: view.y0, x1: view.x1, y1: view.y0 + 196 * k });
    const items = [...by.values()].map((e): LabelItem => {
      const w = (`To ${e.name ?? 'uncharted space'}`.length * 9.4 + 16) * k;
      const x = clampX(e.bx, Math.min(w / 2 / k + 8, 150));
      const y = clampY(e.by - px(24), 70, 40) - 15 * k;
      return { key: e.to, cands: [0, 34, -34, 68, -68].map((dy) => boxAt(x, y + dy * k, w, 32 * k)) };
    });
    const placed = placeLabels(items, obstacles);
    return [...by.values()].flatMap((e) => {
      const b = placed.get(e.to);
      return b ? [{ x: (b.x0 + b.x1) / 2, y: b.y0 + 15 * k, e }] : [];
    });
  });
  /**
   * NPC fleets in sensor range: a chevron beside its node (several at one node fan out) pointing along its heading, and a dashed line
   * toward the next node. The chevron's tooltip says who it is and where it is going.
   */
  const marks = $derived.by(() => {
    // eslint-disable-next-line svelte/prefer-svelte-reactivity -- a temporary built inside $derived, never mutated after
    const count = new Map<string, number>();
    return map.fleets.map((f) => {
      const k = count.get(f.node) ?? 0;
      count.set(f.node, k + 1);
      const side = (-135 + k * 55) * (Math.PI / 180);
      const heading = f.tx !== null && f.ty !== null ? (Math.atan2(f.ty - f.y, f.tx - f.x) * 180) / Math.PI : -90;
      return { f, ox: Math.cos(side), oy: Math.sin(side), heading };
    });
  });
  /** A node shows its name when it matters (yours, a jump away, picked, under the cursor) or when zoomed in. */
  const named = (n: UiStarNode) => n.known && (n.current || n.reachable || selected === n.id || hover === n.id || s > 1.2);
</script>

{#each map.sectors as sec (sec.id)}
  <path d={sec.outline} class="area" class:known={sec.known} class:cur={sec.id === map.currentSector} style={`--c: ${toneColor(sec.tone)}`} fill-rule="evenodd" />
  <path d={pixelOutline(sec.outline, g)} class="outline" class:known={sec.known} class:cur={sec.id === map.currentSector} style={`--c: ${toneColor(sec.tone)}`} />
{/each}
{#each map.sectors as sec (sec.id)}
  {#if sec.known && sec.body}<StarmapBody {art} seed={sec.id} kind={sec.body.kind} x={sec.body.x} y={sec.body.y} r={sec.body.r * 0.75} dim={sec.id === map.currentSector ? 1 : 0.55} />{/if}
{/each}
<!-- Lanes fade out toward the edges of the view, so long lanes leaving the sector do not crowd the frame. -->
<defs>
  <radialGradient id="sm-lane-fade"><stop offset="0.5" style="stop-color: var(--text)" /><stop offset="1" style="stop-color: var(--panel-2)" /></radialGradient>
  <mask id="sm-lane-mask" maskUnits="userSpaceOnUse" x={view.x0} y={view.y0} width={view.x1 - view.x0} height={view.y1 - view.y0}>
    <rect x={view.x0} y={view.y0} width={view.x1 - view.x0} height={view.y1 - view.y0} fill="url(#sm-lane-fade)" />
  </mask>
</defs>
<g mask="url(#sm-lane-mask)">
  {#each map.edges as e (e.id)}
    <path d={pixelLine(e.ax, e.ay, e.bx, e.by, g, { w: e.gate ? 2 : 1, dash: e.rift ? [1, 3] : e.anchor ? [4, 2] : undefined })} class="lane {e.kind}" class:gate={e.gate} class:rift={e.rift} />
  {/each}
  {#each map.exits as e (e.id)}
    <path d={pixelLine(e.ax, e.ay, e.bx, e.by, g, { w: e.kind === 'gate' ? 2 : 1, dash: e.kind === 'rift' ? [1, 3] : undefined })} class="lane exit {e.kind}" />
  {/each}
</g>
{#if current && !ship}
  {#each map.nodes.filter((n) => n.reachable && (!only || only.has(n.id))) as n (n.id)}
    <path d={pixelLine(current.x, current.y, n.x, n.y, g)} class="lane reach" />
  {/each}
{/if}
{#if routePts}
  <path d={pixelPolyline(routePts, g, { w: 2, dash: route?.blocker ? [4, 3] : undefined })} class="route" class:blocked={!!route?.blocker} />
{/if}
{#each map.nodes as n (n.id)}
  {@const dimmed = !!only && !only.has(n.id) && !n.current}
  {#if n.known}
    <g class:dimmed>
      {#if n.hostiles}<rect {...sq(n.x, n.y, 9)} class="hostile" />{/if}
      <rect {...sq(n.x, n.y, n.current ? 5 : 4)} class="node" class:visited={n.visited} class:cur={n.current} />
      {#if n.current && !ship}<rect {...sq(n.x, n.y, 11)} class="pulse" />{/if}
      {#if n.reachable && !ship && (!only || only.has(n.id))}<rect {...sq(n.x, n.y, 8)} class="reachable" />{/if}
      {#if n.current && !ship}<rect {...sq(n.x, n.y, 11)} class="here" />{/if}
      {#if hover === n.id}<rect {...sq(n.x, n.y, 12)} class="hov" />{/if}
      {#if s > 0.7}
        {#each n.badges as b, i (i)}
          <rect x={n.x + px(9 + i * 13)} y={n.y - px(6)} width={px(12)} height={px(12)} class="chip" style={`fill: ${BADGE[b] ?? 'var(--dim)'}`} />
          <text x={n.x + px(15 + i * 13)} y={n.y + px(3.6)} class="badge" font-size={px(10)}>{b}</text>
        {/each}
      {/if}
      {#each n.jobs ?? [] as j, i (i)}
        <path d={pixelDiamond(n.x - px(16), n.y + px(i * 16 - ((n.jobs?.length ?? 1) - 1) * 8), px(7), g)} class="job" class:bounty={j.kind === 'bounty'} data-testid="starmap-job-mark"><title>{j.label}</title></path>
      {/each}
      {#if named(n)}<text x={n.x} y={n.y + px(20)} class="nname" class:cur={n.current} font-size={px(13)} stroke-width={px(3)}>{n.name}</text>{/if}
    </g>
  {:else}
    <rect {...sq(n.x, n.y, 4)} class="unknown" class:dimmed />
  {/if}
  {#if selected === n.id}<rect {...sq(n.x, n.y, 14)} class="sel" />{/if}
{/each}
{#each marks as m (m.f.id)}
  {#if m.f.tx !== null && m.f.ty !== null}<path d={pixelLine(m.f.x, m.f.y, m.f.tx, m.f.ty, g, { dash: [2, 2] })} class="lane heading" style={`fill: ${toneColor(m.f.tone)}`} />{/if}
{/each}
{#each marks as m (m.f.id)}
  <g transform={`translate(${m.f.x + m.ox * px(21)} ${m.f.y + m.oy * px(21)})`} class="fleet" class:hostile={m.f.hostile} data-testid="starmap-fleet">
    <title>{m.f.faction} {m.f.role.toLowerCase()}, {m.f.ships} ship{m.f.ships > 1 ? 's' : ''}. {m.f.heading}.</title>
    <path d={pixelArrow(m.heading, g, 1.5)} style={`fill: ${toneColor(m.f.tone)}`} />
    {#if m.f.damaged}<rect x={-px(11)} y={-px(11)} width={px(22)} height={px(22)} class="adrift" />{/if}
  </g>
{/each}
{#if ship}
  {@const ang = (Math.atan2(ship.ty - ship.fy, ship.tx - ship.fx) * 180) / Math.PI}
  <path d={pixelLine(ship.fx, ship.fy, ship.x, ship.y, g, { w: 2 })} class="lane trail" />
  <rect {...sq(ship.x, ship.y, 11)} class="here" />
  <path d={pixelArrow(ang, g, 2)} transform={`translate(${ship.x} ${ship.y})`} class="ship" />
{/if}
{#each map.sectors as sec (sec.id)}
  {#if sec.known && sec.x > view.x0 && sec.x < view.x1 && sec.y > view.y0 && sec.y < view.y1}
    {@const lx = clampX(sec.x, 80)}
    {@const ly = clampY(sec.top - px(24), 24, 50)}
    <text x={lx} y={ly} class="sname" class:cur={sec.id === map.currentSector} font-size={px(14)} stroke-width={px(2)}>{sec.name}</text>
    <text x={lx} y={ly + px(15)} class="sdanger" font-size={px(12)} stroke-width={px(3)} style={`fill: ${dangerColor(sec.danger)}`}>Danger {sec.danger}</text>
  {/if}
{/each}
{#each exitLabels as l (l.e.to)}
  <text x={l.x} y={l.y} class="exitname" class:unk={!l.e.name} font-size={px(12)} stroke-width={px(2)}>To {l.e.name ?? 'uncharted space'}</text>
  <text x={l.x} y={l.y + px(15)} class="exitsub" font-size={px(12)} stroke-width={px(3)}>danger {l.e.danger}{l.e.kind === 'gate' ? ' · gate' : l.e.kind === 'rift' ? ' · rift' : ''} · {l.e.fuel} fuel</text>
{/each}

<style>
  /* Pixel look (starmapPixel.ts): every line is a set of filled pixel cells, never anti-aliased. */
  path, rect { shape-rendering: crispEdges; }
  .area { fill: var(--c); fill-opacity: 0.02; stroke: none; }
  .area.known { fill-opacity: 0.07; }
  .area.cur { fill-opacity: 0.12; }
  .outline { fill: var(--c); fill-opacity: 0.22; }
  .outline.known { fill-opacity: 0.5; }
  .outline.cur { fill-opacity: 0.85; }
  .lane { stroke: none; }
  .lane.hyperlane { fill: var(--cyan); fill-opacity: 0.6; }
  .lane.hyperlane.gate { fill-opacity: 0.9; }
  .lane.hyperlane.rift { fill: var(--text); fill-opacity: 0.5; }
  .lane.route { fill: var(--dim); fill-opacity: 0.7; }
  .lane.exit { fill: var(--cyan); fill-opacity: 0.6; }
  .lane.exit.rift { fill: var(--text); fill-opacity: 0.5; }
  .lane.reach { fill: var(--green); fill-opacity: 0.8; }
  path.route { fill: var(--amber); stroke: none; }
  .node { fill: var(--dim); }
  .node.visited { fill: var(--text); }
  .node.cur { fill: var(--cyan); }
  .reachable { fill: none; stroke: var(--green); stroke-width: 2; vector-effect: non-scaling-stroke; }
  .here { fill: none; stroke: var(--cyan); stroke-width: 2; vector-effect: non-scaling-stroke; }
  .hov { fill: none; stroke: var(--text); stroke-width: 1.5; vector-effect: non-scaling-stroke; }
  .pulse { fill: none; stroke: var(--cyan); stroke-width: 2; vector-effect: non-scaling-stroke; transform-box: fill-box; transform-origin: center; animation: pulse 2.2s ease-out infinite; pointer-events: none; }
  @keyframes pulse { from { transform: scale(1); opacity: 0.7; } to { transform: scale(2.2); opacity: 0; } }
  @media (prefers-reduced-motion: reduce) { .pulse { display: none; } }
  .ship { fill: var(--cyan); }
  .lane.trail { fill: var(--cyan); fill-opacity: 0.8; }
  .lane.heading { fill-opacity: 0.55; }
  .fleet path { stroke: none; }
  .fleet { pointer-events: all; }
  .adrift { fill: none; stroke: var(--amber); stroke-width: 1.2; stroke-dasharray: 2 2; vector-effect: non-scaling-stroke; }
  .sel { fill: none; stroke: var(--amber); stroke-width: 2; stroke-dasharray: 4 3; vector-effect: non-scaling-stroke; }
  .hostile { fill: color-mix(in srgb, var(--red) 25%, transparent); stroke: var(--red); stroke-width: 1.5; vector-effect: non-scaling-stroke; }
  .unknown { fill: var(--bg); stroke: var(--dim); stroke-opacity: 0.85; stroke-width: 1.5; vector-effect: non-scaling-stroke; }
  .job { fill: var(--amber); }
  .job.bounty { fill: var(--red); }
  .dimmed { opacity: 0.35; }
  text { text-anchor: middle; pointer-events: none; paint-order: stroke; stroke: var(--bg); stroke-linejoin: round; font-family: var(--head-font); }
  .badge { fill: var(--bg); font-weight: 700; stroke: none; }
  .nname { fill: var(--text); font-weight: 600; letter-spacing: 0.04em; }
  .nname.cur { fill: var(--cyan); }
  .sname { fill: var(--text); fill-opacity: 0.85; font-family: var(--pixel-font); font-weight: 400; letter-spacing: 0.06em; text-transform: uppercase; }
  .sname.cur { fill: var(--cyan); fill-opacity: 1; }
  .sdanger { font-weight: 600; letter-spacing: 0.05em; }
  .exitname { fill: var(--text); font-family: var(--pixel-font); font-weight: 400; letter-spacing: 0.04em; text-transform: uppercase; }
  .exitname.unk { fill: var(--dim); }
  .exitsub { fill: var(--dim); }
</style>
