/** The pure parts of the crew portraits: which look a portrait shows (its cache key) and which asset a layer's portrait is. */

/** What a portrait looks like, as a cache key: it changes only when species, role, appearance or the worn weapon does. */
export function portraitKey(species: string, role: string, appearanceSeed: number, weaponArt: string | undefined): string {
  return `${species}|${role}|${appearanceSeed}|${weaponArt ?? ''}`;
}

/** The static asset holding the front portrait render of a crew layer (`crew.human.hair.short` -> `portrait.crew.human.hair.short`). */
export const portraitAssetId = (layerId: string): string => `portrait.${layerId}`;

/** Size in whole art px of a texture given in world px (the composed manifest draws each art px as `worldPerArt` world px). */
export function artSize(worldW: number, worldH: number, worldPerArt: number): { w: number; h: number } {
  return { w: Math.max(1, Math.round(worldW / worldPerArt)), h: Math.max(1, Math.round(worldH / worldPerArt)) };
}
