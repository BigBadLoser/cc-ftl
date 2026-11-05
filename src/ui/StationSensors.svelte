<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi, UiStationInfo } from './api';
  import PaneHeader from './comms/PaneHeader.svelte';
  import type { UiStarArt } from './starmapApi';

  /**
   * The right pane's top: the station's sensor screen and the traffic log. The hologram is the station's own starmap icon, scaled up and tinted
   * cyan; ships near it are their starmap fleet silhouettes (you green, the rest faint). Stations get their own hologram sprite in step 3.
   */
  let { api, name, info }: { api: UiApi; name: string; info: UiStationInfo } = $props();
  const W = 340;
  const H = 240;
  const CX = W / 2;
  const CY = 108;
  const HOLO = 128;
  let art = $state<UiStarArt | null>(null);
  onMount(() => api.starmapArt.subscribe((a) => (art = a)));
  const contacts = $derived(info.traffic?.contacts ?? []);
  /** The farthest contact lands near the screen edge, closer ones in proportion (never inside the hologram). */
  const scale = $derived.by(() => {
    const far = Math.max(40, ...contacts.map((c) => Math.hypot(c.dx, c.dy)));
    return 1 / far;
  });
  function at(c: { dx: number; dy: number }) {
    const d = Math.hypot(c.dx, c.dy) || 1;
    const r = Math.max(HOLO / 2 + 26, Math.min(1, d * scale) * 138);
    return { x: Math.max(24, Math.min(W - 24, CX + (c.dx / d) * r * 1.2)), y: Math.max(40, Math.min(H - 52, CY + (c.dy / d) * r * 0.62)) };
  }
  const SPRITE = { you: 60, ship: 40, shuttle: 0 } as const;
  const frame = (id: string) => art?.frames[id];
  /** A starmap frame as a CSS background at `px` wide (the sheet scaled with it, pixelated). */
  function bg(id: string, px: number): string {
    const f = frame(id);
    if (!art || !f) return '';
    const k = px / f.w;
    return `width:${f.w * k}px;height:${f.h * k}px;background:url(${art.src}) -${f.x * k}px -${f.y * k}px / ${art.w * k}px ${art.h * k}px no-repeat`;
  }
  const station = $derived(info.sprite && frame(info.sprite) ? info.sprite : 'starmap.struct.station_trade');
  /** Every contact gets a spot; one that lands on another is nudged up or down until it clears (you first, then shuttles, then the rest). */
  const placed = $derived.by(() => {
    const taken: { x: number; y: number }[] = [];
    const order = [...contacts.filter((c) => c.kind === 'you'), ...contacts.filter((c) => c.kind === 'shuttle'), ...contacts.filter((c) => c.kind === 'ship')];
    return order.map((c) => {
      const p = at(c);
      for (let k = 1; k <= 8 && taken.some((t) => Math.hypot(t.x - p.x, t.y - p.y) < 34); k++) p.y = Math.max(40, Math.min(H - 52, at(c).y + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 30));
      taken.push({ ...p });
      return { c, p };
    });
  });
  const ships = $derived(placed.filter((x) => x.c.kind !== 'shuttle'));
  const shuttles = $derived(placed.filter((x) => x.c.kind === 'shuttle'));
  /** Labels stack in their own lane at the bottom, each tied to its mark by a leader line that stops at the end of its text, so none overlap. */
  const lane = (i: number, n: number) => H - 10 - (n - 1 - i) * 12;
  const named = $derived([...shuttles.map((s) => ({ ...s, tone: 'amber', text: s.c.label })), ...ships.filter((s) => s.c.kind === 'ship').map((s) => ({ ...s, tone: 'dim', text: `${s.c.label} · INBOUND` }))]);
  const textEnd = (t: string) => 8 + t.length * 5.5 + 5;
  const gunDots = $derived(Array.from({ length: Math.min(4, info.guns) }, (_, i) => [[-1, -1], [1, -1], [-1, 1], [1, 1]][i] as [number, number]));
  const log = $derived(info.traffic?.log ?? []);
</script>

