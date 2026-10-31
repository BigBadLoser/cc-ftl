import type { UiApi, UiFtl, UiModule } from '../api';
import type { InspectorTab } from '../inspector/tabs';
import ModuleOverview from './ModuleOverview.svelte';
import ModuleCondition from './ModuleCondition.svelte';

/** What every module tab component gets. */
export type ModuleTabProps = { api: UiApi; m: UiModule; ftl: UiFtl | null; onResearch?: () => void; onPower: () => void };

/** A module in the tabbed inspector: the Overview inline, its condition in the expanded panel. */
export const moduleTabs: InspectorTab<ModuleTabProps>[] = [
  { id: 'overview', label: 'Overview', icon: 'module', inline: ModuleOverview },
  { id: 'condition', label: 'Condition', icon: 'wrench', expanded: ModuleCondition },
];
