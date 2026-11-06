<script lang="ts">
  import { keyLabel, keymap } from '../keymap';
  import { anchor } from '../lessons/anchors';
  import DockTab from './DockTab.svelte';

  /** Flee with its drive charge: the dock's right-hand tab, the charge filling upward (green bar along the top when ready). */
  let { drive, onFlee }: {
    drive: { charge: number; max: number; helmManned: boolean; active: boolean };
    onFlee: () => void;
  } = $props();
  const ready = $derived(drive.charge >= drive.max && drive.active);
  const tip = $derived(
    ready
      ? `Flee: jump out of the fight, then pick where to go on the starmap (${keyLabel($keymap, 'combat.flee')})`
      : drive.helmManned
        ? `Flee: drive charging ${Math.floor(drive.charge)}/${drive.max} s (${keyLabel($keymap, 'combat.flee')})`
        : `Helm unmanned: the drive is not charging (${keyLabel($keymap, 'combat.flee')})`,
  );
</script>

<DockTab icon="fast" label="Flee" keyText={keyLabel($keymap, 'combat.flee')} {ready} disabled={!ready} fill={drive.charge / drive.max} {tip} testid="combat-flee" lesson={anchor('combat.flee')} onclick={onFlee} />
