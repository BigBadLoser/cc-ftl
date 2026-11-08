<script lang="ts">
  import { ACTION_BY_ID, keyLabel, keymap, type ActionId } from '../keymap';
  import KeyBadge from './KeyBadge.svelte';
  import { tipState } from './tip';

  /** Draws the one game tooltip that `use:tip` asks for. Mount once, high in the app. */
  const GAP = 6, PAD = 8;
  let box = $state<HTMLDivElement>();
  const s = $derived($tipState);
  const key = $derived(!s?.spec.key ? '' : ACTION_BY_ID.has(s.spec.key) ? keyLabel($keymap, s.spec.key as ActionId) : s.spec.key);
  const pos = $derived.by(() => {
    if (!s) return null;
    const w = box?.offsetWidth ?? 0, h = box?.offsetHeight ?? 0, r = s.rect;
    const side = s.spec.side ?? 'bottom';
    const flip = side === 'bottom' && r.bottom + GAP + h > innerHeight - PAD ? 'top' : side === 'top' && r.top - GAP - h < PAD ? 'bottom' : side;
    let x = side === 'left' ? r.left - GAP - w : side === 'right' ? r.right + GAP : r.left + r.width / 2 - w / 2;
    let y = flip === 'top' ? r.top - GAP - h : flip === 'bottom' ? r.bottom + GAP : r.top + r.height / 2 - h / 2;
    x = Math.max(PAD, Math.min(x, innerWidth - PAD - w)); y = Math.max(PAD, Math.min(y, innerHeight - PAD - h));
    return { x, y };
  });
</script>

{#if s}
  <div class="kit-tip tip-host" role="tooltip" bind:this={box} style:left="{pos?.x ?? 0}px" style:top="{pos?.y ?? 0}px" style:visibility={pos && box ? 'visible' : 'hidden'}>
    <span>{s.spec.text}</span>{#if key}<KeyBadge size="sm">{key}</KeyBadge>{/if}
  </div>
{/if}

<style>
  .tip-host { position: fixed; display: flex; align-items: center; gap: 8px; width: max-content; }
</style>
