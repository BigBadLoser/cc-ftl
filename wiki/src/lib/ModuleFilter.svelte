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
<ul class="wiki-module-grid">
  {#each filtered as module (module.id)}
    <li class="wiki-module-card">
      <a href={resolve('reference/modules/') + module.slug + '/'}>
        <div class="wiki-module-art">
          {#if module.image}
            <img src={module.image} alt="" loading="lazy" width="240" height="150" />
          {:else}
            <div class="wiki-module-art-missing" aria-hidden="true">
              <svg viewBox="0 0 92 60" width="92" height="60" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M46 8 82 29 46 50 10 29Z" stroke-dasharray="4 4"/>
                <path d="M46 8v42M10 29h72" opacity=".3"/>
              </svg>
              <small>Artwork pending</small>
            </div>
          {/if}
        </div>
        <div class="wiki-module-info">
          <strong>{module.name}</strong>
          <span>{module.footprint[0]} × {module.footprint[1]} tiles</span>
        </div>
      </a>
    </li>
  {/each}
</ul>
