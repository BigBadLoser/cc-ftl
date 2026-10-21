<script lang="ts">
  /**
   * The outer starmap zoom levels, drawn inside the map transform. Level 2 is for planning: sectors are solid patches
   * in their region's colour, each with its body, name, danger and known services, joined by connectors in the gaps
   * between them, with the plotted route on top. Level 3 shows regions as nodes joined by gates and by routes through
   * unclaimed space. `px(v)` converts screen pixels to map units at the current zoom.
   */
  import type { UiStarmap } from './starmapApi';
  import StarmapBody from './StarmapBody.svelte';
  import { BADGE, dangerColor } from './starmapStyle';

  let { map, level, px, picked, routePts = '', routeSectors = new Set() }: {
    map: UiStarmap; level: 2 | 3; px: (v: number) => number; picked: string | null;
    /** The plotted route (SVG points) and the sectors it passes through. */
    routePts?: string; routeSectors?: Set<string>;
  } = $props();

  const tint = $derived(new Map(map.regions.map((r) => [r.id, r.revealed ? r.color : '#64748b'])));
  /** Known services per sector: the structure badges of its discovered nodes. */
  const services = $derived.by(() => {
    // eslint-disable-next-line svelte/prefer-svelte-reactivity -- a temporary built inside $derived, never mutated after
    const by = new Map<string, string[]>();
    for (const n of map.nodes) for (const b of n.badges) if (b !== 'A') by.set(n.sector, [...new Set([...(by.get(n.sector) ?? []), b])]);
    return by;
  });

  /**
   * Region labels that do not collide: placed greedily (your region, then charted, then by size), each needing about
   * 150 x 32 screen px clear of the labels already placed.
   */
  const labelled = $derived.by(() => {
    const order = [...map.regions].sort((a, b) => Number(b.current) - Number(a.current) || Number(b.known) - Number(a.known) || b.sectors - a.sectors);
    const placed: { x: number; y: number }[] = [];
    // eslint-disable-next-line svelte/prefer-svelte-reactivity -- a temporary built inside $derived, never mutated after
    const out = new Set<string>();
    for (const r of order) {
      if (placed.some((p) => Math.abs(p.x - r.x) < px(150) && Math.abs(p.y - r.y) < px(32))) continue;
      placed.push({ x: r.x, y: r.y });
      out.add(r.id);
    }
    return out;
  });
  const LINK: Record<string, string> = { lane: '#64748b', gate: '#7dd3fc', rift: '#a78bfa', through: '#94a3b8' };
</script>

