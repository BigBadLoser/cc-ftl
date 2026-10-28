<script lang="ts">
  import { resolve } from '$app/paths';

  type Recipe = {
    id: string;
    slug: string;
    name: string;
    subtitle: string;
    inputs?: string;
    outputs?: string;
    facts: string[][];
  };
  let { recipe, showStation = true }: { recipe: Recipe; showStation?: boolean } = $props();
  const facts = $derived(showStation ? recipe.facts : recipe.facts.filter(([name]) => name !== 'Station'));
</script>

<a class="wiki-reference-card" href={resolve('reference/recipes/') + recipe.slug + '/'}>
  <div class="wiki-reference-info">
    <strong class="wiki-reference-title">{recipe.name}</strong>
    {#if showStation}<span class="wiki-reference-subtitle">{recipe.subtitle}</span>{/if}
    {#if recipe.inputs && recipe.outputs}
      <div class="wiki-recipe-flow" aria-label="Recipe">
        <div><small>Inputs</small><span>{recipe.inputs}</span></div>
        <span class="wiki-recipe-arrow" aria-hidden="true">→</span>
        <div><small>Outputs</small><span>{recipe.outputs}</span></div>
      </div>
    {/if}
    {#if facts.length}
      <dl class="wiki-reference-facts">
        {#each facts as [name, value] (name)}
          <div><dt>{name}</dt><dd>{value}</dd></div>
        {/each}
      </dl>
    {/if}
  </div>
</a>
