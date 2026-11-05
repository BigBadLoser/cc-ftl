<script lang="ts">
  import FlickerText from './FlickerText.svelte';
  import StaticFeed from './StaticFeed.svelte';
  import type { Callout, ReadoutRow } from './types';

  /**
   * The sensor screen and its readout. Unscanned: cyan static ("NO SCAN") and no hull. Scanned: a hologram of `holo` (an image and its size) with
   * `callouts` (a corner-bracket crosshair on a part, a leader line to a label off the silhouette), then label-over-value `readout` rows. `pending`
   * shows "RESOLVING" static while the picture is made; `hint` is the dim line under an unscanned screen. `title` is the screen's corner tag.
   * `force` holds readout flickers for stills.
   */
  let { scanned, holo = null, pending = false, title, callouts = [], readout = [], hint, emptyLabel = 'NO SCAN', force = false }: {
    scanned: boolean; holo?: { url: string; w: number; h: number } | null; pending?: boolean; title?: string; callouts?: Callout[]; readout?: ReadoutRow[];
    hint?: string | null; emptyLabel?: string; force?: boolean;
  } = $props();

  const W = 314;
  const H = 210;
  const PAD = { l: 44, r: 44, t: 34, b: 40 };
  const fit = $derived.by(() => {
    if (!holo) return null;
    const bw = W - PAD.l - PAD.r;
    const bh = H - PAD.t - PAD.b;
    const s = Math.min(bw / holo.w, bh / holo.h);
    const w = holo.w * s;
    const h = holo.h * s;
    return { x: PAD.l + (bw - w) / 2, y: PAD.t + (bh - h) / 2, w, h };
  });
  type Corner = 'tl' | 'tr' | 'bl' | 'br';
  /** Each callout gets a corner: its own request, else the side it is nearest; two labels never share a row (top or bottom), so they do not run into each other. */
  const placed = $derived.by(() => {
    const taken: Corner[] = [];
    const rows: string[] = [];
    const f = fit;
    if (!f) return [];
    return callouts.map((c) => {
      const px = f.x + c.at.x * f.w;
      const py = f.y + c.at.y * f.h;
      const h = px > W / 2 ? 'r' : 'l';
      let v = py > H / 2 ? 'b' : 't';
      if (rows.includes(v)) v = v === 't' ? 'b' : 't';
      const want = (c.corner ?? `${v}${h}`) as Corner;
      const corner = taken.includes(want) ? (`${want[0]}${want[1] === 'r' ? 'l' : 'r'}` as Corner) : want;
      taken.push(corner);
      rows.push(corner[0]!);
      return { c, px, py, corner };
    });
  });
  let sizes = $state<Record<string, { w: number; h: number }>>({});
  const setSize = (id: string, v: { w?: number | null; h?: number | null }): void => {
    const cur = sizes[id] ?? { w: 100, h: 30 };
    sizes[id] = { w: v.w ?? cur.w, h: v.h ?? cur.h };
  };
  const SIZE = 11;
  /** Top labels sit under the corner tag. */
  const TOP = 20;
  /** The leader line: from the bracket towards the label's inner end, then along its rule. */
  const lines = $derived(placed.map(({ c, px, py, corner }) => {
    const s = sizes[c.id] ?? { w: 100, h: 30 };
    const right = corner[1] === 'r';
    const top = corner[0] === 't';
    const ex = right ? W - 4 - s.w : 4 + s.w;
    const ey = top ? TOP + s.h : H - 4 - s.h;
    const dx = ex - px;
    const dy = ey - py;
    const len = Math.hypot(dx, dy) || 1;
    const sx = px + (dx / len) * (SIZE + 2);
    const sy = py + (dy / len) * (SIZE + 2);
    return { id: c.id, d: `M${sx} ${sy} L${ex} ${ey}` };
  }));
</script>

