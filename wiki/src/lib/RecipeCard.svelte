<script lang="ts">
  import { resolve } from '$app/paths';
  import RecipeFlow from './RecipeFlow.svelte';
  import type { CatalogEntry } from './reference-types';

  let { recipe, showStation = true }: { recipe: CatalogEntry; showStation?: boolean } = $props();
  const work = $derived(recipe.facts.find(([name]) => name === 'Work')?.[1]);
  const stationName = $derived(recipe.facts.find(([name]) => name === 'Station')?.[1] ?? recipe.station);
</script>

<article class="wiki-reference-card wiki-recipe-card wiki-cut-card">
  <div class="wiki-recipe-heading wiki-cut-title wiki-cut-rail">
    <strong class="wiki-reference-title">
      <a href={resolve('reference/recipes/') + recipe.slug + '/'}>{recipe.name}</a>
    </strong>
    {#if work}<i class="wiki-cut-gap"></i><span class="wiki-recipe-work" title="Production work">{work} work</span>{/if}
  </div>
  {#if showStation && recipe.stationSlug}
    <span class="wiki-recipe-station">
      <a href={resolve('reference/modules/') + recipe.stationSlug + '/'}>{stationName}</a>
    </span>
  {/if}
  <RecipeFlow name={recipe.name} inputs={recipe.inputs ?? []} outputs={recipe.outputs ?? []} />
</article>
