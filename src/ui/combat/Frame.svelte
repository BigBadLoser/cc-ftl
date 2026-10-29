<script lang="ts">
  import type { Snippet } from 'svelte';

  /**
   * A titled frame: a thin border whose top edge is built from segments (line, title, line, optional right-end pieces, line), so the break around the title
   * is a real gap and works over a transparent panel. `right` renders extra pieces into the top edge; separate them with `<i class="ln"></i>` (a line stretch).
   */
  let { title, tone = 'cool', style = '', testid, children, right }: {
    title: string; tone?: 'cool' | 'red'; style?: string; testid?: string; children: Snippet; right?: Snippet;
  } = $props();
</script>

<section class="frame {tone}" {style} data-testid={testid}>
  <div class="rail"><i class="ln" style="width:9px"></i><h3>{title}</h3><i class="ln grow"></i>{#if right}{@render right()}<i class="ln" style="width:12px"></i>{/if}</div>
  {@render children()}
</section>

<style>
  .frame { --edge: rgba(90, 140, 175, 0.38); position: relative; box-sizing: border-box; min-width: 0; min-height: 0; padding: 12px 8px 8px; border: 1px solid var(--edge); border-top: 0; display: flex; flex-direction: column; }
  .frame.red { --edge: #b8343c; }
  /* The top edge: 13px tall so its 1px lines sit exactly on the box's top edge (y 0 to 1), flush with the side borders. */
  .rail { position: absolute; left: -1px; right: -1px; top: -6px; height: 13px; display: flex; align-items: center; pointer-events: none; }
  .rail > :global(.ln) { display: block; flex: none; height: 1px; background: var(--edge); }
  .rail > :global(.ln.grow) { flex: 1 1 0; min-width: 6px; }
  .rail > :global(*) { pointer-events: auto; }
  h3 { margin: 0; padding: 0 5px; flex: none; font: 600 12px/13px var(--head-font); letter-spacing: 0.08em; text-transform: uppercase; color: var(--dim); white-space: nowrap; text-shadow: 0 0 3px #000, 0 0 3px #000; }
  .red h3 { font: 700 18px/13px var(--head-font); color: #ff8a8a; }
</style>
