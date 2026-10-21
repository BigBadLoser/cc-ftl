<script lang="ts">
  /**
   * Starmap zoom level 1, drawn inside the map transform: sector outlines, central bodies, lanes, nodes, the planned
   * route, jumps reachable now, and the exits from your sector labelled where they lead (pinned inside the view).
   * `px(v)` converts screen pixels to map units; `view` is the visible map rectangle.
   */
  import type { UiStarmap, UiStarNode, UiStarRoute } from './starmapApi';
  import StarmapBody from './StarmapBody.svelte';

  let { map, px, s, view, current, route, routePts, selected }: {
    map: UiStarmap; px: (v: number) => number; s: number; view: { x0: number; y0: number; x1: number; y1: number };
    current: UiStarNode | null; route: UiStarRoute | null; routePts: string; selected: string | null;
  } = $props();

  const BADGE: Record<string, string> = { T: '#4ade80', M: '#60a5fa', R: '#c4b5fd', A: '#a3a3a3', D: '#fb923c' };
  /** Danger tier label colours: calm cyan through amber to red. */
  const DANGER = ['#67e8f9', '#86efac', '#bef264', '#fde047', '#fbbf24', '#fb923c', '#f87171', '#ef4444', '#dc2626', '#e879f9'];
  const clampX = (x: number, m: number) => Math.max(view.x0 + px(m), Math.min(view.x1 - px(m), x));
  const clampY = (y: number, top: number, bottom: number) => Math.max(view.y0 + px(top), Math.min(view.y1 - px(bottom), y));
  /** Exits grouped by the sector they lead to (one label each), at the far gateway pinned into the view. */
  const exitLabels = $derived.by(() => {
    // eslint-disable-next-line svelte/prefer-svelte-reactivity -- a temporary built inside $derived, never mutated after
    const by = new Map<string, { x: number; y: number; e: UiStarmap['exits'][number] }>();
    for (const e of map.exits) if (!by.has(e.to)) by.set(e.to, { x: clampX(e.bx, 90), y: clampY(e.by - px(22), 70, 40), e });
    return [...by.values()];
  });
</script>

{#each map.sectors as sec (sec.id)}
  <path d={sec.outline} class="outline" class:known={sec.known} class:cur={sec.id === map.currentSector} style={`--c:${sec.color}`} fill-rule="evenodd" />
{/each}
{#each map.sectors as sec (sec.id)}
  {#if sec.known && sec.body}<StarmapBody kind={sec.body.kind} x={sec.body.x} y={sec.body.y} r={sec.body.r * 0.75} dim={sec.id === map.currentSector ? 1 : 0.55} />{/if}
{/each}
{#each map.edges as e (e.id)}
  <line x1={e.ax} y1={e.ay} x2={e.bx} y2={e.by} class={e.kind} class:anchor={e.anchor} class:gate={e.gate} class:rift={e.rift} />
{/each}
{#each map.exits as e (e.id)}
  <line x1={e.ax} y1={e.ay} x2={e.bx} y2={e.by} class="exit {e.kind}" />
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
  {#if sec.known && sec.x > view.x0 && sec.x < view.x1 && sec.y > view.y0 && sec.y < view.y1}
    {@const lx = clampX(sec.x, 80)}
    {@const ly = clampY(sec.top - px(22), 24, 50)}
    <text x={lx} y={ly} class="sname" class:cur={sec.id === map.currentSector} font-size={px(13)} stroke-width={px(3)}>{sec.name}</text>
    <text x={lx} y={ly + px(14)} class="sdanger" font-size={px(10)} stroke-width={px(3)} fill={DANGER[Math.min(DANGER.length - 1, sec.danger)]}>Danger {sec.danger}</text>
  {/if}
{/each}
{#each exitLabels as l (l.e.to)}
  <text x={l.x} y={l.y} class="exitname" fill={l.e.name ? '#e2e8f0' : '#94a3b8'} font-size={px(12)} stroke-width={px(3)}>→ {l.e.name ?? 'Uncharted'}</text>
  <text x={l.x} y={l.y + px(14)} class="exitsub" font-size={px(10)} stroke-width={px(3)}>danger {l.e.danger}{l.e.kind === 'gate' ? ' · gate' : l.e.kind === 'rift' ? ' · rift' : ''} · {l.e.fuel} fuel</text>
{/each}

<style>
  .outline { fill: var(--c); fill-opacity: 0.02; stroke: var(--c); stroke-opacity: 0.22; stroke-dasharray: 4 5; vector-effect: non-scaling-stroke; }
  .outline.known { fill-opacity: 0.07; stroke-opacity: 0.5; stroke-dasharray: none; stroke-width: 1.4; }
  .outline.cur { fill-opacity: 0.12; stroke-opacity: 0.85; stroke-width: 2; }
  line { vector-effect: non-scaling-stroke; }
  line.hyperlane { stroke: #7dd3fc; stroke-opacity: 0.7; stroke-width: 1.8; }
  line.hyperlane.anchor { stroke-dasharray: 7 4; }
  line.hyperlane.gate { stroke-width: 2.6; stroke-opacity: 0.9; }
  line.hyperlane.rift { stroke: #a78bfa; stroke-dasharray: 3 6; }
  line.route { stroke: #8195b3; stroke-opacity: 0.6; stroke-width: 1; }
  line.exit { stroke: #7dd3fc; stroke-opacity: 0.6; stroke-width: 1.8; }
  line.exit.gate { stroke-width: 2.6; }
  line.exit.rift { stroke: #a78bfa; stroke-dasharray: 3 6; }
  line.reach { stroke: #4ade80; stroke-opacity: 0.8; stroke-width: 2.4; }
  polyline.route { fill: none; stroke: var(--amber); stroke-opacity: 1; stroke-width: 3.5; stroke-linejoin: round; vector-effect: non-scaling-stroke; }
  polyline.route.blocked { stroke-dasharray: 8 5; }
  .node { fill: #cbd5e1; stroke: #05080e; stroke-width: 1; vector-effect: non-scaling-stroke; }
  .node.visited { fill: #67e8f9; }
  .node.cur { fill: var(--cyan); }
  .reachable { fill: none; stroke: #4ade80; stroke-width: 2; vector-effect: non-scaling-stroke; }
  .here { fill: none; stroke: var(--cyan); stroke-width: 2; vector-effect: non-scaling-stroke; }
  .sel { fill: none; stroke: var(--amber); stroke-width: 2; stroke-dasharray: 4 3; vector-effect: non-scaling-stroke; }
  .hostile { fill: rgba(239, 68, 68, 0.25); stroke: var(--red); stroke-width: 1.5; vector-effect: non-scaling-stroke; }
  .unknown { fill: #34445c; }
  text { text-anchor: middle; pointer-events: none; paint-order: stroke; stroke: #05080e; stroke-linejoin: round; }
  .badge { fill: #05080e; font-weight: 700; stroke: none; }
  .nname { fill: var(--dim); }
  .sname { fill: #e2e8f0; fill-opacity: 0.85; font-weight: 600; letter-spacing: 0.15em; text-transform: uppercase; }
  .sname.cur { fill: var(--cyan); fill-opacity: 1; }
  .sdanger { font-weight: 600; }
  .exitname { font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; }
  .exitsub { fill: #64748b; }
</style>
