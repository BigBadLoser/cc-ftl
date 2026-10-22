<script lang="ts">
  /**
   * The deploy picker: the ship has dropped out of hyperspace and waits to be placed. A compact panel shows the node as a coarse grid
   * (one cell = CELL x CELL tiles, about 1:10): the ships already there as blocks, the cells the gap rule keeps clear marked red,
   * the cells where the ship may go tinted, and a ghost block for your ship. Tap or drag to pick a cell; the ship's top-left tile is
   * that cell's origin, and the gap rule is still checked at tile level (`api.deployCheck`).
   */
  import { onMount } from 'svelte';
  import type { UiApi } from './api';
  import Icon from './Icon.svelte';
  import PanelHead from './PanelHead.svelte';
  import type { UiDeploy } from './starmapApi';

  let { api, deploy }: { api: UiApi; deploy: UiDeploy } = $props();

  /** Tiles per grid cell. */
  const CELL = 10;
  const cols = $derived(Math.ceil(deploy.width / CELL));
  const rows = $derived(Math.ceil(deploy.height / CELL));
  /** Cells the ship covers, and the farthest cell its origin may sit on (so it stays inside the node). */
  const span = $derived({ w: Math.ceil(deploy.ship.w / CELL), h: Math.ceil(deploy.ship.h / CELL) });
  const maxCell = $derived({ x: Math.max(0, Math.floor((deploy.width - deploy.ship.w) / CELL)), y: Math.max(0, Math.floor((deploy.height - deploy.ship.h) / CELL)) });

  const REASONS: Record<string, string> = {
    overlap: 'Overlaps another ship.', tooClose: 'Too close to another ship.', outOfBounds: 'Outside the node.', badValue: 'Not a tile.', notDeploying: 'Nothing to deploy.',
  };
  let cell = $state({ x: 0, y: 0 });
  let svg: SVGSVGElement;
  let dragging = false;

  const hits = (r: { x: number; y: number; w: number; h: number }, cx: number, cy: number): boolean =>
    r.x < (cx + 1) * CELL && r.x + r.w > cx * CELL && r.y < (cy + 1) * CELL && r.y + r.h > cy * CELL;
  /** Per cell: a ship's block, or inside a ship's keep-out frame. */
  const blocks = $derived.by(() => {
    const out: { x: number; y: number; kind: 'ship' | 'hostile' | 'keep' }[] = [];
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const o = deploy.others.find((s) => hits(s, x, y));
        if (o) out.push({ x, y, kind: o.hostile ? 'hostile' : 'ship' });
        else if (deploy.others.some((s) => hits(s.frame, x, y))) out.push({ x, y, kind: 'keep' });
      }
    }
    return out;
  });
  /** Cells where the ship's origin passes the gap rule. */
  const valid = $derived.by(() => {
    const out: { x: number; y: number }[] = [];
    for (let y = 0; y <= maxCell.y; y++) for (let x = 0; x <= maxCell.x; x++) if (!api.deployCheck(x * CELL, y * CELL)) out.push({ x, y });
    return out;
  });
  /** The valid cell nearest to the middle left, where a new game starts the ship. */
  const best = $derived(valid.length ? valid.reduce((b, c) => (Math.hypot(c.x - 2, c.y - 5) < Math.hypot(b.x - 2, b.y - 5) ? c : b)) : null);

  onMount(() => {
    cell = best ?? { x: Math.min(2, maxCell.x), y: Math.min(5, maxCell.y) };
  });
  const tile = $derived({ x: cell.x * CELL, y: cell.y * CELL });
  const error = $derived(api.deployCheck(tile.x, tile.y));

  function pick(e: PointerEvent) {
    const r = svg.getBoundingClientRect();
    const x = Math.floor(((e.clientX - r.left) / r.width) * cols);
    const y = Math.floor(((e.clientY - r.top) / r.height) * rows);
    cell = { x: Math.max(0, Math.min(maxCell.x, x)), y: Math.max(0, Math.min(maxCell.y, y)) };
  }
  const go = () => {
    if (!error) api.dispatch({ type: 'sector.deploy', x: tile.x, y: tile.y });
  };
  const useBest = () => {
    if (best) cell = best;
  };
  function key(e: KeyboardEvent) {
    if (e.key === 'Enter') go();
  }
</script>

<svelte:window onkeydown={key} />

