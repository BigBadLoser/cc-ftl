/** The colour of drafted crew control: selection ring and arrow, order marker, path line and the select box. Defined once; main.ts publishes it to CSS as `--draft`. */
export const DRAFT_COLOR = 0x7ae64a;
export const DRAFT_CSS = `#${DRAFT_COLOR.toString(16).padStart(6, '0')}`;
/** The same colour as a translucent fill for the select box. */
export const DRAFT_CSS_FILL = `rgba(${DRAFT_COLOR >> 16}, ${(DRAFT_COLOR >> 8) & 255}, ${DRAFT_COLOR & 255}, 0.14)`;
