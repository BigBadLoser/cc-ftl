import { OVERLAY_DEFS, overlayDef, rampAt } from '../render/overlayDefs';
import type { UiLegend } from '../ui/api';

const css = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

export const overlayList = OVERLAY_DEFS.map((d) => ({ id: d.id, label: d.label }));

/** Legend chip data for an overlay: ramp colours and min/max labels with units. */
export function overlayLegend(id: string): UiLegend | null {
  const d = overlayDef(id);
  if (!d) return null;
  if (d.special === 'power') return { label: 'Power', minLabel: 'No power', maxLabel: 'Powered', gradient: [css(0xe5322d), css(0x4cd964)] };
  if (d.special === 'room') return { label: 'Rooms', minLabel: 'each room', maxLabel: 'own colour', gradient: ['#3a6bff', '#f0c030', '#d946ef', '#22d3ee'] };
  const u = d.unit ? ` ${d.unit}` : '';
  const grad = [0, 0.25, 0.5, 0.75, 1].map((t) => css(rampAt(d, d.min + (d.max - d.min) * t)));
  return { label: d.label, minLabel: `${d.min}${u}`, maxLabel: `${d.max}${u}`, gradient: grad };
}