<PaneHeader label="SENSORS" done="LIVE" />
<div class="screen" style:height={`${H}px`} data-testid="station-sensors">
  <span class="tagc">{name.toUpperCase()}</span>
  <i class="holo" style={`${bg(station, HOLO)};left:${CX - HOLO / 2}px;top:${CY - HOLO / 2}px`}></i>
  {#each ships as { c, p } (c.id)}
    {#if c.kind === 'you' || c.kind === 'ship'}
      <i class="ship" class:you={c.kind === 'you'} class:other={c.kind === 'ship'} style={`${bg(`starmap.fleet.${c.fleet}.d${c.dir}`, SPRITE[c.kind])};left:${p.x - SPRITE[c.kind] / 2}px;top:${p.y - SPRITE[c.kind] / 2}px`}></i>
    {/if}
  {/each}
  {#each shuttles as { c, p } (c.id)}<i class="mark" style={`left:${p.x - 4}px;top:${p.y - 3}px`} title={c.label}></i>{/each}
  <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden="true">
    {#each ships as { c, p } (c.id)}
      {#if c.kind === 'you'}<text class="you" x={p.x} y={p.y - 32} text-anchor="middle">YOU</text>{/if}
      <path class="head" d={`M${p.x} ${p.y} L${CX + (p.x - CX) * 0.45} ${CY + (p.y - CY) * 0.45}`} class:g={c.kind === 'you'} />
    {/each}
    {#each shuttles as { c, p } (c.id)}<path class="head a" d={`M${p.x} ${p.y} L${CX + (p.x - CX) * 0.3} ${CY + (p.y - CY) * 0.3}`} />{/each}
    {#each named as n, i (n.c.id)}
      <path class="lead {n.tone}" d={`M${n.p.x} ${n.p.y + 3} V${lane(i, named.length) - 4} H${textEnd(n.text)}`} />
      <text class={n.tone} x="8" y={lane(i, named.length)}>{n.text}</text>
    {/each}
    {#each gunDots as [x, y], i (i)}<circle class="gun" cx={CX + x * (HOLO / 2 - 8)} cy={CY + y * (HOLO / 4)} r="2.2" />{/each}
    <path class="lead a" d={`M${CX + 14} ${CY - 10} L${W - 90} ${CY - 50} H${W - 6}`} />
    <path class="brk" d={`M${CX + 8} ${CY - 18}h8v-8M${CX + 8} ${CY - 4}h8v8M${CX + 32} ${CY - 18}h-8v-8M${CX + 32} ${CY - 4}h-8v8`} />
  </svg>
  <div class="co def"><b>DEFENCE</b><em>{info.guns} guns · {info.shields} shields</em></div>
  <div class="co dock"><b>DOCKS</b><em data-testid="station-docks">{info.traffic?.docksFree ?? info.docks} of {info.docks} free</em></div>
  <i class="scan"></i>
</div>
<div class="log" data-testid="station-traffic">
  {#each log as l, i (i)}<div><b>{l.who}</b> <span>{l.what}</span></div>{:else}<div class="none">No traffic on the dock.</div>{/each}
</div>

<style>
  .screen { position: relative; border-bottom: 1px solid var(--line); background: #04080b; overflow: hidden; }
  .scan { position: absolute; inset: 0; background: repeating-linear-gradient(0deg, transparent 0 3px, rgba(0, 0, 0, 0.3) 3px 4px); pointer-events: none; }
  svg { position: absolute; left: 0; top: 0; pointer-events: none; }
  i.holo, i.ship { position: absolute; image-rendering: pixelated; }
  i.holo { filter: grayscale(1) brightness(1.5) sepia(1) hue-rotate(150deg) saturate(3) opacity(0.9); }
  i.ship.you { filter: grayscale(1) brightness(3) sepia(1) hue-rotate(95deg) saturate(8) opacity(0.95); }
  i.ship.other { filter: grayscale(1) brightness(1.2) sepia(1) hue-rotate(150deg) saturate(2) opacity(0.4); }
  i.mark { position: absolute; width: 8px; height: 6px; background: var(--amber); }
  .tagc { position: absolute; left: 8px; top: 6px; z-index: 2; font: 9px var(--pixel-font); letter-spacing: 0.06em; color: var(--ink-accent); }
  text { font: 8px var(--pixel-font); letter-spacing: 0.05em; }
  text.you { fill: var(--green); } text.amber { fill: var(--amber); } text.dim { fill: #6f9cb4; }
  .head { fill: none; stroke: #5fc8ee; stroke-dasharray: 2 4; opacity: 0.6; }
  .head.g { stroke: var(--green); } .head.a { stroke: var(--amber); stroke-dasharray: 3 3; opacity: 1; }
  .lead { fill: none; stroke-width: 0.8; opacity: 0.6; }
  .lead.amber, .lead.a { stroke: var(--amber); } .lead.dim { stroke: #6f9cb4; }
  .lead.a { stroke-width: 1.2; opacity: 1; }
  .brk { fill: none; stroke: var(--amber); stroke-width: 1.2; }
  .gun { fill: #ff8a7a; }
  .co { position: absolute; z-index: 2; font: 9px var(--pixel-font); color: var(--amber); letter-spacing: 0.05em; line-height: 1.35; }
  .co em { display: block; font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; font-style: normal; font-size: 11px; line-height: 1.3; color: var(--text); letter-spacing: 0; }
  .def { left: 8px; top: 22px; } .dock { right: 8px; top: 24px; text-align: right; }
  .log { padding: 8px 10px; display: grid; gap: 4px; font-size: 12.5px; border-bottom: 1px solid var(--line); min-height: 64px; box-sizing: border-box; }
  .log b { font-weight: 600; }
  .log span { color: var(--dim); }
  .none { color: var(--dim); }
</style>