<div class="sensor">
  <div class="screen" style:width={`${W}px`} style:height={`${H}px`}>
    {#if scanned && holo && fit}
      <div class="grid"></div>
      <img src={holo.url} alt="" style:left={`${fit.x}px`} style:top={`${fit.y}px`} style:width={`${fit.w}px`} style:height={`${fit.h}px`} />
      <i class="lines"></i>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
        {#each lines as l (l.id)}<path d={l.d} stroke="var(--amber)" stroke-opacity="0.8" stroke-width="1.3" fill="none" />{/each}
        {#each placed as p (p.c.id)}
          <g stroke="var(--amber)" stroke-width="1.6" fill="none">
            <path d={`M${p.px - SIZE} ${p.py - SIZE + 6} v-6 h6 M${p.px + SIZE} ${p.py - SIZE + 6} v-6 h-6 M${p.px - SIZE} ${p.py + SIZE - 6} v6 h6 M${p.px + SIZE} ${p.py + SIZE - 6} v6 h-6`} />
            <circle cx={p.px} cy={p.py} r="2" fill="var(--amber)" stroke="none" />
          </g>
        {/each}
      </svg>
      {#if title}<span class="tag">{title}</span>{/if}
      {#each placed as p (p.c.id)}
        <div class="co {p.corner}" data-callout={p.c.id} bind:clientWidth={null, (w) => setSize(p.c.id, { w })} bind:clientHeight={null, (h) => setSize(p.c.id, { h })}>
          <b>{p.c.label}</b><em>{p.c.value}</em>
        </div>
      {/each}
    {:else if scanned && pending}
      <StaticFeed tone="cyan" label="RESOLVING" tag={title} />
    {:else if scanned}
      <StaticFeed tone="cyan" label="SIGNATURE ONLY" tag={title} />
    {:else}
      <StaticFeed tone="cyan" label={emptyLabel} tag="CONTACT" />
    {/if}
  </div>
  {#if !scanned && hint}<p class="hint">{hint}</p>{/if}
  {#if scanned && readout.length}
    <div class="ro">
      {#each readout as r (r.label)}
        <div class:wide={r.wide}><b>{r.label}</b><span><FlickerText value={r.value} alt={r.alt ?? null} {force} /></span></div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .sensor { padding: 12px; display: grid; gap: 10px; align-content: start; }
  .screen { position: relative; overflow: hidden; border: 1px solid var(--line-hi); background: #04080b; box-sizing: border-box; }
  .grid { position: absolute; inset: 0; background: repeating-linear-gradient(90deg, rgba(54, 212, 255, 0.05) 0 1px, transparent 1px 14px), repeating-linear-gradient(0deg, rgba(54, 212, 255, 0.05) 0 1px, transparent 1px 14px); }
  img { position: absolute; image-rendering: pixelated; filter: grayscale(1) brightness(1.15) sepia(1) hue-rotate(150deg) saturate(3) opacity(0.85); }
  .lines { position: absolute; inset: 0; background: repeating-linear-gradient(0deg, transparent 0 3px, rgba(0, 0, 0, 0.3) 3px 4px); pointer-events: none; }
  svg { position: absolute; inset: 0; pointer-events: none; }
  .tag { position: absolute; left: 6px; top: 4px; font: 9px var(--pixel-font); letter-spacing: 0.06em; color: var(--cyan); }
  .co { position: absolute; display: grid; gap: 1px; max-width: 140px; width: max-content; padding: 2px 0; }
  .co b { font: 9px/1.3 var(--pixel-font); letter-spacing: 0.05em; color: var(--amber); text-transform: uppercase; }
  .co em { font: normal 10.5px/1.3 system-ui, sans-serif; color: var(--text); }
  .co.tl, .co.tr { top: 20px; border-bottom: 1px solid rgba(240, 177, 58, 0.8); }
  .co.bl, .co.br { bottom: 4px; border-top: 1px solid rgba(240, 177, 58, 0.8); }
  .co.tl, .co.bl { left: 4px; text-align: left; }
  .co.tr, .co.br { right: 4px; text-align: right; }
  .hint { margin: 0; color: var(--dim); font-size: 12.5px; font-style: italic; }
  .ro { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 14px; padding: 0 0 2px; }
  .ro > div { min-width: 0; }
  .ro .wide { grid-column: 1 / -1; }
  .ro b { display: block; font: 600 10.5px var(--head-font); letter-spacing: 0.14em; text-transform: uppercase; color: var(--dim); }
  .ro span { font-size: 13px; }
</style>
