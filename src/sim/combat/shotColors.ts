/** Colours that tell simultaneous incoming shots apart (red, pink and amber family), shared by the timeline and the in-world arrows. Pure data. */
export const SHOT_COLORS = [0xf08a9a, 0xffc06a, 0xff5a5a, 0xff9a78, 0xe0508f, 0xffe27a] as const;

export const shotColor = (slot: number): number => SHOT_COLORS[Math.abs(slot) % SHOT_COLORS.length] as number;
