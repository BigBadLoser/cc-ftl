<script lang="ts">
  import type { Snippet } from 'svelte';
  import FrameGap from './FrameGap.svelte';

  /**
   * A titled frame: a thin border whose top edge is built from segments (line, title, line, optional right-hand items, line), so the break
   * around the title is a real gap and works over a transparent panel. `right` renders items (a Pill, a button) into the top edge: put a
   * `<FrameGap width={n} />` between them. `tone="hostile"` is the red frame with a large title.
   */
  let { title, tone = 'normal', style = '', testid, lesson, notch, children, head, right }: {
    title: string;
    tone?: 'normal' | 'hostile';
    style?: string;
    testid?: string;
    /** A `data-lesson` anchor (ui/lessons/anchors.ts) a tutorial step can point at. */
    lesson?: string;
    children: Snippet;
    /** Replaces the title text in the top edge (a title in two tones). */
    head?: Snippet;
    /** A real break in the left border, `top` px down from the top edge and `height` px tall (a portrait sits in it). */
    notch?: { top: number; height: number };
    right?: Snippet;
  } = $props();
</script>

<section class="frame {tone}" class:notched={!!notch} {style} data-testid={testid} data-lesson={lesson}>
  {#if notch}
    <i class="side" style:top="0" style:height="{notch.top}px"></i>
    <i class="side" style:top="{notch.top + notch.height}px" style:bottom="0"></i>
  {/if}
  <div class="rail">
    <FrameGap width={9} />
    <h3>{#if head}{@render head()}{:else}{title}{/if}</h3>
    <FrameGap grow />
    {#if right}
      {@render right()}
      <FrameGap width={12} />
    {/if}
  </div>
  {@render children()}
</section>

<style>
  .frame {
    --edge: var(--frame-line);
    position: relative;
    box-sizing: border-box;
    min-width: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
    padding: var(--sp-3) var(--sp-2) var(--sp-2);
    border: var(--frame-w) solid var(--edge);
    border-top: 0;
  }
  /* The left border as two segments around the notch: the side stays transparent (same geometry), nothing is painted over the gap. */
  .frame.notched {
    border-left-color: transparent;
  }
  .side {
    position: absolute;
    left: calc(-1 * var(--frame-w));
    width: var(--frame-w);
    background: var(--edge);
    pointer-events: none;
  }
  .frame.hostile {
    --edge: var(--hostile-line);
  }
  /* The top edge is 13px tall so its 1px lines sit exactly on the box's top edge, flush with the side borders. */
  .rail {
    position: absolute;
    left: -1px;
    right: -1px;
    top: -6px;
    height: 13px;
    display: flex;
    align-items: center;
    pointer-events: none;
  }
  .rail > :global(*) {
    pointer-events: auto;
  }
  h3 {
    margin: 0;
    padding: 0 5px;
    flex: none;
    font: 600 12px/13px var(--head-font);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--dim);
    white-space: nowrap;
    text-shadow: 0 0 3px #000, 0 0 3px #000;
  }
  .hostile h3 {
    font: 700 18px/13px var(--head-font);
    color: var(--hostile);
  }
</style>
