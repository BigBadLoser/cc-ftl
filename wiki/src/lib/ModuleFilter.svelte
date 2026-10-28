<script lang="ts">
  import { resolve } from '$app/paths';
  import modules from '../data/generated/modules.json';

  let query = $state('');
  let category = $state('all');
  const categories = ['all', ...new Set(modules.map((module) => module.category))].sort();
  const filtered = $derived(modules.filter((module) =>
    (category === 'all' || module.category === category) &&
    (module.name.toLowerCase().includes(query.toLowerCase()) ||
      module.id.toLowerCase().includes(query.toLowerCase()))
  ));
</script>

<div class="wiki-ref-controls">
  <label>
    <span class="sr-only">Search modules</span>
    <input aria-label="Search modules" placeholder="Search modules…" bind:value={query} />
  </label>
  <label>
    <span class="sr-only">Filter by category</span>
    <select aria-label="Filter by category" bind:value={category}>
      {#each categories as option (option)}
        <option value={option}>{option === 'all' ? 'All categories' : option}</option>
      {/each}
    </select>
  </label>
</div>
<p aria-live="polite">{filtered.length} modules</p>
<ul class="wiki-ref-list">
  {#each filtered as module (module.id)}
    <li>
      <a href={resolve('reference/modules/' + module.slug + '/')}>{module.name}</a>
      <small>{module.category} · {module.footprint[0]}×{module.footprint[1]} tiles · {module.power > 0 ? '+' : ''}{module.power} power</small>
    </li>
  {/each}
</ul>
