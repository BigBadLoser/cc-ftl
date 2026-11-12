<script lang="ts">
  import type { Snippet } from 'svelte';
  import Frame from '../../../src/ui/kit/Frame.svelte';
  import '../data/generated/game-ui.css';

  // A real game UI component shown in a guide, in the game's own theme (scoped to .game-ui, scripts/game-ui-css.ts).
  // Feed it a typed sample (src/lib/samples/), not a running game: if the component's props change, the wiki's check fails.
  let { title, width = '300px', caption, children }: { title: string; width?: string; caption?: string; children: Snippet } = $props();
</script>

<figure class="wiki-game-panel">
  <div class="game-ui" style:width>
    <Frame {title}>{@render children()}</Frame>
  </div>
  {#if caption}<figcaption>{caption}</figcaption>{/if}
</figure>

<style>
  .wiki-game-panel { margin: 1.5rem 0; }
  .game-ui { padding: 10px; background: var(--panel); max-width: 100%; box-sizing: border-box; }
  figcaption { margin-top: 0.5rem; font-size: 0.85rem; opacity: 0.75; }
</style>
