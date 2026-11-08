import type { ComponentProps } from 'svelte';
import type Chip from './Chip.svelte';

export type ChipTone = NonNullable<ComponentProps<typeof Chip>['tone']>;

/** The colour-named tones the sim/api uses for status words (red, amber, green, cyan, dim) as chip tones. */
export function chipTone(t: string | undefined): ChipTone {
  return ({ red: 'bad', amber: 'warn', green: 'good', cyan: 'select', gold: 'gold' } as Record<string, ChipTone>)[t ?? ''] ?? 'dim';
}
