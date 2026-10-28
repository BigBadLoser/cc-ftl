<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi, UiHullPlan, UiToolState } from './api';

  /** The Hull plan build tool's bar: the brush (rectangle or diagonal), add or erase, mirror, clear, and what the plan does to the hull count. */
  let { api }: { api: UiApi } = $props();
  let st = $state<UiToolState>({ tool: 'build', build: 'hull', moduleDef: null, rot: 0 });
  let plan = $state<UiHullPlan | null>(null);
  onMount(() => {
    const u = [api.tool.subscribe((t) => (st = t)), api.yard.subscribe((y) => (plan = y.plan))];
    return () => u.forEach((f) => f());
  });
  const hull = $derived({ brush: 'rect' as const, erase: false, mirror: false, ...st.hull });
  const over = $derived(!!plan && plan.hull.capacity > 0 && plan.hull.afterAll > plan.hull.capacity);
  const set = (h: Partial<NonNullable<UiToolState['hull']>>) => api.setTool({ tool: 'build', build: 'hull', hull: { ...hull, note: '', ...h } });
  const narrow = $derived(plan?.bad.length ?? 0);
</script>

<div class="planbar" data-testid="hull-plan-bar">
  <b class="t">Hull plan</b>
  <div class="seg" role="group" aria-label="Brush">
    <button class:on={hull.brush === 'rect'} onclick={() => set({ brush: 'rect' })} title="Drag a rectangle (at least 3 × 3)" data-testid="hull-rect">Rectangle</button>
    <button class:on={hull.brush === 'line'} onclick={() => set({ brush: 'line' })} title="Drag a straight line (0, 45 or 90°): what it cuts off from the ship is dropped, and the line becomes the edge" data-testid="hull-line">Line cut</button>
  </div>
  <div class="seg" role="group" aria-label="Plan mode">
    <button class:on={!hull.erase && hull.brush === 'rect'} disabled={hull.brush === 'line'} onclick={() => set({ erase: false })} data-testid="hull-add">Add</button>
    <button class:on={hull.erase && hull.brush === 'rect'} disabled={hull.brush === 'line'} onclick={() => set({ erase: true })} title="Takes planned tiles out; real hull stays" data-testid="hull-erase">Erase</button>
  </div>
  <div class="seg" role="group" aria-label="Mirror">
    <button class:on={hull.mirror} onclick={() => set({ mirror: !hull.mirror })} title="Repeat every stroke on the other side of the ship's long axis" aria-pressed={hull.mirror} data-testid="hull-mirror">Mirror</button>
    <button disabled={!plan?.tiles.length} onclick={() => plan && api.dispatch({ type: 'hull.plan', ship: plan.ship, tiles: [] })} data-testid="hull-clear">Clear</button>
  </div>
  {#if plan}
    <span class="s" data-testid="hull-plan-tiles">{plan.tiles.length} tiles planned</span>
    <span class="s" class:bad={over} data-testid="hull-plan-hull">Size {plan.hull.now}{plan.tiles.length ? ` → ${plan.hull.afterAll}` : ''} / {plan.hull.capacity}</span>
    {#if narrow}<span class="s bad" data-testid="hull-plan-narrow">{narrow} tiles narrower than 3: widen them or take them out</span>
    {:else if hull.note}<span class="s bad" data-testid="hull-plan-note">{hull.note}</span>{/if}
    {#if over}<span class="s bad" data-testid="hull-plan-over">Over what the engines carry</span>{/if}
    {#if plan.loose.length}<span class="s dim">{plan.loose.length} not touching the ship yet</span>{/if}
  {/if}
</div>

<style>
  .planbar { position: fixed; z-index: 4; left: 50%; transform: translateX(-50%); bottom: calc(8px + var(--sab) + 52px); display: flex; align-items: center; gap: 12px; padding: 6px 10px; background: rgba(4, 4, 4, 0.97); border: 1px solid var(--amber); font-size: 13px; color: #c8c8c8; }
  .t { white-space: nowrap; color: var(--amber); font: 600 13px var(--head-font); letter-spacing: 0.08em; text-transform: uppercase; }
  .seg { display: flex; gap: 3px; }
  .seg button { flex: none; white-space: nowrap; min-height: 26px; height: 26px; padding: 0 10px; font: 600 12px var(--head-font); letter-spacing: 0.05em; text-transform: uppercase; }
  .seg button.on { border-color: var(--amber); background: var(--amber); color: #1a1204; }
  .seg button:disabled { opacity: 0.4; }
  .s { white-space: nowrap; }
  .bad { color: #ff9a9a; }
  .dim { color: #8a8a8a; }
</style>
