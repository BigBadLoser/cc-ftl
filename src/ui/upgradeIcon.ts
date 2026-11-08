import type { FILES } from './tablerIcons';

type IconName = keyof typeof FILES;

/** The line icon for each weapon-upgrade item, used by the small row markers (enemy card, weapon cards). The full item sprite stays in the inspector slots. */
const UPGRADE_ICONS: Record<string, IconName> = {
  'item.upg_capacitor': 'bolt', // charge time
  'item.upg_coolant': 'snowflake', // heat
  'item.upg_housing': 'shield', // module toughness
  'item.upg_prism': 'diamond', // split shots
  'item.upg_focus': 'target', // one focused beam
  'item.upg_frag': 'bomb', // blast
  'item.upg_rail': 'arrow-big-right-lines', // fast slug
  'item.upg_nuke': 'radioactive', // warhead
  'item.upg_chain': 'sparkles', // lightning
  'item.upg_thermite': 'fire', // burns
};

export function upgradeIconName(item: string): IconName {
  return UPGRADE_ICONS[item] ?? 'bolt';
}
