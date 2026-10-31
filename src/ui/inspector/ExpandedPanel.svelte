<script lang="ts">
  import { onMount, type Snippet } from 'svelte';
  import FloatingWindow from '../FloatingWindow.svelte';
  import type { Bounds, DefaultRect } from '../floatingWindow';
  import type { IconName } from '../Icon.svelte';

  /**
   * The inspector's expanded panel: a floating window that opens beside the inspector (to its right, hanging from the
   * bottom like it). It moves, resizes and pins like any floating window; its spot is remembered for every tab.
   */
  let { title, icon, onClose, children }: { title: string; icon: IconName; onClose: () => void; children: Snippet } = $props();
  let beside = $state(316);
  const place = () => {
    const r = document.querySelector('[data-testid="selection-panel"]')?.getBoundingClientRect();
    if (r) beside = r.right + 6;
  };
  onMount(() => {
    place();
    addEventListener('resize', place);
    return () => removeEventListener('resize', place);
  });
  const rect = (b: Bounds): DefaultRect => ({ x: Math.max(b.left, beside), y: b.top, w: 480, h: 0, anchor: 'bottom' });
</script>

<FloatingWindow id="inspector-expanded" {title} {icon} min={{ w: 380, h: 200 }} defaultRect={rect} {onClose} testId="inspector-expanded" padded z={7}>
  {@render children()}
</FloatingWindow>
