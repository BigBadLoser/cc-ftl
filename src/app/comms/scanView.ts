import type { Callout, ReadoutRow } from '../../ui/comms/types';

/**
 * The adapter from scan readings (label and value rows, as `ambushRows` and the trader and derelict scans produce) to the sensor panel's two parts:
 * rows that name a part of the ship become callouts (`id` is the anchor kind the hologram pins them to), the rest a label-over-value readout. The
 * Transponder row is wide. `alts` gives a label a second value to flicker to.
 */
export type CalloutSpec = Pick<Callout, 'id' | 'label' | 'value'>;

const PARTS: Record<string, string> = { Weapons: 'weapons', 'Boarding craft': 'boarding' };

export function scanView(rows: readonly { label: string; value: string }[], alts: Record<string, string> = {}): { callouts: CalloutSpec[]; readout: ReadoutRow[] } {
  const callouts: CalloutSpec[] = [];
  const readout: ReadoutRow[] = [];
  for (const r of rows) {
    const part = PARTS[r.label];
    if (part) callouts.push({ id: part, label: r.label, value: r.value });
    else readout.push({ label: r.label, value: r.value, ...(alts[r.label] ? { alt: alts[r.label] } : {}), ...(r.label === 'Transponder' || r.value.length > 18 ? { wide: true } : {}) });
  }
  return { callouts, readout };
}
