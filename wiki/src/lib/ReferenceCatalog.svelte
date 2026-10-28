<script lang="ts">
  import { resolve } from '$app/paths';
  import generated from '../data/generated/reference-catalog.json';

  type Kind = keyof typeof generated;
  let { kind }: { kind: Kind } = $props();

  const paths: Record<Kind, string> = {
    modules: resolve('reference/modules/'),
    items: resolve('reference/items/'),
    weapons: resolve('reference/weapons/'),
    vehicles: resolve('reference/vehicles/'),
    recipes: resolve('reference/recipes/'),
    factions: resolve('reference/factions/'),
    research: resolve('reference/research/'),
  };
  const entries = $derived([...generated[kind]].sort((a, b) => a.name.localeCompare(b.name)));
  let selectedCategory = $state('All');
  const categories = $derived(
    ['All', ...new Set(entries.map((entry) => entry.category).filter((v): v is string => Boolean(v)))].sort(
      (a, b) => a === 'All' ? -1 : b === 'All' ? 1 : a.localeCompare(b)
    )
  );
  const visible = $derived(
    selectedCategory === 'All' ? entries : entries.filter((e) => e.category === selectedCategory)
  );
  const formatCategory = (value: string) =>
    value === 'All' ? value : value.replace(/\b\w/g, (letter) => letter.toUpperCase());
  const showArtwork = $derived(['weapons', 'vehicles', 'research'].includes(kind));
</script>

{#if categories.length > 2}
  <div class="wiki-reference-tabs" role="group" aria-label="Reference categories">
    {#each categories as name (name)}
      <button type="button" class:active={selectedCategory === name}
        aria-pressed={selectedCategory === name}
        onclick={() => selectedCategory = name}>{formatCategory(name)}</button>
    {/each}
  </div>
{/if}

<p class="wiki-category-summary" aria-live="polite">
  {visible.length} {visible.length === 1 ? 'entry' : 'entries'}
</p>

<div class:wiki-recipe-grid={kind === 'recipes'} class="wiki-reference-grid"
  class:wiki-reference-with-art={showArtwork}>
  {#each visible as item (item.id)}
    <a class="wiki-reference-card" href={paths[kind] + item.slug + '/'}>
      {#if showArtwork && item.image}
        <div class="wiki-reference-art">
          <img src={item.image} loading="lazy" width="300" height="190" alt="" />
        </div>
      {/if}
      <div class="wiki-reference-info">
        <strong class="wiki-reference-title">{item.name}</strong>
        <span class="wiki-reference-subtitle">{item.subtitle}</span>
        {#if kind === 'recipes' && item.inputs && item.outputs}
          <div class="wiki-recipe-flow" aria-label="Recipe">
            <div><small>Inputs</small><span>{item.inputs}</span></div>
            <span class="wiki-recipe-arrow" aria-hidden="true">→</span>
            <div><small>Outputs</small><span>{item.outputs}</span></div>
          </div>
        {/if}
        {#if item.facts.length}
          <dl class="wiki-reference-facts">
            {#each item.facts as [name,value] (name)}
              <div><dt>{name}</dt><dd>{value}</dd></div>
            {/each}
          </dl>
        {/if}
      </div>
    </a>
  {/each}
</div>
