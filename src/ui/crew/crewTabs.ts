import type { UiApi, UiCrew } from '../api';
import type { UiCrewDetail } from '../crewDetailApi';
import type { InspectorTab } from '../inspector/tabs';
import CrewOverview from './CrewOverview.svelte';
import StatusTab from './StatusTab.svelte';
import SkillsTab from './SkillsTab.svelte';
import GearTab from './GearTab.svelte';

/** What every crew tab component gets. `d` is the detail snapshot (null for a moment after the selection changes). */
export type CrewTabProps = { api: UiApi; c: UiCrew; d: UiCrewDetail | null; onPriorities: () => void };

/** The player's crew in the tabbed inspector: the Overview inline, Status, Skills and Gear in the expanded panel. */
export const crewTabs: InspectorTab<CrewTabProps>[] = [
  { id: 'overview', label: 'Overview', icon: 'person', inline: CrewOverview },
  { id: 'status', label: 'Status', icon: 'heart', expanded: StatusTab },
  { id: 'skills', label: 'Skills', icon: 'list', expanded: SkillsTab },
  { id: 'gear', label: 'Gear', icon: 'stock', expanded: GearTab },
];
