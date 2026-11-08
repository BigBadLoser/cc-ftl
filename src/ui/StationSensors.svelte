<script lang="ts">
  import { tip } from './kit';
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
  /**
   * One scale for every contact so the farthest one still fits inside the screen with padding (x spread full, y squashed to the iso view), and
   * anything that would land on the hologram is pushed out to its edge along the same bearing.
   */
  const YSQ = 0.7;
  const PAD = { l: 34, r: 34, t: 50, b: 40 };
  const place = $derived.by(() => {
    let k = 6;
    for (const c of contacts) {
      if (c.dx) k = Math.min(k, ((c.dx < 0 ? CX - PAD.l : W - CX - PAD.r) / Math.abs(c.dx)));
      if (c.dy) k = Math.min(k, ((c.dy < 0 ? CY - PAD.t : H - CY - PAD.b) / (Math.abs(c.dy) * YSQ)));
    }
    return (c: { dx: number; dy: number }) => {
      let x = c.dx * k;
      let y = c.dy * k * YSQ;
      const e = Math.hypot(x / 78, y / 46);
      if (e < 1) {
        const f = e > 0.01 ? 1 / e : 1;
        if (e > 0.01) { x *= f; y *= f; } else x = 78;
      }
      return { x: Math.max(PAD.l, Math.min(W - PAD.r, CX + x)), y: Math.max(PAD.t, Math.min(H - PAD.b, CY + y)) };
    };
  });
  const at = (c: { dx: number; dy: number }) => place(c);
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
      const y0 = p.y;
      for (let k = 1; k <= 8 && taken.some((t) => Math.hypot(t.x - p.x, t.y - p.y) < 34); k++) p.y = Math.max(PAD.t, Math.min(H - PAD.b, y0 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 30));
      taken.push({ ...p });
      return { c, p };
    });
  });
  const ships = $derived(placed.filter((x) => x.c.kind !== 'shuttle'));
  const shuttles = $derived(placed.filter((x) => x.c.kind === 'shuttle'));
  /**
   * Each label sits next to its contact: yours just above it, a ship's under it, a shuttle's a short way below its mark. A pass then nudges
   * labels apart vertically; a label that moved from its spot (and a shuttle's, which is a tiny mark) gets a short leader line.
   */
  const CW = 5.5;
  const MAX_LABELS = 4;
  const fit = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);
  const labels = $derived.by(() => {
    // You, the shuttles and then the nearest ships get a label; the rest stay silhouettes.
    const dist = (c: { dx: number; dy: number }) => Math.hypot(c.dx, c.dy);
    const wanted = [...ships.filter((x) => x.c.kind === 'you'), ...shuttles, ...ships.filter((x) => x.c.kind === 'ship').sort((a, b) => dist(a.c) - dist(b.c))].slice(0, MAX_LABELS);
    const raw = wanted.map(({ c, p }) => {
      const text = c.kind === 'ship' ? fit(c.label, 16) : c.label;
      const tone = c.kind === 'you' ? 'you' : c.kind === 'shuttle' ? 'amber' : 'dim';
      const w = text.length * CW;
      const ly = c.kind === 'you' ? p.y - SPRITE.you / 2 + 2 : c.kind === 'ship' ? p.y + SPRITE.ship / 2 + 8 : p.y + 30;
      const x = Math.max(w / 2 + 4, Math.min(W - w / 2 - 4, p.x));
      return { id: c.id, text, tone, w, x, y: ly, y0: ly, ax: p.x, ay: p.y + (c.kind === 'you' ? -SPRITE.you / 2 + 4 : c.kind === 'ship' ? SPRITE.ship / 2 : 3), lead: c.kind === 'shuttle' };
    });
    const out: typeof raw = [];
    const onHolo = (l: { x: number; w: number }, y: number) => Math.abs(l.x - CX) < l.w / 2 + HOLO / 2 + 2 && y + 2 > CY - 50 && y - 8 < CY + 52;
    for (const l of raw.sort((a, b) => a.y - b.y)) {
      const clash = (y: number) => onHolo(l, y) || out.some((o) => Math.abs(o.y - y) < 11 && Math.abs(o.x - l.x) < (o.w + l.w) / 2 + 4);
      for (let k = 0; k < 14 && clash(l.y); k++) l.y += 11;
      if (clash(l.y) || l.y > H - 5) { l.y = l.y0; for (let k = 0; k < 14 && clash(l.y); k++) l.y -= 11; }
      if (Math.abs(l.y - l.y0) > 1) l.lead = true;
      out.push(l);
    }
    return out;
  });
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
  {#each shuttles as { c, p } (c.id)}<i class="mark" style={`left:${p.x - 4}px;top:${p.y - 3}px`} use:tip={{ text: c.label }}></i>{/each}
  <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden="true">
    {#each ships as { c, p } (c.id)}
      <path class="head" d={`M${p.x} ${p.y} L${CX + (p.x - CX) * 0.45} ${CY + (p.y - CY) * 0.45}`} class:g={c.kind === 'you'} />
    {/each}
    {#each shuttles as { c, p } (c.id)}<path class="head a" d={`M${p.x} ${p.y} L${CX + (p.x - CX) * 0.3} ${CY + (p.y - CY) * 0.3}`} />{/each}
    {#each labels as l (l.id)}
      {#if l.lead}<path class="lead {l.tone}" d={`M${l.ax} ${l.ay} L${l.x} ${l.y + (l.y > l.ay ? -9 : 3)}`} />{/if}
      <text class={l.tone} x={l.x} y={l.y} text-anchor="middle">{l.text}</text>
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
  {#each log as l, i (i)}<div><time>{l.at}</time><b>{l.who}</b> <span>{l.what}</span></div>{:else}<div class="none">No traffic on the dock.</div>{/each}
</div>

<style>
  .screen { position: relative; border-bottom: 1px solid var(--line); background: #04080b; overflow: hidden; }
  .scan { position: absolute; inset: 0; background: repeating-linear-gradient(0deg, transparent 0 3px, rgba(0, 0, 0, 0.3) 3px 4px); pointer-events: none; }
  svg { position: absolute; left: 0; top: 0; pointer-events: none; }
  i.holo, i.ship { position: absolute; image-rendering: pixelated; }
  i.holo { filter: grayscale(1) brightness(1.5) sepia(1) hue-rotate(150deg) saturate(3) opacity(0.9); }
  i.ship.you { filter: grayscale(1) brightness(1.5) sepia(1) hue-rotate(92deg) saturate(2.6) opacity(0.78); }
  i.ship.other { filter: grayscale(1) brightness(1.2) sepia(1) hue-rotate(150deg) saturate(2) opacity(0.4); }
  i.mark { position: absolute; width: 8px; height: 6px; background: var(--amber); }
  .tagc { position: absolute; left: 8px; top: 6px; z-index: 2; font: 9px var(--pixel-font); letter-spacing: 0.06em; color: var(--ink-accent); }
  text { font: 8px var(--pixel-font); letter-spacing: 0.05em; }
  text.you { fill: var(--green); } text.amber { fill: var(--amber); } text.dim { fill: #6f9cb4; }
  .head { fill: none; stroke: #5fc8ee; stroke-dasharray: 2 4; opacity: 0.6; }
  .head.g { stroke: var(--green); } .head.a { stroke: var(--amber); stroke-dasharray: 3 3; opacity: 1; }
  .lead { fill: none; stroke-width: 0.8; opacity: 0.6; }
  .lead.amber, .lead.a { stroke: var(--amber); } .lead.you { stroke: var(--green); } .lead.dim { stroke: #6f9cb4; }
  .lead.a { stroke-width: 1.2; opacity: 1; }
  .brk { fill: none; stroke: var(--amber); stroke-width: 1.2; }
  .gun { fill: #ff8a7a; }
  .co { position: absolute; z-index: 2; font: 9px var(--pixel-font); color: var(--amber); letter-spacing: 0.05em; line-height: 1.35; }
  .co em { display: block; font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; font-style: normal; font-size: 11px; line-height: 1.3; color: var(--text); letter-spacing: 0; }
  .def { left: 8px; top: 22px; } .dock { right: 8px; top: 24px; text-align: right; }
  .log { padding: 8px 10px; display: grid; gap: 4px; font-size: 12.5px; border-bottom: 1px solid var(--line); min-height: 64px; box-sizing: border-box; }
  .log div { display: flex; gap: 6px; align-items: baseline; }
  .log time { flex: none; width: 36px; font: 9px var(--pixel-font); color: var(--dim); opacity: 0.8; }
  .log b { font-weight: 600; flex: none; }
  .log span { color: var(--dim); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .none { color: var(--dim); }
</style>
