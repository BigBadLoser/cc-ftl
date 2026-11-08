<script lang="ts">
  import { ACTION_BY_ID, keyLabel, keymap, type ActionId } from '../keymap';
  import KeyBadge from './KeyBadge.svelte';
  import { TIP_ID, tipState } from './tip';
  import { settings } from '../settings/settings';

  /** Draws the one game tooltip that `use:tip` asks for. Mount once, high in the app. */
  const GAP = 6, PAD = 8;
  let box = $state<HTMLDivElement>();
  /** The host's size, bound (Svelte observes it), so a new tip's content is measured after it renders and the position follows. */
  let bw = $state(0), bh = $state(0);
  // The Tooltips setting hides a tip already on screen too, not only the next one.
  const s = $derived($settings.tooltips ? $tipState : null);
  const key = $derived(!s?.spec.key ? '' : ACTION_BY_ID.has(s.spec.key) ? keyLabel($keymap, s.spec.key as ActionId) : s.spec.key);
  const pos = $derived.by(() => {
    if (!s) return null;
    const w = bw, h = bh, r = s.rect;
    const side = s.spec.side ?? 'bottom';
    const flip = side === 'bottom' && r.bottom + GAP + h > innerHeight - PAD ? 'top' : side === 'top' && r.top - GAP - h < PAD ? 'bottom' : side;
    // A side tip that would cross the screen edge opens on the other side instead of sliding over its trigger.
    const hside = side === 'left' && r.left - GAP - w < PAD ? 'right' : side === 'right' && r.right + GAP + w > innerWidth - PAD ? 'left' : side;
    let x = hside === 'left' ? r.left - GAP - w : hside === 'right' ? r.right + GAP : r.left + r.width / 2 - w / 2;
    let y = flip === 'top' ? r.top - GAP - h : flip === 'bottom' ? r.bottom + GAP : r.top + r.height / 2 - h / 2;
    x = Math.max(PAD, Math.min(x, innerWidth - PAD - w)); y = Math.max(PAD, Math.min(y, innerHeight - PAD - h));
    return { x, y };
  });
</script>

{#if s}
  <div id={TIP_ID} class="kit-tip tip-host" class:rich={!!s.spec.rich} role="tooltip" bind:this={box} bind:offsetWidth={bw} bind:offsetHeight={bh} style:left="{pos?.x ?? 0}px" style:top="{pos?.y ?? 0}px" style:visibility={pos && box && bw ? 'visible' : 'hidden'}>
    {#if s.spec.rich}{@render s.spec.rich()}{:else}<span>{s.spec.text}</span>{/if}{#if key}<KeyBadge size="sm">{key}</KeyBadge>{/if}
  </div>
{/if}

<style>
  .tip-host { position: fixed; display: flex; align-items: center; gap: 8px; width: max-content; z-index: 60; max-width: min(260px, calc(100vw - 16px)); padding: 4px 8px; background: var(--panel-2); border: 1px solid var(--line-hi); color: var(--text); font-size: 12px; line-height: 1.35; white-space: pre-line; pointer-events: none; }
  .tip-host.rich { max-width: none; padding: 0; background: none; border: 0; white-space: normal; }
</style>
