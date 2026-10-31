import type { UiStatPart } from '../crewDetailApi';

/** "+2" / "−1" for points, "x1.15" for factors (a real minus sign). */
export function partText(p: Pick<UiStatPart, 'op' | 'value'>): string {
  if (p.op === 'mul') return `x${Math.round(p.value * 100) / 100}`;
  return `${p.value >= 0 ? '+' : '−'}${Math.abs(p.value)}`;
}

/** Whether a term helps (more points, a factor above 1); `restDecay` is the one stat where more is worse. */
export function partGood(p: Pick<UiStatPart, 'op' | 'value'>, invert = false): boolean {
  const up = p.op === 'mul' ? p.value > 1 : p.value > 0;
  return invert ? !up : up;
}

export const moodWord = (v: number): string => (v < 20 ? 'miserable' : v < 35 ? 'unhappy' : v < 65 ? 'content' : 'happy');

/** Signed points with a real minus sign. */
export const signed = (v: number): string => `${v >= 0 ? '+' : '−'}${Math.abs(v)}`;

/** The inspector tabs that open the expanded view. */
export type DetailTab = 'status' | 'skills' | 'gear';

/** Bar colours of the breakdown kinds (skills tab). */
export const PART_COLOR: Record<UiStatPart['kind'], string> = { rolled: '#9aa3ab', xp: 'var(--cyan)', trait: 'var(--green)', gear: 'var(--amber)', state: 'var(--amber)', env: 'var(--amber)' };
