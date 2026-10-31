import type { Component } from 'svelte';
import type { TABLER } from '../tablerIcons';

type IconName = keyof typeof TABLER;

/**
 * One tab of the tabbed inspector (TabbedInspector.svelte). A selection type (crew, module...) supplies a list of these and
 * the props every tab component gets. A tab with `inline` draws inside the inspector (the first one is the default, the
 * Overview); a tab with `expanded` opens the larger panel beside the inspector. A tab may have both.
 */
export interface InspectorTab<P extends Record<string, unknown>> {
  id: string;
  label: string;
  icon: IconName;
  inline?: Component<P>;
  expanded?: Component<P>;
}
