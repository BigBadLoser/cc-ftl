<script lang="ts">
  /**
   * The deploy picker: the ship has dropped out of hyperspace and waits to be placed. The sector is drawn flat (tiles), with the
   * ships already there, the keep-out frames the gap rule draws around them, and the spots where the ship may go. Tap or drag to
   * move the ship's outline (green when the spot passes the gap rule, red when not), then Deploy.
   */
  import { onMount } from 'svelte';
  import type { UiApi } from './api';
  import Icon from './Icon.svelte';
  import PanelHead from './PanelHead.svelte';
  import type { UiDeploy } from './starmapApi';

  let { api, deploy }: { api: UiApi; deploy: UiDeploy } = $props();

  const REASONS: Record<string, string> = {
    overlap: 'Overlaps another ship.', tooClose: 'Too close to another ship.', outOfBounds: 'Outside the sector.', badValue: 'Not a tile.', notDeploying: 'Nothing to deploy.',
  };
  let spot = $state<{ x: number; y: number }>({ x: 0, y: 0 });
  let svg: SVGSVGElement;
  let dragging = false;

  onMount(() => {
    spot = deploy.suggested ?? { x: Math.max(0, Math.round((deploy.width - deploy.ship.w) / 2)), y: Math.max(0, Math.round((deploy.height - deploy.ship.h) / 2)) };
  });
  const error = $derived(api.deployCheck(spot.x, spot.y));
  /** Where the ship's top-left may go, on a coarse grid (each cell is one square of the map): the valid spots, highlighted. */
  const STEP = 4;
  const valid = $derived.by(() => {
    const out: { x: number; y: number }[] = [];
    for (let y = 0; y + deploy.ship.h <= deploy.height; y += STEP) {
      for (let x = 0; x + deploy.ship.w <= deploy.width; x += STEP) if (!api.deployCheck(x, y)) out.push({ x, y });
    }
    return out;
  });

  function place(e: PointerEvent) {
    const r = svg.getBoundingClientRect();
    const x = Math.round(((e.clientX - r.left) / r.width) * deploy.width - deploy.ship.w / 2);
    const y = Math.round(((e.clientY - r.top) / r.height) * deploy.height - deploy.ship.h / 2);
    spot = { x: Math.max(0, Math.min(deploy.width - deploy.ship.w, x)), y: Math.max(0, Math.min(deploy.height - deploy.ship.h, y)) };
  }
  const go = () => {
    if (!error) api.dispatch({ type: 'sector.deploy', x: spot.x, y: spot.y });
  };
  const auto = () => {
    if (deploy.suggested) spot = deploy.suggested;
  };
  function key(e: KeyboardEvent) {
    if (e.key === 'Enter') go();
  }
</script>

<svelte:window onkeydown={key} />

<div class="picker" data-testid="deploy-picker">
  <div class="head"><PanelHead icon="ship" title="Deploy" sub={deploy.nodeName} /></div>
  <div class="statbar">
    <span class="cell" class:bad={!!error} data-testid="deploy-state"><Icon name={error ? 'alert' : 'target'} size={18} /><b>{error ? REASONS[error] ?? error : 'Spot is clear.'}</b></span>
    <span class="cell"><Icon name="grid" size={18} /><b>{spot.x}, {spot.y}</b></span>
  </div>
  <div class="area">
    <svg bind:this={svg} viewBox={`0 0 ${deploy.width} ${deploy.height}`} preserveAspectRatio="xMidYMid meet" role="application" aria-label="Sector"
      onpointerdown={(e) => { dragging = true; svg.setPointerCapture(e.pointerId); place(e); }} onpointermove={(e) => dragging && place(e)} onpointerup={() => (dragging = false)} onpointercancel={() => (dragging = false)}>
      <rect class="field" x="0" y="0" width={deploy.width} height={deploy.height} />
      {#each valid as v (`${v.x},${v.y}`)}<rect class="ok" x={v.x} y={v.y} width={STEP} height={STEP} />{/each}
      {#each deploy.others as o, i (i)}
        <rect class="frame" x={o.frame.x} y={o.frame.y} width={o.frame.w} height={o.frame.h} />
        <rect class="other" class:hostile={o.hostile} x={o.x} y={o.y} width={o.w} height={o.h} />
        <text x={o.x + o.w / 2} y={o.y + o.h / 2} class="label">{o.name}</text>
      {/each}
      <rect class="ghost" class:bad={!!error} x={spot.x} y={spot.y} width={deploy.ship.w} height={deploy.ship.h} data-testid="deploy-ghost" />
      <text x={spot.x + deploy.ship.w / 2} y={spot.y + deploy.ship.h / 2} class="label you">Your ship</text>
    </svg>
  </div>
  <div class="bar">
    <button onclick={auto} disabled={!deploy.suggested} data-testid="deploy-auto"><Icon name="recenter" size={18} />Best spot</button>
    <button class="go" onclick={go} disabled={!!error} data-testid="deploy-go"><Icon name="ship" size={18} />Deploy here</button>
  </div>
</div>

<style>
  .picker { position: fixed; inset: 0; z-index: 12; display: flex; flex-direction: column; background: var(--bg); padding: var(--sat) var(--sar) 0 var(--sal); }
  .head { flex: none; padding: 10px 10px 0; background: var(--panel); border-bottom: 1px solid var(--line-hi); }
  .head :global(.ph) { margin: -10px -10px 0; }
  .statbar { flex: none; display: flex; gap: 4px; flex-wrap: wrap; padding: 6px 10px; background: var(--panel); border-bottom: 1px solid var(--line); }
  .cell { display: flex; align-items: center; gap: 6px; padding: 6px 8px; min-height: 20px; background: var(--panel-2); border: 1px solid var(--line); color: var(--cyan); }
  .cell b { color: var(--text); font-weight: 600; }
  .cell.bad { border-color: var(--red); color: var(--red); }
  .area { position: relative; flex: 1; min-height: 0; }
  svg { position: absolute; inset: 8px; width: calc(100% - 16px); height: calc(100% - 16px); touch-action: none; border: 1px solid var(--line-hi); background: var(--panel); }
  .field { fill: var(--bg); stroke: var(--line); stroke-width: 0.4; }
  .ok { fill: var(--green); opacity: 0.12; }
  .frame { fill: var(--red); opacity: 0.16; stroke: var(--red); stroke-opacity: 0.5; stroke-width: 0.4; stroke-dasharray: 2 1.5; }
  .other { fill: var(--panel-3); stroke: var(--dim); stroke-width: 0.5; }
  .other.hostile { stroke: var(--red); fill: color-mix(in srgb, var(--red) 25%, var(--panel-2)); }
  .ghost { fill: color-mix(in srgb, var(--green) 30%, transparent); stroke: var(--green); stroke-width: 0.7; }
  .ghost.bad { fill: color-mix(in srgb, var(--red) 30%, transparent); stroke: var(--red); }
  .label { fill: var(--text); font: 600 4px var(--head-font); letter-spacing: 0.05em; text-anchor: middle; dominant-baseline: middle; pointer-events: none; text-transform: uppercase; }
  .label.you { fill: var(--cyan); }
  .bar { flex: none; display: flex; gap: 6px; padding: 8px 10px calc(8px + var(--sab)); background: var(--panel); border-top: 1px solid var(--line-hi); }
  .bar button { flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px; font: 600 15px var(--head-font); letter-spacing: 0.08em; text-transform: uppercase; }
  .go { border-color: var(--cyan); background: var(--panel-3); color: var(--text); }
</style>
