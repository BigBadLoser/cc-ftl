<script lang="ts">
  import { resolve } from '$app/paths';
  import type { CatalogMaterial } from './reference-types';

  let { material }: { material: CatalogMaterial } = $props();
</script>

<a class="recipe-material" href={resolve('reference/items/') + material.slug + '/'} title={material.name}>
  {#if material.image}
    <img src={material.image} alt="" width="32" height="32" loading="lazy" />
  {/if}
  <span class="recipe-material-label">
    <span class="recipe-material-name">{material.name}</span>
    <span class="recipe-material-quantity"> ×{material.count}</span>
  </span>
</a>

<style>
  .recipe-material {
    display: inline-flex;
    width: fit-content;
    max-width: 100%;
    min-height: 32px;
    align-items: center;
    gap: .3rem;
    text-decoration: none;
  }
  .recipe-material img {
    display: block;
    width: 32px;
    height: 32px;
    flex: none;
    object-fit: contain;
    image-rendering: pixelated;
  }
  .recipe-material-label {
    min-width: 0;
    line-height: 1.25;
    font-size: .8rem;
    overflow-wrap: anywhere;
  }
  .recipe-material-quantity {
    font-size: .75rem;
    font-weight: 650;
    white-space: nowrap;
    color: var(--wiki-card-color);
  }
</style>
