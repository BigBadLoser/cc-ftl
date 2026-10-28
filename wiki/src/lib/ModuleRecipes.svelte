<script lang="ts">
  import generated from '../data/generated/reference-catalog.json';
  import RecipeCard from './RecipeCard.svelte';

  let { station }: { station: string } = $props();
  const recipes = $derived(
    [...generated.recipes]
      .filter((recipe) => recipe.station === station)
      .sort((a, b) => a.name.localeCompare(b.name))
  );
</script>

{#if recipes.length}
  <div class="wiki-reference-grid wiki-recipe-grid">
    {#each recipes as recipe (recipe.id)}
      <RecipeCard recipe={recipe} showStation={false} />
    {/each}
  </div>
{/if}
