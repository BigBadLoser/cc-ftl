<script lang="ts">
  import { Slider } from 'bits-ui';

  /** A single-value slider with a 40px touch target. `onChange` fires while dragging; `onCommit` on release. */
  let { value, onChange, onCommit, min = 0, max = 100, step = 1, label = 'Value', testId, disabled = false }: {
    value: number; onChange: (v: number) => void; onCommit?: (v: number) => void; min?: number; max?: number; step?: number; label?: string; testId?: string; disabled?: boolean;
  } = $props();
</script>

<Slider.Root type="single" {value} onValueChange={(v) => onChange(v)} onValueCommit={(v) => onCommit?.(v)} {min} {max} {step} {disabled} class="kit-slider" data-testid={testId}>
  <span class="track"><Slider.Range class="kit-slider-range" /></span>
  <Slider.Thumb index={0} class="kit-slider-thumb" aria-label={label} />
</Slider.Root>

<style>
  :global(.kit-slider) { position: relative; display: flex; align-items: center; width: 100%; min-height: 40px; touch-action: none; -webkit-user-select: none; user-select: none; }
  :global(.kit-slider) .track { position: relative; flex: 1; height: 6px; background: #061020; border: 1px solid var(--line); overflow: hidden; }
  :global(.kit-slider-range) { position: absolute; height: 100%; background: var(--cyan); }
  :global(.kit-slider-thumb) { display: block; width: 14px; height: 24px; background: var(--panel-3); border: 2px solid var(--cyan); border-radius: 0; cursor: grab; }
  :global(.kit-slider-thumb:hover) { background: var(--cyan); }
  :global(.kit-slider-thumb:focus-visible) { outline: 2px solid var(--focus); outline-offset: 2px; }
  :global(.kit-slider[data-disabled]) { opacity: 0.4; }
</style>
