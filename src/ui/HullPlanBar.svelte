<script lang="ts">
  import { onMount } from 'svelte';
  import Segmented from './kit/Segmented.svelte';
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

<div class="planbar legacy build" data-testid="hull-plan-bar">
  <b class="t">Hull plan</b>
  <Segmented label="Brush" value={hull.brush} onChange={(v) => set({ brush: v as 'rect' | 'line' })} options={[
    { value: 'rect', label: 'Rectangle', title: 'Drag a rectangle (at least 3 × 3)', testId: 'hull-rect' },
    { value: 'line', label: 'Line cut', title: 'Drag a straight line (0, 45 or 90°): what it cuts off from the ship is dropped, and the line becomes the edge', testId: 'hull-line' },
  ]} />
  <Segmented label="Plan mode" value={hull.brush === 'line' ? '' : hull.erase ? 'erase' : 'add'} onChange={(v) => set({ erase: v === 'erase' })} options={[
    { value: 'add', label: 'Add', disabled: hull.brush === 'line', testId: 'hull-add' },
    { value: 'erase', label: 'Erase', disabled: hull.brush === 'line', title: 'Takes planned tiles out; real hull stays', testId: 'hull-erase' },
  ]} />
  <div class="tools">
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
  .planbar { position: fixed; z-index: 4; left: 50%; transform: translateX(-50%); bottom: calc(8px + var(--sab) + 52px); display: flex; align-items: center; gap: 12px; padding: 6px 10px; background: var(--build-bg); border: 1px solid var(--amber); font-size: 13px; color: var(--build-ink); }
  .t { white-space: nowrap; color: var(--amber); font: 600 13px var(--head-font); letter-spacing: 0.08em; text-transform: uppercase; }
  .tools { display: flex; gap: 6px; }
  .s { white-space: nowrap; }
  .bad { color: var(--red); }
  .dim { color: var(--build-dim); }
</style>
