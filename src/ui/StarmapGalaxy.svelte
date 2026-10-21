<script lang="ts">
  /**
   * Starmap zoom level 3, drawn inside the map transform: regions as solid patches in their colour (uncharted ones as
   * fog), joined by their gates and by routes through unclaimed space, which show in the gaps between them. Your ship
   * is marked where it is. Labels are placed so they never overlap. `px(v)` converts screen pixels to map units.
   */
  import type { UiStarmap } from './starmapApi';
  import { boxAt, placeLabels, type LabelItem } from './starmapLabels';

  let { map, px, picked }: { map: UiStarmap; px: (v: number) => number; picked: string | null } = $props();

  const here = $derived(map.sectors.find((x) => x.id === map.currentSector) ?? null);
  /** Region labels: yours first, then charted ones, then by size; each on the region's centre, else above or below it. */
  const labels = $derived.by(() => {
    const k = px(1);
    const order = [...map.regions].sort((a, b) => Number(b.current) - Number(a.current) || Number(b.known) - Number(a.known) || b.sectors - a.sectors);
    const items: LabelItem[] = order.map((r) => {
      const name = r.revealed ? r.name : 'Uncharted';
      const w = (name.length * 9 + 12) * k;
      const h = (r.revealed ? 26 : 14) * k;
      return { key: r.id, must: r.current, cands: [0, -30, 30].map((dy) => boxAt(r.x, r.y + dy * k - h / 2, w, h)) };
    });
    const ship = here ? [{ x0: here.x - 9 * k, y0: here.y - 9 * k, x1: here.x + 9 * k, y1: here.y + 9 * k }] : [];
    return placeLabels(items, ship);
  });
  const LINK: Record<string, string> = { lane: '#64748b', gate: '#7dd3fc', rift: '#a78bfa', through: '#64748b' };
</script>

{#each map.regionLinks as l (l.id)}
  <line x1={l.ax} y1={l.ay} x2={l.bx} y2={l.by} class="link {l.kind}" class:mine={l.mine} stroke={l.mine ? '#4ade80' : LINK[l.kind]} style={`--w:${2 + Math.min(4, l.count)}px`} />
{/each}
{#each map.regions as r (r.id)}
  <path d={r.outline} class="patch-base" fill-rule="evenodd" />
  <path d={r.outline} class="patch" class:revealed={r.revealed} class:known={r.known} class:cur={r.current} class:picked={r.id === picked} style={`--c:${r.color}`} fill-rule="evenodd" />
{/each}
{#if here}
  <circle cx={here.x} cy={here.y} r={px(4)} class="ship" />
  <circle cx={here.x} cy={here.y} r={px(8)} class="here" />
{/if}
{#each map.regions as r (r.id)}
  {@const b = labels.get(r.id)}
  {#if b}
    <text stroke-width={px(3)} x={r.x} y={b.y0 + px(11)} class="rname" class:dim={!r.revealed} fill={r.revealed ? r.color : '#94a3b8'} font-size={px(r.revealed ? 12 : 10)}>{r.revealed ? r.name : 'Uncharted'}</text>
    {#if r.revealed}<text stroke-width={px(3)} x={r.x} y={b.y0 + px(23)} class="rtype" font-size={px(9)}>{r.typeLabel} · {r.sectors} sectors</text>{/if}
  {/if}
{/each}

<style>
  .link { stroke-opacity: 0.7; stroke-width: 2; stroke-linecap: round; vector-effect: non-scaling-stroke; }
  .link.gate { stroke-opacity: 0.95; stroke-width: var(--w, 3px); }
  .link.rift { stroke-dasharray: 4 6; stroke-width: var(--w, 2px); }
  .link.through { stroke-dasharray: 8 7; stroke-opacity: 0.6; }
  .patch-base { fill: #070b14; }
  .patch { fill: #334155; fill-opacity: 0.5; stroke: #7c8ca6; stroke-opacity: 0.6; stroke-width: 1.2; stroke-dasharray: 5 4; vector-effect: non-scaling-stroke; }
  .patch.revealed { fill: var(--c); fill-opacity: 0.18; stroke: var(--c); stroke-opacity: 0.7; stroke-dasharray: none; }
  .patch.known { fill-opacity: 0.32; stroke-opacity: 0.95; stroke-width: 2; }
  .patch.cur { stroke: var(--cyan); stroke-width: 2.5; }
  .patch.picked { stroke: var(--amber); stroke-opacity: 1; stroke-width: 3; stroke-dasharray: 6 4; }
  .ship { fill: var(--cyan); stroke: #05080e; stroke-width: 1; vector-effect: non-scaling-stroke; }
  .here { fill: none; stroke: var(--cyan); stroke-width: 2; vector-effect: non-scaling-stroke; }
  text { text-anchor: middle; pointer-events: none; paint-order: stroke; stroke: #05080e; stroke-linejoin: round; }
  .rname { font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase; }
  .rname.dim { fill-opacity: 0.7; font-weight: 500; }
  .rtype { fill: #94a3b8; }
</style>