{#if level === 2}
  {#each map.regions as r (r.id)}
    <path d={r.outline} class="area" class:known={r.known} class:revealed={r.revealed} style={`--c:${r.revealed ? r.color : '#64748b'}`} fill-rule="evenodd" />
  {/each}
  {#each map.sectorLinks as l (l.id)}
    <line x1={l.ax} y1={l.ay} x2={l.bx} y2={l.by} class="conn {l.kind}" class:mine={l.mine} />
  {/each}
  {#each map.sectors as sec (sec.id)}
    {@const c = sec.known ? (tint.get(sec.region ?? '') ?? '#64748b') : '#475569'}
    <path d={sec.outline} class="patch-base" fill-rule="evenodd" />
    <path d={sec.outline} class="patch" class:known={sec.known} class:cur={sec.id === map.currentSector} class:onroute={routeSectors.has(sec.id)} class:picked={sec.id === picked} style={`--c:${c}`} fill-rule="evenodd" />
  {/each}
  {#if routePts}<polyline points={routePts} class="route" />{/if}
  {#each map.sectors as sec (sec.id)}
    {#if sec.known}
      <StarmapBody kind={sec.body?.kind ?? 'star'} x={sec.x} y={sec.y} r={px(sec.hub ? 7 : 5.5)} />
      <text stroke-width={px(3)} x={sec.x} y={sec.y + px(19)} class="sname" class:cur={sec.id === map.currentSector} font-size={px(11)}>{sec.name}</text>
      <text stroke-width={px(3)} x={sec.x} y={sec.y + px(31)} font-size={px(9)} class="danger" fill={dangerColor(sec.danger)}>danger {sec.danger}</text>
      {#each services.get(sec.id) ?? [] as b, i (b)}
        {@const n = (services.get(sec.id) ?? []).length}
        <rect x={sec.x + px(-n * 6 + i * 12)} y={sec.y - px(21)} width={px(10)} height={px(10)} rx={px(2)} fill={BADGE[b] ?? '#999'} />
        <text x={sec.x + px(-n * 6 + i * 12 + 5)} y={sec.y - px(13.2)} class="badge" font-size={px(8)}>{b}</text>
      {/each}
    {:else}
      <text stroke-width={px(3)} x={sec.x} y={sec.y + px(4)} class="unk" font-size={px(10)}>?</text>
    {/if}
    {#if sec.id === map.currentSector}<circle cx={sec.x} cy={sec.y} r={px(12)} class="here" />{/if}
  {/each}
  {#each map.regions as r (r.id)}
    {#if r.revealed && labelled.has(r.id)}
      <text stroke-width={px(3)} x={r.x} y={r.y - px(46)} class="rname" fill={r.color} font-size={px(15)}>{r.name}</text>
      <text stroke-width={px(3)} x={r.x} y={r.y - px(30)} class="rtype" font-size={px(11)}>{r.typeLabel}</text>
    {/if}
  {/each}
{:else}
  {#each map.regionLinks as l (l.id)}
    <line x1={l.ax} y1={l.ay} x2={l.bx} y2={l.by} class="link {l.kind}" stroke={LINK[l.kind]} style={`--w:${1.2 + Math.min(4, l.count)}px`} />
  {/each}
  {#each map.regions as r (r.id)}
    {@const rad = px(5 + Math.sqrt(r.sectors) * 2.6)}
    <circle cx={r.x} cy={r.y} r={rad} class="rnode" class:known={r.known} style={`--c:${r.revealed ? r.color : '#475569'}`} />
    {#if r.current}<circle cx={r.x} cy={r.y} r={rad + px(6)} class="here" />{/if}
    {#if r.id === picked}<circle cx={r.x} cy={r.y} r={rad + px(10)} class="sel" />{/if}
    {#if labelled.has(r.id)}
      <text stroke-width={px(3)} x={r.x} y={r.y + rad + px(14)} class="rname" fill={r.revealed ? r.color : '#64748b'} font-size={px(11)}>{r.revealed ? r.name : 'Uncharted'}</text>
    {/if}
    {#if r.revealed && labelled.has(r.id)}<text stroke-width={px(3)} x={r.x} y={r.y + rad + px(27)} class="rtype" font-size={px(9)}>{r.typeLabel}</text>{/if}
  {/each}
{/if}

<style>
  .area { fill: var(--c); fill-opacity: 0.02; stroke: var(--c); stroke-opacity: 0.35; stroke-dasharray: 6 6; vector-effect: non-scaling-stroke; }
  .area.revealed { fill-opacity: 0.03; stroke-opacity: 0.5; stroke-width: 1.5; }
  .area.known { fill-opacity: 0.05; stroke-opacity: 0.8; stroke-dasharray: none; stroke-width: 3; }
  .conn { stroke: #64748b; stroke-opacity: 0.8; stroke-width: 3; stroke-linecap: round; vector-effect: non-scaling-stroke; }
  .conn.gate { stroke: #7dd3fc; stroke-width: 5; }
  .conn.rift { stroke: #a78bfa; stroke-dasharray: 4 6; stroke-width: 3; }
  .conn.mine { stroke: #4ade80; }
  .patch-base { fill: #070b14; }
  .patch { fill: #334155; fill-opacity: 0.55; stroke: #7c8ca6; stroke-opacity: 0.7; stroke-width: 1.2; stroke-dasharray: 4 3; vector-effect: non-scaling-stroke; }
  .patch.known { fill: var(--c); fill-opacity: 0.3; stroke: var(--c); stroke-opacity: 0.85; stroke-dasharray: none; }
  .patch.onroute { stroke: var(--amber); stroke-opacity: 1; stroke-width: 2; }
  .patch.cur { fill-opacity: 0.45; stroke: var(--cyan); stroke-opacity: 1; stroke-width: 2.5; }
  .patch.picked { stroke: var(--amber); stroke-opacity: 1; stroke-width: 3; stroke-dasharray: 6 4; }
  .route { fill: none; stroke: var(--amber); stroke-width: 3.5; stroke-linejoin: round; stroke-linecap: round; vector-effect: non-scaling-stroke; }
  .badge { fill: #05080e; font-weight: 700; stroke: none; }
  .danger { font-weight: 600; }
  .unk { fill: #94a3b8; fill-opacity: 0.6; font-weight: 600; }
  .sel { fill: none; stroke: var(--amber); stroke-width: 2; stroke-dasharray: 4 3; vector-effect: non-scaling-stroke; }
  .link { stroke-opacity: 0.55; stroke-width: 1.3; vector-effect: non-scaling-stroke; }
  .link.gate { stroke-opacity: 0.9; stroke-width: var(--w, 2.6px); }
  .link.rift { stroke-dasharray: 3 6; stroke-opacity: 0.8; stroke-width: var(--w, 1.6px); }
  .link.through { stroke-dasharray: 7 7; stroke-opacity: 0.45; stroke-width: 1.4; }
  .here { fill: none; stroke: var(--cyan); stroke-width: 2.5; vector-effect: non-scaling-stroke; }
  .rnode { fill: #0b1220; stroke: var(--c); stroke-width: 2; vector-effect: non-scaling-stroke; }
  .rnode:not(.known) { stroke-dasharray: 4 4; }
  text { text-anchor: middle; pointer-events: none; paint-order: stroke; stroke: #05080e; stroke-linejoin: round; }
  .sname { fill: #cbd5e1; }
  .sname.cur { fill: var(--cyan); }
  .rname { font-weight: 600; letter-spacing: 0.2em; text-transform: uppercase; }
  .rtype { fill: #94a3b8; }
</style>
