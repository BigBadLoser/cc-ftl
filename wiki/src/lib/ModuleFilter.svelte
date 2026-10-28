<script lang="ts">
  import { resolve } from '$app/paths';
  import modules from '../data/generated/modules.json';

  let category = $state('all');
  const categories = ['all', ...new Set(modules.map((module) => module.category))].sort((a, b) =>
    a === 'all' ? -1 : b === 'all' ? 1 : a.localeCompare(b)
  );
  const filtered = $derived(
    category === 'all' ? modules : modules.filter((module) => module.category === category)
  );

  function labelFor(value: string): string {
    return value === 'all' ? 'All' : value.replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function countFor(value: string): number {
    return value === 'all' ? modules.length : modules.filter((module) => module.category === value).length;
  }
</script>

<div class="wiki-category-tabs" role="group" aria-label="Module categories">
  {#each categories as option (option)}
    <button
      type="button"
      class:active={category === option}
      aria-pressed={category === option}
      onclick={() => (category = option)}
    >
      <span>{labelFor(option)}</span>
      <span class="wiki-category-count" aria-hidden="true">{countFor(option)}</span>
    </button>
  {/each}
</div>
<p class="wiki-category-summary" aria-live="polite">{filtered.length} {filtered.length === 1 ? 'module' : 'modules'}</p>
<ul class="wiki-ref-list">
  {#each filtered as module (module.id)}
    <li class="wiki-ref-entry">
      {#if module.image}
        <img class="wiki-ref-thumb" src={module.image} alt="" loading="lazy" width="78" height="60" />
      {/if}
      <div>
        <a href={resolve('reference/modules/') + module.slug + '/'}>{module.name}</a>
        <small>{module.category} · {module.footprint[0]}×{module.footprint[1]} tiles · {module.power > 0 ? '+' : ''}{module.power} power</small>
      </div>
    </li>
  {/each}
</ul>
