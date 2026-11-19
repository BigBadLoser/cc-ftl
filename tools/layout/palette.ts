/** What the palette lists, in its order: the modules a design can place and the room types a room can be ([ and ] step through them). */
import { content } from '../../src/content';
import type { ModuleDef } from '../../src/sim';
import { isLamp, moduleCode, NAMES, roleTint } from '../shipgen/labels';

const css = (c: readonly number[]): string => `rgb(${c[0]},${c[1]},${c[2]})`;

/** Placeable modules by name (lamps are laid by the room, not placed). */
export const paletteModules = Object.entries(content.modules as Record<string, ModuleDef>)
  .filter(([, d]) => !isLamp(d))
  .map(([id, d]) => ({ id, name: d.name, code: moduleCode(d.name) }))
  .sort((a, b) => a.name.localeCompare(b.name));

/** Every room type the lab knows, with its colour. */
export const roomTypes = [...Object.keys(NAMES), 'hall']
  .filter((r, i, all) => all.indexOf(r) === i)
  .map((r) => ({ role: r, name: r === 'hall' ? 'corridor' : NAMES[r] ?? r, color: css(roleTint(r)) }));

/** The entry `step` places after `cur` in a list, wrapping (the first when `cur` is not in it). */
export function stepIn<T>(list: readonly T[], cur: T | null, step: number): T | undefined {
  const i = cur === null ? -1 : list.indexOf(cur);
  if (i < 0) return list[step > 0 ? 0 : list.length - 1];
  return list[(i + step + list.length) % list.length];
}
