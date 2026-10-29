<script lang="ts">
  import type { Snippet } from 'svelte';

  // Marks behaviour that is designed or partly built but not in the game yet. Keeping every such note in this one
  // component means they can be listed or removed together.
  let { children }: { children: Snippet } = $props();
</script>

<aside class="wiki-coming-later">
  <strong>Coming later</strong>
  <div>{@render children()}</div>
</aside>

<style>
  .wiki-coming-later {
    margin: 1rem 0;
    padding: .7rem .95rem;
    border: 1px dashed #c9a34a;
    border-radius: .5rem;
    background: rgba(201, 163, 74, .08);
  }
  .wiki-coming-later strong {
    display: block;
    font-size: .72rem;
    letter-spacing: .06em;
    text-transform: uppercase;
    color: #d8b25a;
    margin-bottom: .2rem;
  }
  .wiki-coming-later div :global(p) { margin: 0; }
</style>
