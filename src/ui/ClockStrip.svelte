<script lang="ts">
  import { onMount } from 'svelte';
  import { tip } from './kit';
  import type { UiApi, UiCrew } from './api';
  import { coverage, coverTone } from './schedule';

  /** The HUD clock's strip (#412): per hour of the day, how many crew are on Work (red nobody, amber one); past hours fade, the current one is outlined. */
  let { api }: { api: UiApi } = $props();
  let crew = $state<UiCrew[]>([]);
  let hour = $state(0);
  onMount(() => {
    const offs = [api.crew.subscribe((v) => (crew = v)), api.snapshot.subscribe((s) => (hour = s.clock.hour))];
    return () => offs.forEach((f) => f());
  });
  const cover = $derived(coverage(crew.filter((c) => c.schedule && !c.dead).map((c) => c.schedule!.hours)));
  const gaps = $derived(cover.flatMap((n, h) => (n === 0 ? [`${String(h).padStart(2, '0')}:00`] : [])));
  const text = $derived(gaps.length ? `Nobody on Work at ${gaps.length > 4 ? `${gaps.length} hours of the day` : gaps.join(', ')}` : 'Crew on Work, hour by hour');
</script>

<div class="strip" use:tip={{ text }} data-testid="clock-strip">
  <div class="bar">{#each cover as n, h (h)}<i class={coverTone(n)} class:past={h < hour} class:now={h === hour}></i>{/each}</div>
  <div class="ax"><span>00</span><span>06</span><span>12</span><span>18</span><span>24</span></div>
</div>

<style>
  .strip { padding: 0 8px 6px; }
  .bar { display: flex; gap: 1px; }
  i { flex: 1; height: 7px; background: #4a7fb8; }
  i.one { background: var(--amber); }
  i.none { background: var(--red); }
  i.past { opacity: 0.45; }
  i.now { outline: 1px solid #fff; outline-offset: 1px; position: relative; z-index: 1; }
  .ax { display: flex; justify-content: space-between; font-size: 10px; color: var(--dim); margin-top: 3px; }
</style>
