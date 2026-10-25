<script lang="ts">
  /**
   * Starmap zoom level 3, drawn inside the map transform: clusters as solid patches in their colour (uncharted ones as
   * fog), joined by their gates and by routes through unclaimed space, which show in the gaps between them. Your ship
   * is marked where it is. Labels are placed so they never overlap. `px(v)` converts screen pixels to map units.
   */
  import type { UiStarmap } from './starmapApi';
  import { boxAt, placeLabels, type LabelItem } from './starmapLabels';
  import { pixelLine, pixelOutline, pixelSquare } from './starmapPixel';
  import { toneColor } from './starmapStyle';

  let { map, px, picked, hover }: { map: UiStarmap; px: (v: number) => number; picked: string | null; hover: string | null } = $props();

  /** The pixel grid (starmapPixel.ts): two screen pixels at this zoom. */
  const g = $derived(px(2));
  const here = $derived(map.sectors.find((x) => x.id === map.currentSector) ?? null);
  /** Cluster labels: yours first, then charted ones, then by size; each on the cluster's centre, else above or below it. */
  const labels = $derived.by(() => {
    const k = px(1);
    const order = [...map.clusters].sort((a, b) => Number(b.current) - Number(a.current) || Number(b.known) - Number(a.known) || b.sectors - a.sectors);
    const items: LabelItem[] = order.map((r) => {
      const name = r.revealed ? r.name : 'Uncharted';
      const w = (name.length * 9 + 12) * k;
      const h = (r.revealed ? 26 : 14) * k;
      return { key: r.id, must: r.current, cands: [0, -30, 30].map((dy) => boxAt(r.x, r.y + dy * k - h / 2, w, h)) };
    });
    const ship = here ? [{ x0: here.x - 9 * k, y0: here.y - 9 * k, x1: here.x + 9 * k, y1: here.y + 9 * k }] : [];
    return placeLabels(items, ship);
  });
</script>

{#each map.clusterLinks as l (l.id)}
  <path d={pixelLine(l.ax, l.ay, l.bx, l.by, g, { w: l.kind === 'gate' ? 1 + Math.min(2, Math.ceil(l.count / 2)) : 1, dash: l.kind === 'rift' ? [2, 3] : l.kind === 'through' ? [4, 3] : undefined })} class="link {l.kind}" class:mine={l.mine} />
{/each}
{#each map.clusters as r (r.id)}
  <path d={r.outline} class="patch-base" fill-rule="evenodd" />
  <path d={r.outline} class="patch" class:revealed={r.revealed} class:known={r.known} class:cur={r.current} class:picked={r.id === picked} class:hov={r.id === hover} style={`--c: ${toneColor(r.tone)}`} fill-rule="evenodd" />
  <path d={pixelOutline(r.outline, g, r.current || r.id === picked ? 2 : 1)} class="pline" class:revealed={r.revealed} class:known={r.known} class:cur={r.current} class:picked={r.id === picked} class:hov={r.id === hover} style={`--c: ${toneColor(r.tone)}`} />
{/each}
{#if here}
  <rect {...pixelSquare(here.x, here.y, px(3), g)} class="ship" />
  <rect {...pixelSquare(here.x, here.y, px(8), g)} class="here" />
{/if}
{#each map.clusters as r (r.id)}
  {@const b = labels.get(r.id)}
  {#if b}
    <text stroke-width={px(3)} x={r.x} y={b.y0 + px(11)} class="rname" class:dim={!r.revealed} style={`fill: ${r.revealed ? toneColor(r.tone) : 'var(--dim)'}`} font-size={px(r.revealed ? 14 : 11)}>{r.revealed ? r.name : 'Uncharted'}</text>
    {#if r.revealed}<text stroke-width={px(3)} x={r.x} y={b.y0 + px(23)} class="rtype" font-size={px(11)}>{r.typeLabel} · {r.sectors} {r.sectors === 1 ? 'sector' : 'sectors'}</text>{/if}
  {/if}
{/each}

<style>
  /* Pixel look (starmapPixel.ts): borders and lines are filled pixel cells, never anti-aliased. */
  path, rect { shape-rendering: crispEdges; }
  .link { fill: var(--dim); fill-opacity: 0.7; }
  .link.gate { fill: var(--cyan); fill-opacity: 0.95; }
  .link.rift { fill: var(--text); fill-opacity: 0.5; }
  .link.through { fill-opacity: 0.6; }
  .link.mine { fill: var(--green); }
  .patch-base { fill: var(--bg); }
  .patch { fill: var(--panel-3); fill-opacity: 0.5; stroke: none; }
  .patch.revealed { fill: var(--c); fill-opacity: 0.18; }
  .patch.known { fill-opacity: 0.32; }
  .patch.hov { fill-opacity: 0.4; }
  .pline { fill: var(--dim); fill-opacity: 0.5; }
  .pline.revealed { fill: var(--c); fill-opacity: 0.7; }
  .pline.known { fill-opacity: 0.95; }
  .pline.cur { fill: var(--cyan); fill-opacity: 1; }
  .pline.hov { fill: var(--text); fill-opacity: 1; }
  .pline.picked { fill: var(--amber); fill-opacity: 1; }
  .ship { fill: var(--cyan); }
  .here { fill: none; stroke: var(--cyan); stroke-width: 2; vector-effect: non-scaling-stroke; }
  text { text-anchor: middle; pointer-events: none; paint-order: stroke; stroke: var(--bg); stroke-linejoin: round; font-family: var(--head-font); }
  .rname { font-family: var(--pixel-font); font-weight: 400; letter-spacing: 0.08em; text-transform: uppercase; }
  .rname.dim { fill-opacity: 0.7; }
  .rtype { fill: var(--dim); letter-spacing: 0.04em; }
</style>
