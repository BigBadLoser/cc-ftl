<script lang="ts" module>
  import { TABLER } from './tablerIcons';
  /** Line icons: Tabler Icons (outline, MIT) on a 24-unit grid; see tablerIcons.ts for the name -> Tabler file mapping. */
  export const ICONS = TABLER;
  export type IconName = keyof typeof ICONS;
</script>

<script lang="ts">
  let { name, size = 18, title }: { name: IconName; size?: number; title?: string } = $props();
</script>

<svg class="icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden={title ? undefined : 'true'} role={title ? 'img' : undefined}>
  {#if title}<title>{title}</title>{/if}
  <!-- eslint-disable-next-line svelte/no-at-html-tags -- static markup from the bundled Tabler SVG files, never user input -->
  {@html ICONS[name]}
</svg>

<style>
  .icon { display: block; flex: none; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
</style>
