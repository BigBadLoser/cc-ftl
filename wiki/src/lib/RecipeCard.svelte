<script lang="ts">
  import { resolve } from '$app/paths';
  import type { CatalogEntry } from './reference-types';

  let { recipe, showStation = true }: { recipe: CatalogEntry; showStation?: boolean } = $props();
  const work = $derived(recipe.facts.find(([name]) => name === 'Work')?.[1]);
  const stationName = $derived(recipe.facts.find(([name]) => name === 'Station')?.[1] ?? recipe.station);
</script>

<article class="wiki-reference-card wiki-recipe-card">
  <div class="wiki-recipe-heading">
    <strong class="wiki-reference-title">
      <a href={resolve('reference/recipes/') + recipe.slug + '/'}>{recipe.name}</a>
    </strong>
    {#if work}<span class="wiki-recipe-work" title="Production work">{work} work</span>{/if}
  </div>
  {#if showStation && recipe.stationSlug}
    <span class="wiki-recipe-station">
      <a href={resolve('reference/modules/') + recipe.stationSlug + '/'}>{stationName}</a>
    </span>
  {/if}
  <div class="wiki-recipe-flow" aria-label={'Ingredients and outputs for ' + recipe.name}>
    <div class="wiki-recipe-side">
      <small>Inputs</small>
      <ul class="wiki-recipe-materials">
        {#each recipe.inputs ?? [] as material (material.slug)}
          <li>
            <a href={resolve('reference/items/') + material.slug + '/'} title={material.name}>
              {#if material.image}
                <img src={material.image} alt="" width="32" height="32" loading="lazy" />
              {/if}
              <span class="wiki-recipe-material-label">
                <span class="wiki-recipe-material-name">{material.name}</span>
                <span class="wiki-recipe-quantity"> ×{material.count}</span>
              </span>
            </a>
          </li>
        {/each}
      </ul>
    </div>
    <span class="wiki-recipe-arrow" aria-hidden="true">→</span>
    <div class="wiki-recipe-side">
      <small>Outputs</small>
      <ul class="wiki-recipe-materials">
        {#each recipe.outputs ?? [] as material (material.slug)}
          <li>
            <a href={resolve('reference/items/') + material.slug + '/'} title={material.name}>
              {#if material.image}
                <img src={material.image} alt="" width="32" height="32" loading="lazy" />
              {/if}
              <span class="wiki-recipe-material-label">
                <span class="wiki-recipe-material-name">{material.name}</span>
                <span class="wiki-recipe-quantity"> ×{material.count}</span>
              </span>
            </a>
          </li>
        {/each}
      </ul>
    </div>
  </div>
</article>
