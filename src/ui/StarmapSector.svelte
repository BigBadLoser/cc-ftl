<script lang="ts">
  /**
   * Starmap zoom level 1, drawn inside the map transform: sector outlines, central bodies, lanes, nodes, the planned
   * route, jumps reachable now, and the exits from your sector labelled where they lead (pinned inside the view).
   * `px(v)` converts screen pixels to map units; `view` is the visible map rectangle. Colours: starmapStyle.ts.
   */
  import type { UiStarmap, UiStarNode, UiStarRoute } from './starmapApi';
  import StarmapBody from './StarmapBody.svelte';
  import { boxAt, placeLabels, type Box, type LabelItem } from './starmapLabels';
  import { BADGE, dangerColor, toneColor } from './starmapStyle';

  let { map, px, s, view, current, route, routePts, selected, hover, only = null, ship }: {
    map: UiStarmap; px: (v: number) => number; s: number; view: { x0: number; y0: number; x1: number; y1: number };
    current: UiStarNode | null; route: UiStarRoute | null; routePts: string; selected: string | null; hover: string | null;
    /** Flee-target mode: only these nodes can be picked, the rest are dimmed. */
    only?: Set<string> | null;
    /** While a jump animates: the ship's position on the lane and the lane's ends. */
    ship: { x: number; y: number; fx: number; fy: number; tx: number; ty: number } | null;
  } = $props();

  const clampX = (x: number, m: number) => Math.max(view.x0 + px(m), Math.min(view.x1 - px(m), x));
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
    // The level tabs (top left) and the zoom tools (top right) sit over the map.
    obstacles.push({ x0: view.x0, y0: view.y0, x1: view.x0 + 296 * k, y1: view.y0 + 46 * k }, { x0: view.x1 - 58 * k, y0: view.y0, x1: view.x1, y1: view.y0 + 134 * k });
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
  /** A node shows its name when it matters (yours, a jump away, picked, under the cursor) or when zoomed in. */
  const named = (n: UiStarNode) => n.known && (n.current || n.reachable || selected === n.id || hover === n.id || s > 1.2);
</script>

