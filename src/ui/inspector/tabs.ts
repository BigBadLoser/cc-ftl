import type { Component } from 'svelte';
import type { TABLER } from '../tablerIcons';

type IconName = keyof typeof TABLER;

/**
 * One tab of the tabbed inspector (TabbedInspector.svelte). A selection type (crew, module...) supplies a list of these and
 * the props every tab component gets. The first tab is the default (the Overview). A tab with a `width` grows the inspector
 * window to it while open.
 */
export interface InspectorTab<P extends Record<string, unknown>> {
  id: string;
  label: string;
  icon: IconName;
  component: Component<P>;
  width?: number;
}
