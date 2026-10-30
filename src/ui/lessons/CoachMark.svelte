<script lang="ts">
  import { Frame, KeyBadge } from '../kit';
  import { placePanel, type Rect } from '../combat/panelPlace';
  import { keyText } from './keyText';
  import type { LessonView } from './engine';
  import type { ScreenRect } from './targets';

  /**
   * One lesson step on screen: the page dims except a cut-out ring around the target (cyan when the step waits for the player to act there,
   * light steel when it only points), and a small card beside it with the text, the step count and the buttons. The dim and the ring take
   * no clicks, so the player can act on the target (or anywhere) while the card is up.
   */
  let { view, rect, obstacles, onGotIt, onDismiss }: {
    view: LessonView;
    rect: ScreenRect | null;
    /** Other anchored HUD pieces the card should not cover. */
    obstacles: Rect[];
    onGotIt: () => void;
    onDismiss: () => void;
  } = $props();

  const PAD = 6;
  const doStep = $derived(view.step.advance !== 'gotIt');
  const last = $derived(view.index + 1 >= view.lesson.steps.length);
  const ring = $derived(rect && { x0: rect.x0 - PAD, y0: rect.y0 - PAD, x1: rect.x1 + PAD, y1: rect.y1 + PAD });
  let cw = $state(0);
  let ch = $state(0);
  let vw = $state(innerWidth);
  let vh = $state(innerHeight);
  const at = $derived.by(() => {
    if (!cw || !ch) return null;
    const placed = ring ? placePanel(ring, { w: cw, h: ch }, { w: vw, h: vh }, obstacles, 14) : null;
    return placed ?? { x: (vw - cw) / 2, y: (vh - ch) / 2 };
  });
</script>

<svelte:window bind:innerWidth={vw} bind:innerHeight={vh} />

{#if ring}
  <!-- The cut-out: four dim panels around the ring (a giant box-shadow does not draw at high device scale). They take no clicks. -->
  <div class="dim" style:left="0" style:top="0" style:width="100vw" style:height="{Math.max(0, ring.y0)}px"></div>
  <div class="dim" style:left="0" style:top="{ring.y1}px" style:width="100vw" style:height="{Math.max(0, vh - ring.y1)}px"></div>
  <div class="dim" style:left="0" style:top="{ring.y0}px" style:width="{Math.max(0, ring.x0)}px" style:height="{ring.y1 - ring.y0}px"></div>
  <div class="dim" style:left="{ring.x1}px" style:top="{ring.y0}px" style:width="{Math.max(0, vw - ring.x1)}px" style:height="{ring.y1 - ring.y0}px"></div>
  <div
    class="ring"
    class:do={doStep}
    style:left="{ring.x0}px"
    style:top="{ring.y0}px"
    style:width="{ring.x1 - ring.x0}px"
    style:height="{ring.y1 - ring.y0}px"
  ></div>
{:else}
  <div class="dim all"></div>
{/if}

<div
  class="card steel"
  role="dialog"
  aria-label="{view.lesson.title}: {view.step.title}"
  data-testid="lesson-card"
  bind:offsetWidth={cw}
  bind:offsetHeight={ch}
  style:transform={at ? `translate(${Math.round(at.x)}px, ${Math.round(at.y)}px)` : undefined}
  style:visibility={at ? 'visible' : 'hidden'}
>
  <Frame title={view.lesson.title}>
    {#snippet right()}<span class="count">{view.index + 1}/{view.lesson.steps.length}</span>{/snippet}
    <div class="body">
      <h4>{view.step.title}</h4>
      <p>
        {#each keyText(view.step.text) as run, i (i)}{#if run.key}<KeyBadge tone="light" size="sm">{run.text}</KeyBadge>{:else}{run.text}{/if}{/each}
      </p>
      <div class="btns">
        <button class="quiet" data-testid="lesson-dismiss" onclick={onDismiss}>Skip lesson</button>
        <span class="grow"></span>
        {#if doStep}
          <span class="wait">Your move</span>
          <button class="quiet" data-testid="lesson-skip-step" onclick={onGotIt}>Skip step</button>
        {:else}
          <button class="interact" data-testid="lesson-next" onclick={onGotIt}>{last ? 'Done' : 'Got it'}<KeyBadge tone="dim" size="sm">Enter</KeyBadge></button>
        {/if}
      </div>
    </div>
  </Frame>
</div>

<style>
  .ring,
  .dim {
    position: fixed;
    z-index: 20;
    pointer-events: none;
  }
  .dim {
    background: rgba(2, 4, 6, 0.5);
  }
  .dim.all {
    inset: 0;
    background: rgba(2, 4, 6, 0.4);
  }
  .ring {
    box-sizing: border-box;
    border: 2px solid var(--hud-bar, #dfe4e8);
  }
  .ring.do {
    border-color: var(--cyan);
    animation: pulse 1.2s ease-in-out infinite alternate;
  }
  @keyframes pulse {
    to { outline: 6px solid rgba(54, 212, 255, 0.18); }
  }
  .card {
    position: fixed;
    left: 0;
    top: 0;
    z-index: 21;
    width: 340px;
    pointer-events: auto;
  }
  .card :global(.frame) {
    background: var(--panel);
  }
  .count {
    font: 600 13px/1 var(--head-font);
    letter-spacing: 0.05em;
    color: var(--dim);
  }
  .body {
    display: grid;
    gap: var(--sp-2);
    padding: 2px var(--sp-1) var(--sp-1);
  }
  h4 {
    margin: 0;
    font: 700 17px/1.1 var(--head-font);
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text);
  }
  p {
    margin: 0;
    font-size: 14px;
    line-height: 1.5;
    color: var(--rest, var(--text));
  }
  p :global(kbd) {
    margin: 0 1px;
  }
  .btns {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
  }
  .grow {
    flex: 1;
  }
  .btns button {
    min-height: 34px;
    display: inline-flex;
    align-items: center;
    gap: var(--sp-2);
    font: 600 14px var(--head-font);
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  .quiet {
    background: transparent;
    border-color: transparent;
    color: var(--dim);
    padding: 0 6px;
  }
  .quiet:hover {
    color: var(--text);
    border-color: var(--line);
  }
  .wait {
    font: 600 13px var(--head-font);
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--cyan);
  }
</style>
