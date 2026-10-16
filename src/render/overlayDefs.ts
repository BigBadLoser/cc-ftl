/** Field overlays: how a grid field maps to a colour, and what the legend chip shows. */
export interface OverlayDef {
  id: string;
  label: string;
  /** Unit shown in the legend ('' for none). */
  unit: string;
  min: number;
  max: number;
  /** Colour stops (hex) spread evenly from min to max. */
  stops: readonly number[];
  /** Tiles whose value is 0 are left clear. */
  hideZero?: boolean;
  /** Tiles are not coloured from a field (rooms, power). */
  special?: 'room' | 'power';
}

export const OVERLAY_DEFS: readonly OverlayDef[] = [
  { id: 'o2', label: 'O2', unit: 'kPa', min: 0, max: 21, stops: [0xd7263d, 0xf0a030, 0x2fd0e0] },
  { id: 'co2', label: 'CO2', unit: 'kPa', min: 0, max: 6, stops: [0x2a6f97, 0xe9c46a, 0xd7263d] },
  { id: 'temp', label: 'Temp', unit: '°C', min: -100, max: 100, stops: [0x3a6bff, 0x3ad0d0, 0x4cd964, 0xf0c030, 0xe5322d] },
  { id: 'fire', label: 'Fire', unit: '', min: 0, max: 255, stops: [0x7a2a00, 0xff7a1a, 0xffe03a], hideZero: true },
  { id: 'smoke', label: 'Smoke', unit: '', min: 0, max: 255, stops: [0x555a66, 0xb6bcc8, 0xf2f4f8], hideZero: true },
  { id: 'light', label: 'Light', unit: '', min: 0, max: 255, stops: [0x10143a, 0x7a62c0, 0xffe08a] },
  { id: 'power', label: 'Power', unit: '', min: 0, max: 1, stops: [0xe5322d, 0x4cd964], special: 'power' },
  { id: 'room', label: 'Rooms', unit: '', min: 0, max: 1, stops: [0x3a6bff, 0xf0c030], special: 'room' },
];

export const overlayDef = (id: string): OverlayDef | undefined => OVERLAY_DEFS.find((d) => d.id === id);

/** Colour of value v on a def's ramp. */
export function rampAt(def: OverlayDef, v: number): number {
  const t = Math.min(1, Math.max(0, (v - def.min) / (def.max - def.min || 1)));
  const n = def.stops.length - 1;
  const f = t * n;
  const i = Math.min(n - 1, Math.floor(f));
  const a = def.stops[i] as number;
  const b = def.stops[i + 1] as number;
  const u = f - i;
  const ch = (s: number) => Math.round(((a >> s) & 255) * (1 - u) + ((b >> s) & 255) * u);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}
