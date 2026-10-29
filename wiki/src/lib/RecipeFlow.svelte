<script lang="ts">
  import RecipeMaterial from './RecipeMaterial.svelte';
  import type { CatalogMaterial } from './reference-types';

  let { name, inputs, outputs }: {
    name: string;
    inputs: CatalogMaterial[];
    outputs: CatalogMaterial[];
  } = $props();
</script>

<!-- Explicit grid rows share a vertical center; no absolute offsets,
     pseudo-elements, or font-dependent arrow positioning. -->
<div class="recipe-flow" aria-label={'Ingredients and outputs for ' + name}>
  <small class="recipe-input-heading">Inputs</small>
  <small class="recipe-output-heading">Outputs</small>

  <div class="recipe-first-input">
    {#if inputs[0]}
      <RecipeMaterial material={inputs[0]} />
    {/if}
    <span class="recipe-shaft" aria-hidden="true"></span>
  </div>

  <!-- Single SVG contains both the central shaft and arrowhead. Its
       horizontal midline is the first material row's vertical center. -->
  <svg class="recipe-arrow" viewBox="0 0 24 32" width="24" height="32"
    fill="none" aria-hidden="true" focusable="false">
    <path d="M0 16 H19 M14 11 L19 16 L14 21"
      stroke="currentColor" stroke-width="1.5"
      stroke-linecap="round" stroke-linejoin="round" />
  </svg>

  <div class="recipe-first-output">
    {#if outputs[0]}
      <RecipeMaterial material={outputs[0]} />
    {/if}
  </div>

  {#if inputs.length > 1}
    <ul class="recipe-extra-inputs">
      {#each inputs.slice(1) as material (material.slug)}
        <li><RecipeMaterial {material} /></li>
      {/each}
    </ul>
  {/if}
  {#if outputs.length > 1}
    <ul class="recipe-extra-outputs">
      {#each outputs.slice(1) as material (material.slug)}
        <li><RecipeMaterial {material} /></li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .recipe-flow {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 24px minmax(0, 1fr);
    column-gap: 0;
    row-gap: .22rem;
    align-items: start;
    padding: .45rem 0 0;
  }
  .recipe-input-heading, .recipe-output-heading {
    font-size: .62rem;
    line-height: 1.2;
    text-transform: uppercase;
    letter-spacing: .045em;
    color: var(--wiki-subtle);
    grid-row: 1;
  }
  .recipe-input-heading { grid-column: 1; }
  .recipe-output-heading { grid-column: 3; }
  .recipe-first-input, .recipe-first-output {
    display: flex;
    min-width: 0;
    min-height: 32px;
    align-items: center;
    grid-row: 2;
  }
  .recipe-first-input { grid-column: 1; }
  .recipe-first-output { grid-column: 3; }
  .recipe-shaft {
    flex: 1 1 auto;
    min-width: 0;
    margin-left: .35rem;
    border-top: 1.5px solid #5899cd;
  }
  .recipe-arrow {
    display: block;
    grid-column: 2;
    grid-row: 2;
    width: 24px;
    height: 32px;
    align-self: center;
    color: #5899cd;
  }
  .recipe-extra-inputs, .recipe-extra-outputs {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: .22rem;
    min-width: 0;
    grid-row: 3;
  }
  .recipe-extra-inputs { grid-column: 1; }
  .recipe-extra-outputs { grid-column: 3; }
  li { min-width: 0; }
</style>
