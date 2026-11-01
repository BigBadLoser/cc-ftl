import type { UiApi, UiCrew } from '../api';
import type { UiCrewDetail } from '../crewDetailApi';
import type { InspectorTab } from '../inspector/tabs';
import CrewOverview from './CrewOverview.svelte';
import StatusTab from './StatusTab.svelte';
import SkillsTab from './SkillsTab.svelte';
import GearTab from './GearTab.svelte';

/** What every crew tab component gets. `d` is the detail snapshot (null for a moment after the selection changes). */
export type CrewTabProps = { api: UiApi; c: UiCrew; d: UiCrewDetail | null; onPriorities: () => void };

/** The player's crew in the tabbed inspector: the Overview (the inspector's own width), then Status and Skills (380px) and Gear (480px, the paper doll). */
export const crewTabs: InspectorTab<CrewTabProps>[] = [
  { id: 'overview', label: 'Overview', icon: 'person', component: CrewOverview },
  { id: 'status', label: 'Status', icon: 'heart', component: StatusTab, width: 380 },
  { id: 'skills', label: 'Skills', icon: 'list', component: SkillsTab, width: 380 },
  { id: 'gear', label: 'Gear', icon: 'stock', component: GearTab, width: 480 },
];