<div class="veil" data-testid="deploy-picker">
  <div class="streaks" aria-hidden="true"></div>
  <div class="sheet panel">
    <PanelHead icon="ship" title="Deploy" sub={deploy.nodeName} />
    <div class="cells">
      <span class="cell" class:bad={!!error} data-testid="deploy-state"><Icon name={error ? 'alert' : 'target'} size={18} /><b>{error ? REASONS[error] ?? error : 'Spot is clear.'}</b></span>
      <span class="cell" title="Cell and tile"><Icon name="grid" size={18} /><b>{cell.x},{cell.y}</b><small>tile {tile.x},{tile.y}</small></span>
    </div>
    <svg bind:this={svg} viewBox={`0 0 ${cols} ${rows}`} preserveAspectRatio="xMidYMid meet" role="application" aria-label="Node grid"
      onpointerdown={(e) => { dragging = true; svg.setPointerCapture(e.pointerId); pick(e); }} onpointermove={(e) => dragging && pick(e)} onpointerup={() => (dragging = false)} onpointercancel={() => (dragging = false)}>
      <rect class="field" x="0" y="0" width={cols} height={rows} />
      {#each valid as v (`${v.x},${v.y}`)}<rect class="ok" x={v.x} y={v.y} width="1" height="1" />{/each}
      {#each blocks as b (`${b.x},${b.y}`)}<rect class={b.kind} x={b.x} y={b.y} width="1" height="1" data-testid={`deploy-${b.kind}`} />{/each}
      {#each [...Array(cols + 1).keys()] as i (i)}<line class="grid" x1={i} y1="0" x2={i} y2={rows} />{/each}
      {#each [...Array(rows + 1).keys()] as i (i)}<line class="grid" x1="0" y1={i} x2={cols} y2={i} />{/each}
      <rect class="ghost" class:bad={!!error} x={cell.x} y={cell.y} width={span.w} height={span.h} data-testid="deploy-ghost" />
    </svg>
    <ul class="legend" aria-label="Key">
      <li><i class="k you"></i>Your ship</li><li><i class="k ship"></i>Ship</li><li><i class="k hostile"></i>Hostile</li><li><i class="k keep"></i>Keep clear</li>
    </ul>
    <div class="actions">
      <button onclick={useBest} disabled={!best} data-testid="deploy-auto"><Icon name="recenter" size={18} />Best spot</button>
      <button class="go" onclick={go} disabled={!!error} data-testid="deploy-go"><Icon name="ship" size={18} />Deploy here</button>
    </div>
  </div>
</div>

<style>
  /* Nothing of the game shows behind the picker: an opaque hyperspace backdrop of CSS streaks. */
  .veil { position: fixed; inset: 0; z-index: 12; background: var(--bg); overflow: hidden; }
  .streaks { position: absolute; inset: -50%; background: repeating-linear-gradient(100deg, transparent 0 46px, color-mix(in srgb, var(--cyan) 22%, transparent) 46px 48px, transparent 48px 120px, color-mix(in srgb, var(--cyan) 10%, transparent) 120px 121px); animation: rush 0.9s linear infinite; }
  @keyframes rush { to { transform: translateX(-120px); } }
  @media (prefers-reduced-motion: reduce) { .streaks { animation: none; } }
  .panel { display: grid; gap: 8px; grid-template-columns: minmax(0, 1fr); box-sizing: border-box; background: linear-gradient(var(--panel), var(--panel)), var(--bg); }
  @media (min-width: 601px) { .panel { left: 50%; top: 50%; right: auto; bottom: auto; transform: translate(-50%, -50%); width: min(560px, calc(100vw - 24px)); border-width: 1px; } }
  .cells { display: flex; gap: 4px; flex-wrap: wrap; }
  .cell { display: flex; align-items: center; gap: 6px; padding: 6px 8px; min-height: 20px; background: var(--panel-2); border: 1px solid var(--line); color: var(--cyan); }
  .cell b { color: var(--text); font-weight: 600; }
  .cell small { color: var(--dim); font-size: 11px; }
  .cell.bad { border-color: var(--red); color: var(--red); }
  svg { display: block; width: 100%; height: auto; touch-action: none; border: 1px solid var(--line-hi); background: var(--bg); }
  .field { fill: var(--panel-2); }
  .ok { fill: var(--green); opacity: 0.14; }
  .ship { fill: var(--dim); opacity: 0.7; }
  .hostile { fill: var(--red); opacity: 0.55; }
  .keep { fill: var(--red); opacity: 0.22; }
  .grid { stroke: var(--line); stroke-width: 1; vector-effect: non-scaling-stroke; }
  .ghost { fill: color-mix(in srgb, var(--green) 35%, transparent); stroke: var(--green); stroke-width: 2; vector-effect: non-scaling-stroke; }
  .ghost.bad { fill: color-mix(in srgb, var(--red) 35%, transparent); stroke: var(--red); }
  .legend { margin: 0; padding: 0; list-style: none; display: flex; gap: 12px; flex-wrap: wrap; font-size: 12px; color: var(--dim); }
  .legend li { display: flex; align-items: center; gap: 6px; }
  .k { display: inline-block; width: 12px; height: 12px; border: 1px solid var(--line-hi); }
  .k.you { background: color-mix(in srgb, var(--green) 35%, transparent); border-color: var(--green); }
  .k.ship { background: var(--dim); } .k.hostile { background: var(--red); } .k.keep { background: color-mix(in srgb, var(--red) 25%, transparent); }
  .actions { display: flex; gap: 6px; }
  .actions button { flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px; font: 600 15px var(--head-font); letter-spacing: 0.08em; text-transform: uppercase; }
  .go { border-color: var(--cyan); background: var(--panel-3); color: var(--text); }
</style>
