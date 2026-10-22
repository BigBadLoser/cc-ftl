<script lang="ts">
  /**
   * Starmap zoom level 2, for planning, drawn inside the map transform: sectors are solid patches in their cluster's
   * colour (uncharted ones as fog), each with its body, name, danger and known services, joined by connectors that
   * show in the gaps between them, with the plotted route on top. Labels are placed so they never overlap.
   * `px(v)` converts screen pixels to map units at the current zoom.
   */
  import type { UiStarmap } from './starmapApi';
  import StarmapBody from './StarmapBody.svelte';
  import { boxAt, placeLabels, type Box, type LabelItem } from './starmapLabels';
  import { BADGE, dangerColor, toneColor } from './starmapStyle';

  let { map, px, picked, hover, routePts = '', routeSectors = new Set() }: {
    map: UiStarmap; px: (v: number) => number; picked: string | null; hover: string | null;
    /** The plotted route (SVG points) and the sectors it passes through. */
    routePts?: string; routeSectors?: Set<string>;
  } = $props();

  const tint = $derived(new Map(map.clusters.map((r) => [r.id, r.revealed ? toneColor(r.tone) : 'var(--dim)'])));
  /** Known services per sector: the structure badges of its discovered nodes. */
  const services = $derived.by(() => {
    // eslint-disable-next-line svelte/prefer-svelte-reactivity -- a temporary built inside $derived, never mutated after
    const by = new Map<string, string[]>();
    for (const n of map.nodes) for (const b of n.badges) if (b !== 'A') by.set(n.sector, [...new Set([...(by.get(n.sector) ?? []), b])]);
    return by;
  });

  /**
   * Label boxes (map units): your sector's first, then the picked one and those on the route, then cluster names, then
   * the other charted sectors nearest first. Each sector label goes below its body, else above, else is left out.
   */
  const labels = $derived.by(() => {
    const k = px(1);
    const cur = map.sectors.find((x) => x.id === map.currentSector);
    const obstacles: Box[] = [];
    const items: { rank: number; d: number; item: LabelItem }[] = [];
    for (const sec of map.sectors) {
      if (!sec.known) continue;
      const mine = sec.id === map.currentSector;
      const r = (mine ? 14 : 8) * k;
      obstacles.push({ x0: sec.x - r, y0: sec.y - r, x1: sec.x + r, y1: sec.y + r });
      const icons = services.get(sec.id)?.length ?? 0;
      const w = Math.max(sec.name.length * 6.4 + 8, icons * 12 + 8, 56) * k;
      const h = (23 + (icons ? 13 : 0)) * k;
      const gap = (mine ? 15 : 10) * k;
      const rank = mine ? 0 : sec.id === picked ? 1 : routeSectors.has(sec.id) ? 2 : 4;
      items.push({
        rank, d: cur ? Math.hypot(sec.x - cur.x, sec.y - cur.y) : 0,
        item: { key: sec.id, must: rank < 2, cands: [boxAt(sec.x, sec.y + gap, w, h), boxAt(sec.x, sec.y - gap - h, w, h)] },
      });
    }
    for (const r of map.clusters) {
      if (!r.revealed) continue;
      const w = (r.name.length * 12 + 12) * k;
      const h = 30 * k;
      items.push({
        rank: 3, d: cur ? Math.hypot(r.x - cur.x, r.y - cur.y) : 0,
        item: { key: `r:${r.id}`, cands: [-56, 56, -104, 104].map((dy) => boxAt(r.x, r.y + dy * k - h / 2, w, h)) },
      });
    }
    items.sort((a, b) => a.rank - b.rank || a.d - b.d);
    return placeLabels(items.map((i) => i.item), obstacles);
  });
</script>

