<script lang="ts">
  import { reducedMotion, startBeat } from './beat';

  /**
   * Text that now and then glitches to a second value for a few frames. Takes `value`, `alt` (null: never flickers), `every` (mean ms between
   * flickers) and `force` (hold the alt value, for stills). Under reduced motion it swaps slowly and hard, without ghosting. Knows nothing about what the two values mean.
   */
  let { value, alt = null, every = 4200, force = false }: { value: string; alt?: string | null; every?: number; force?: boolean } = $props();
  let flick = $state(false);
  // Reduced motion keeps the tell but calms it: a slow, hard swap to the alt value, held for a moment, with no ghosting.
  const calm = reducedMotion();
  $effect(() => {
    if (!alt || force) return;
    return calm ? startBeat((v) => (flick = v), 2600, [900]) : startBeat((v) => (flick = v), every);
  });
  const on = $derived(!!alt && (flick || force));
</script>

<span class="flicker" class:on class:calm data-alt={alt ?? undefined} data-ghost={on ? value : undefined}>{on ? alt : value}</span>

<style>
  .flicker { position: relative; display: inline-block; }
  /* The old value ghosts through for the frames the alt shows: a red and a cyan slice, offset. */
  .on:not(.calm)::after { content: attr(data-ghost); position: absolute; left: 2px; top: -1px; color: rgba(255, 90, 90, 0.5); clip-path: inset(30% 0 35% 0); pointer-events: none; }
  .on:not(.calm)::before { content: attr(data-ghost); position: absolute; left: -2px; top: 1px; color: rgba(54, 212, 255, 0.5); clip-path: inset(60% 0 5% 0); pointer-events: none; }
</style>
