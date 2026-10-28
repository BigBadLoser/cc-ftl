<script lang="ts">
  import { resolve } from '$app/paths';
  import type { CatalogEntry } from './reference-types';

  let { recipe, showStation = true }: { recipe: CatalogEntry; showStation?: boolean } = $props();
  const facts = $derived(showStation ? recipe.facts : recipe.facts.filter(([name]) => name !== 'Station'));
</script>

<article class="wiki-reference-card wiki-recipe-card">
  <div class="wiki-reference-info">
    <strong class="wiki-reference-title">
      <a href={resolve('reference/recipes/') + recipe.slug + '/'}>{recipe.name}</a>
    </strong>
    {#if showStation && recipe.stationSlug}
      <span class="wiki-reference-subtitle">
        Produced at <a href={resolve('reference/modules/') + recipe.stationSlug + '/'}>{recipe.facts.find(([name]) => name === 'Station')?.[1] ?? recipe.station}</a>
      </span>
    {/if}
    <div class="wiki-recipe-flow" aria-label={'Ingredients and outputs for ' + recipe.name}>
      <div>
        <small>Inputs</small>
        <ul class="wiki-recipe-materials">
          {#each recipe.inputs ?? [] as material (material.slug)}
            <li><span class="wiki-recipe-quantity">{material.count}×</span><a href={resolve('reference/items/') + material.slug + '/'}>{material.name}</a></li>
          {/each}
        </ul>
      </div>
      <span class="wiki-recipe-arrow" aria-hidden="true">→</span>
      <div>
        <small>Outputs</small>
        <ul class="wiki-recipe-materials">
          {#each recipe.outputs ?? [] as material (material.slug)}
            <li><span class="wiki-recipe-quantity">{material.count}×</span><a href={resolve('reference/items/') + material.slug + '/'}>{material.name}</a></li>
          {/each}
        </ul>
      </div>
    </div>
    {#if facts.length}
      <dl class="wiki-reference-facts">
        {#each facts as [name, value] (name)}
          <div><dt>{name}</dt><dd>{value}</dd></div>
        {/each}
      </dl>
    {/if}
  </div>
</article>
