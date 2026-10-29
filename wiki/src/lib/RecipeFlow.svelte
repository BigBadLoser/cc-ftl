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
    <!-- One SVG draws the whole arrow. It fills the rest of the input
         cell and reaches into the arrow column; the head is pinned to its
         right edge by a nested SVG at x=100%, so the line can stretch
         without scaling the stroke. -->
    <svg class="recipe-arrow" height="32" fill="none"
      aria-hidden="true" focusable="false">
      <g stroke="currentColor" stroke-width="1.5"
        stroke-linecap="round" stroke-linejoin="round">
        <line x1="0.75" y1="16" x2="100%" y2="16" />
        <svg x="100%" y="16" overflow="visible">
          <path d="M-5 -5 L0 0 L-5 5" />
        </svg>
      </g>
    </svg>
  </div>

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
  .recipe-arrow {
    flex: 1 1 0;
    min-width: 0;
    height: 32px;
    margin-left: .35rem;
    /* Into the 24px arrow column, stopping 5px short of the outputs. */
    margin-right: -19px;
    overflow: visible;
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
