/**
 * Plain data the comms pieces take (src/ui/comms/*). Nothing here knows about signals, stories or ambushes: a caller of the pieces (the signal window
 * today; a trade hail, a station hail or an in-scene panel later) builds these from whatever it has. Adapters live in src/app/comms.
 */

export type CommsTone = 'green' | 'amber' | 'red' | 'cyan' | 'dim';

/** A request to draw a generated ship as a hologram (see app/shipHolo.ts): the generator's inputs. */
export interface UiHoloRequest {
  faction: string;
  shipgen: string;
  seed: number;
  depth: number;
  family?: string;
}

/** A ship picture (a PNG data URL cropped to the hull) and where its parts are, as fractions of the picture. */
export interface UiHolo {
  url: string;
  w: number;
  h: number;
  anchors: Record<string, { x: number; y: number }>;
}

/** One line of a transcript: narration (grey italics) or a quoted line from `speaker`, who may flicker to `speakerAlt`. */
export interface CommsLine {
  kind: 'narration' | 'speech';
  text: string;
  speaker?: string;
  speakerAlt?: string;
}

/** A label pinned to a part of a ship picture. `at` is a fraction of the picture; `corner` picks where the label sits (default: the nearest free corner). */
export interface Callout {
  id: string;
  label: string;
  value: string;
  at: { x: number; y: number };
  corner?: 'tl' | 'tr' | 'bl' | 'br';
}

/** A label-over-value reading; `alt` makes the value flicker to a second value now and then. `wide` spans both columns. */
export interface ReadoutRow {
  label: string;
  value: string;
  alt?: string;
  wide?: boolean;
}

/** One footer button: the label, a short note on the right, and whether it is the primary one. */
export interface DecisionOption {
  id: string;
  label: string;
  note?: string;
  primary?: boolean;
  disabled?: boolean;
  /** Why it is disabled (a tooltip). */
  reason?: string;
}

/** Who is on the other end: names, ship, faction and a status pill. `alt` is a second name it flickers to. */
export interface CallerInfo {
  name: string;
  alt?: string;
  /** The line above the ship ("Captain of the"), empty for none. */
  role?: string;
  ship?: string;
  /** Faction name and kind, e.g. "Scrapper Clans · raider skiff", with a swatch colour. */
  faction: string;
  swatch?: string;
  status?: { label: string; tone: CommsTone };
}