{#each map.clusters as r (r.id)}
  <path d={r.outline} class="area" class:known={r.known} class:revealed={r.revealed} style={`--c: ${r.revealed ? toneColor(r.tone) : 'var(--dim)'}`} fill-rule="evenodd" />
{/each}
{#each map.sectorLinks as l (l.id)}
  <line x1={l.ax} y1={l.ay} x2={l.bx} y2={l.by} class="conn {l.kind}" class:mine={l.mine} />
{/each}
{#each map.sectors as sec (sec.id)}
  {@const c = sec.known ? (tint.get(sec.cluster ?? '') ?? 'var(--dim)') : 'var(--dim)'}
  <path d={sec.outline} class="patch-base" fill-rule="evenodd" />
  <path d={sec.outline} class="patch" class:known={sec.known} class:cur={sec.id === map.currentSector} class:onroute={routeSectors.has(sec.id)} class:picked={sec.id === picked} class:hov={sec.id === hover} style={`--c: ${c}`} fill-rule="evenodd" />
{/each}
{#if routePts}<polyline points={routePts} class="route" />{/if}
{#each map.sectors as sec (sec.id)}
  {#if sec.known}
    <StarmapBody kind={sec.body?.kind ?? 'star'} x={sec.x} y={sec.y} r={px(sec.hub ? 7 : 5.5)} />
    {@const b = labels.get(sec.id)}
    {#if b}
      {@const icons = services.get(sec.id) ?? []}
      {@const mid = (b.x0 + b.x1) / 2}
      <text stroke-width={px(3)} x={mid} y={b.y0 + px(10)} class="sname" class:cur={sec.id === map.currentSector} font-size={px(13)}>{sec.name}</text>
      <text stroke-width={px(3)} x={mid} y={b.y0 + px(21)} font-size={px(9)} class="danger" style={`fill: ${dangerColor(sec.danger)}`}>danger {sec.danger}</text>
      {#each icons as s, i (s)}
        <rect x={mid + px(-icons.length * 6 + i * 12 + 1)} y={b.y0 + px(24)} width={px(10)} height={px(10)} class="chip" style={`fill: ${BADGE[s] ?? 'var(--dim)'}`} />
        <text x={mid + px(-icons.length * 6 + i * 12 + 6)} y={b.y0 + px(31.8)} class="badge" font-size={px(8)}>{s}</text>
      {/each}
    {/if}
  {:else}
    <text stroke-width={px(3)} x={sec.x} y={sec.y + px(4)} class="unk" font-size={px(10)}>?</text>
  {/if}
  {#if sec.id === map.currentSector}<circle cx={sec.x} cy={sec.y} r={px(12)} class="here" />{/if}
{/each}
{#each map.clusters as r (r.id)}
  {@const b = labels.get(`r:${r.id}`)}
  {#if b}
    <text stroke-width={px(3)} x={r.x} y={b.y0 + px(14)} class="rname" style={`fill: ${toneColor(r.tone)}`} font-size={px(15)}>{r.name}</text>
    <text stroke-width={px(3)} x={r.x} y={b.y0 + px(27)} class="rtype" font-size={px(11)}>{r.typeLabel}</text>
  {/if}
{/each}

<style>
  .area { fill: var(--c); fill-opacity: 0.02; stroke: var(--c); stroke-opacity: 0.35; stroke-dasharray: 6 6; vector-effect: non-scaling-stroke; }
  .area.revealed { fill-opacity: 0.03; stroke-opacity: 0.5; stroke-width: 1.5; }
  .area.known { fill-opacity: 0.05; stroke-opacity: 0.8; stroke-dasharray: none; stroke-width: 3; }
  .conn { stroke: var(--dim); stroke-opacity: 0.8; stroke-width: 3; stroke-linecap: round; vector-effect: non-scaling-stroke; }
  .conn.gate { stroke: var(--cyan); stroke-width: 5; }
  .conn.rift { stroke: var(--text); stroke-opacity: 0.5; stroke-dasharray: 4 6; stroke-width: 3; }
  .conn.mine { stroke: var(--green); }
  .patch-base { fill: var(--bg); }
  .patch { fill: var(--panel-3); fill-opacity: 0.55; stroke: var(--dim); stroke-opacity: 0.7; stroke-width: 1.2; stroke-dasharray: 4 3; vector-effect: non-scaling-stroke; }
  .patch.known { fill: var(--c); fill-opacity: 0.3; stroke: var(--c); stroke-opacity: 0.85; stroke-dasharray: none; }
  .patch.onroute { stroke: var(--amber); stroke-opacity: 1; stroke-width: 2; }
  .patch.cur { fill-opacity: 0.45; stroke: var(--cyan); stroke-opacity: 1; stroke-width: 2.5; }
  .patch.hov { stroke: var(--text); stroke-opacity: 1; stroke-width: 2; stroke-dasharray: none; fill-opacity: 0.42; }
  .patch.picked { stroke: var(--amber); stroke-opacity: 1; stroke-width: 3; stroke-dasharray: 6 4; }
  .route { fill: none; stroke: var(--amber); stroke-width: 3.5; stroke-linejoin: round; stroke-linecap: round; vector-effect: non-scaling-stroke; }
  .here { fill: none; stroke: var(--cyan); stroke-width: 2.5; vector-effect: non-scaling-stroke; }
  text { text-anchor: middle; pointer-events: none; paint-order: stroke; stroke: var(--bg); stroke-linejoin: round; font-family: var(--head-font); }
  .badge { fill: var(--bg); font-weight: 700; stroke: none; }
  .danger { font-weight: 600; letter-spacing: 0.05em; }
  .unk { fill: var(--dim); fill-opacity: 0.6; font-weight: 600; }
  .sname { fill: var(--text); font-weight: 600; letter-spacing: 0.04em; }
  .sname.cur { fill: var(--cyan); }
  .rname { font-weight: 600; letter-spacing: 0.2em; text-transform: uppercase; }
  .rtype { fill: var(--dim); }
</style>
