/** The stage a crop layer shows (pixi-free: the wiki's module previews import module art). */
export type CropStage = 'sprout' | 'grow' | 'ripe';

/** The stage a crop shows: ripe once ready, sprout in the first part of its growing, grown after. */
export const cropStage = (growth: number, ready: boolean): CropStage => (ready ? 'ripe' : growth < 0.4 ? 'sprout' : 'grow');