{#each map.sectors as sec (sec.id)}
  <path d={sec.outline} class="outline" class:known={sec.known} class:cur={sec.id === map.currentSector} style={`--c: ${toneColor(sec.tone)}`} fill-rule="evenodd" />
{/each}
{#each map.sectors as sec (sec.id)}
  {#if sec.known && sec.body}<StarmapBody kind={sec.body.kind} x={sec.body.x} y={sec.body.y} r={sec.body.r * 0.75} dim={sec.id === map.currentSector ? 1 : 0.55} />{/if}
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
    <line x1={e.ax} y1={e.ay} x2={e.bx} y2={e.by} class={e.kind} class:anchor={e.anchor} class:gate={e.gate} class:rift={e.rift} />
  {/each}
  {#each map.exits as e (e.id)}
    <line x1={e.ax} y1={e.ay} x2={e.bx} y2={e.by} class="exit {e.kind}" />
  {/each}
</g>
{#if current && !ship}
  {#each map.nodes.filter((n) => n.reachable && (!only || only.has(n.id))) as n (n.id)}
    <line x1={current.x} y1={current.y} x2={n.x} y2={n.y} class="reach" />
  {/each}
{/if}
{#if routePts}
  <polyline points={routePts} class="route" class:blocked={!!route?.blocker} />
{/if}
{#each map.nodes as n (n.id)}
  {@const dimmed = !!only && !only.has(n.id) && !n.current}
  {#if n.known}
    <g class:dimmed>
      {#if n.hostiles}<circle cx={n.x} cy={n.y} r={px(9)} class="hostile" />{/if}
      <circle cx={n.x} cy={n.y} r={px(n.current ? 6 : n.visited ? 4.5 : 4.2)} class="node" class:visited={n.visited} class:cur={n.current} />
      {#if n.current && !ship}<circle cx={n.x} cy={n.y} r={px(11)} class="pulse" />{/if}
      {#if n.reachable && !ship && (!only || only.has(n.id))}<circle cx={n.x} cy={n.y} r={px(8.5)} class="reachable" />{/if}
      {#if n.current && !ship}<circle cx={n.x} cy={n.y} r={px(11)} class="here" />{/if}
      {#if hover === n.id}<circle cx={n.x} cy={n.y} r={px(12)} class="hov" />{/if}
      {#if s > 0.7}
        {#each n.badges as b, i (i)}
          <rect x={n.x + px(9 + i * 13)} y={n.y - px(6)} width={px(12)} height={px(12)} class="chip" style={`fill: ${BADGE[b] ?? 'var(--dim)'}`} />
          <text x={n.x + px(15 + i * 13)} y={n.y + px(3.6)} class="badge" font-size={px(10)}>{b}</text>
        {/each}
      {/if}
      {#if named(n)}<text x={n.x} y={n.y + px(20)} class="nname" class:cur={n.current} font-size={px(13)} stroke-width={px(3)}>{n.name}</text>{/if}
    </g>
  {:else}
    <circle cx={n.x} cy={n.y} r={px(4)} class="unknown" class:dimmed />
  {/if}
  {#if selected === n.id}<circle cx={n.x} cy={n.y} r={px(14)} class="sel" />{/if}
{/each}
{#if ship}
  {@const ang = (Math.atan2(ship.ty - ship.fy, ship.tx - ship.fx) * 180) / Math.PI}
  <line x1={ship.fx} y1={ship.fy} x2={ship.x} y2={ship.y} class="trail" />
  <circle cx={ship.x} cy={ship.y} r={px(11)} class="here" />
  <path d={`M ${px(8)} 0 L ${px(-6)} ${px(-5)} L ${px(-3)} 0 L ${px(-6)} ${px(5)} Z`} transform={`translate(${ship.x} ${ship.y}) rotate(${ang})`} class="ship" />
{/if}
{#each map.sectors as sec (sec.id)}
  {#if sec.known && sec.x > view.x0 && sec.x < view.x1 && sec.y > view.y0 && sec.y < view.y1}
    {@const lx = clampX(sec.x, 80)}
    {@const ly = clampY(sec.top - px(24), 24, 50)}
    <text x={lx} y={ly} class="sname" class:cur={sec.id === map.currentSector} font-size={px(15)} stroke-width={px(3)}>{sec.name}</text>
    <text x={lx} y={ly + px(15)} class="sdanger" font-size={px(12)} stroke-width={px(3)} style={`fill: ${dangerColor(sec.danger)}`}>Danger {sec.danger}</text>
  {/if}
{/each}
{#each exitLabels as l (l.e.to)}
  <text x={l.x} y={l.y} class="exitname" class:unk={!l.e.name} font-size={px(14)} stroke-width={px(3)}>To {l.e.name ?? 'uncharted space'}</text>
  <text x={l.x} y={l.y + px(15)} class="exitsub" font-size={px(12)} stroke-width={px(3)}>danger {l.e.danger}{l.e.kind === 'gate' ? ' · gate' : l.e.kind === 'rift' ? ' · rift' : ''} · {l.e.fuel} fuel</text>
{/each}

<style>
  .outline { fill: var(--c); fill-opacity: 0.02; stroke: var(--c); stroke-opacity: 0.22; stroke-dasharray: 4 5; vector-effect: non-scaling-stroke; }
  .outline.known { fill-opacity: 0.07; stroke-opacity: 0.5; stroke-dasharray: none; stroke-width: 1.4; }
  .outline.cur { fill-opacity: 0.12; stroke-opacity: 0.85; stroke-width: 2; }
  line { vector-effect: non-scaling-stroke; }
  line.hyperlane { stroke: var(--cyan); stroke-opacity: 0.6; stroke-width: 1.8; }
  line.hyperlane.anchor { stroke-dasharray: 7 4; }
  line.hyperlane.gate { stroke-width: 2.6; stroke-opacity: 0.9; }
  line.hyperlane.rift { stroke: var(--text); stroke-opacity: 0.5; stroke-dasharray: 3 6; }
  line.route { stroke: var(--dim); stroke-opacity: 0.7; stroke-width: 1; }
  line.exit { stroke: var(--cyan); stroke-opacity: 0.6; stroke-width: 1.8; }
  line.exit.gate { stroke-width: 2.6; }
  line.exit.rift { stroke: var(--text); stroke-opacity: 0.5; stroke-dasharray: 3 6; }
  line.reach { stroke: var(--green); stroke-opacity: 0.8; stroke-width: 2.4; }
  polyline.route { fill: none; stroke: var(--amber); stroke-width: 3.5; stroke-linejoin: round; vector-effect: non-scaling-stroke; }
  polyline.route.blocked { stroke-dasharray: 8 5; }
  .node { fill: var(--dim); stroke: var(--bg); stroke-width: 1; vector-effect: non-scaling-stroke; }
  .node.visited { fill: var(--text); }
  .node.cur { fill: var(--cyan); }
  .reachable { fill: none; stroke: var(--green); stroke-width: 2; vector-effect: non-scaling-stroke; }
  .here { fill: none; stroke: var(--cyan); stroke-width: 2; vector-effect: non-scaling-stroke; }
  .hov { fill: none; stroke: var(--text); stroke-width: 1.5; vector-effect: non-scaling-stroke; }
  .pulse { fill: none; stroke: var(--cyan); stroke-width: 2; vector-effect: non-scaling-stroke; transform-box: fill-box; transform-origin: center; animation: pulse 2.2s ease-out infinite; pointer-events: none; }
  @keyframes pulse { from { transform: scale(1); opacity: 0.7; } to { transform: scale(2.2); opacity: 0; } }
  @media (prefers-reduced-motion: reduce) { .pulse { display: none; } }
  .ship { fill: var(--cyan); stroke: var(--bg); stroke-width: 1; vector-effect: non-scaling-stroke; }
  line.trail { stroke: var(--cyan); stroke-opacity: 0.8; stroke-width: 3; stroke-linecap: round; }
  .sel { fill: none; stroke: var(--amber); stroke-width: 2; stroke-dasharray: 4 3; vector-effect: non-scaling-stroke; }
  .hostile { fill: color-mix(in srgb, var(--red) 25%, transparent); stroke: var(--red); stroke-width: 1.5; vector-effect: non-scaling-stroke; }
  .unknown { fill: var(--bg); stroke: var(--dim); stroke-opacity: 0.85; stroke-width: 1.5; vector-effect: non-scaling-stroke; }
  .dimmed { opacity: 0.35; }
  text { text-anchor: middle; pointer-events: none; paint-order: stroke; stroke: var(--bg); stroke-linejoin: round; font-family: var(--head-font); }
  .badge { fill: var(--bg); font-weight: 700; stroke: none; }
  .nname { fill: var(--text); font-weight: 600; letter-spacing: 0.04em; }
  .nname.cur { fill: var(--cyan); }
  .sname { fill: var(--text); fill-opacity: 0.85; font-weight: 600; letter-spacing: 0.15em; text-transform: uppercase; }
  .sname.cur { fill: var(--cyan); fill-opacity: 1; }
  .sdanger { font-weight: 600; letter-spacing: 0.05em; }
  .exitname { fill: var(--text); font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; }
  .exitname.unk { fill: var(--dim); }
  .exitsub { fill: var(--dim); }
</style>
