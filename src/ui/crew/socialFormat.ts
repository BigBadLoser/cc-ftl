import { writable } from 'svelte/store';

/** "12 m ago", "2 h ago": the age of a bond reason, from game seconds. */
export function ago(sec: number): string {
  if (sec < 60) return 'just now';
  if (sec < 3600) return `${Math.floor(sec / 60)} m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} h ago`;
  return `${Math.floor(sec / 86400)} d ago`;
}

/** The signed number for a hover: "+62", "−30", "0". */
export const signed = (n: number): string => (n === 0 ? '0' : `${n < 0 ? '−' : '+'}${Math.abs(n)}`);

export type SocialSection = 'friends' | 'rivals' | 'crew';
/** Which sections are folded: UI state for the session only (not saved, not in the sim). */
export const folded = writable<Record<SocialSection, boolean>>({ friends: false, rivals: false, crew: true });
export const toggleSection = (s: SocialSection): void => folded.update((f) => ({ ...f, [s]: !f[s] }));
