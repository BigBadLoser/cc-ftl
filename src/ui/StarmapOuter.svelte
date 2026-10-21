<script lang="ts">
  /**
   * The outer starmap zoom levels, drawn inside the map transform: level 2 shows sectors as their bodies inside region
   * areas, joined by one lane per sector pair; level 3 shows regions as nodes joined by gates and by routes through
   * unclaimed space. `px(v)` converts screen pixels to map units at the current zoom.
   */
  import type { UiStarmap } from './starmapApi';
  import StarmapBody from './StarmapBody.svelte';

  let { map, level, px }: { map: UiStarmap; level: 2 | 3; px: (v: number) => number } = $props();

  const neighbours = $derived(new Set(map.sectorLinks.filter((l) => l.mine).flatMap((l) => l.id.split('|'))));
  const LINK: Record<string, string> = { lane: '#64748b', gate: '#7dd3fc', rift: '#a78bfa', through: '#94a3b8' };
</script>

{#if level === 2}
  {#each map.regions as r (r.id)}
    <path d={r.outline} class="area" class:known={r.known} style={`--c:${r.color}`} fill-rule="evenodd" />
  {/each}
  {#each map.sectorLinks as l (l.id)}
    <line x1={l.ax} y1={l.ay} x2={l.bx} y2={l.by} class="link {l.kind}" class:mine={l.mine} stroke={l.mine ? '#4ade80' : LINK[l.kind]} />
  {/each}
  {#each map.sectors as sec (sec.id)}
    {#if sec.known}
      <StarmapBody kind={sec.body?.kind ?? 'star'} x={sec.x} y={sec.y} r={px(sec.hub ? 6 : 4.5)} />
    {:else}
      <circle cx={sec.x} cy={sec.y} r={px(2.5)} class="uncharted" />
    {/if}
    {#if sec.id === map.currentSector}<circle cx={sec.x} cy={sec.y} r={px(13)} class="here" />{/if}
    {#if sec.known && (sec.id === map.currentSector || neighbours.has(sec.id))}
      <text stroke-width={px(3)} x={sec.x} y={sec.y + px(20)} class="sname" class:cur={sec.id === map.currentSector} font-size={px(11)}>{sec.name}</text>
    {/if}
  {/each}
  {#each map.regions as r (r.id)}
    {#if r.known}
      <text stroke-width={px(3)} x={r.x} y={r.y - px(26)} class="rname" fill={r.color} font-size={px(15)}>{r.name}</text>
      <text stroke-width={px(3)} x={r.x} y={r.y - px(10)} class="rtype" font-size={px(11)}>{r.typeLabel}</text>
    {/if}
  {/each}
{:else}
  {#each map.regionLinks as l (l.id)}
    <line x1={l.ax} y1={l.ay} x2={l.bx} y2={l.by} class="link {l.kind}" stroke={LINK[l.kind]} style={`--w:${1.2 + Math.min(4, l.count)}px`} />
  {/each}
  {#each map.regions as r (r.id)}
    {@const rad = px(5 + Math.sqrt(r.sectors) * 2.6)}
    <circle cx={r.x} cy={r.y} r={rad} class="rnode" class:known={r.known} style={`--c:${r.known ? r.color : '#475569'}`} />
    {#if r.current}<circle cx={r.x} cy={r.y} r={rad + px(6)} class="here" />{/if}
    <text stroke-width={px(3)} x={r.x} y={r.y + rad + px(14)} class="rname" fill={r.known ? r.color : '#64748b'} font-size={px(11)}>{r.known ? r.name : 'Uncharted'}</text>
    {#if r.known}<text stroke-width={px(3)} x={r.x} y={r.y + rad + px(27)} class="rtype" font-size={px(9)}>{r.typeLabel}</text>{/if}
  {/each}
{/if}

<style>
  .area { fill: var(--c); fill-opacity: 0.03; stroke: var(--c); stroke-opacity: 0.2; vector-effect: non-scaling-stroke; }
  .area.known { fill-opacity: 0.08; stroke-opacity: 0.55; stroke-width: 1.5; }
  .link { stroke-opacity: 0.55; stroke-width: 1.3; vector-effect: non-scaling-stroke; }
  .link.gate { stroke-opacity: 0.9; stroke-width: var(--w, 2.6px); }
  .link.rift { stroke-dasharray: 3 6; stroke-opacity: 0.8; stroke-width: var(--w, 1.6px); }
  .link.through { stroke-dasharray: 7 7; stroke-opacity: 0.45; stroke-width: 1.4; }
  .link.mine { stroke-opacity: 0.95; stroke-width: 2.6; }
  .uncharted { fill: #34445c; }
  .here { fill: none; stroke: var(--cyan); stroke-width: 2.5; vector-effect: non-scaling-stroke; }
  .rnode { fill: #0b1220; stroke: var(--c); stroke-width: 2; vector-effect: non-scaling-stroke; }
  .rnode:not(.known) { stroke-dasharray: 4 4; }
  text { text-anchor: middle; pointer-events: none; paint-order: stroke; stroke: #05080e; stroke-linejoin: round; }
  .sname { fill: #cbd5e1; }
  .sname.cur { fill: var(--cyan); }
  .rname { font-weight: 600; letter-spacing: 0.2em; text-transform: uppercase; }
  .rtype { fill: #94a3b8; }
</style>
