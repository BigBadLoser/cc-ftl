/** Shared schema for generated gameplay-reference cards and their relationships. */
export type Kind = 'modules' | 'items' | 'weapons' | 'vehicles' | 'recipes' | 'factions' | 'research';
export type CatalogMaterial = { slug: string; name: string; count: number };
export type CatalogEntry = {
  id: string;
  slug: string;
  name: string;
  subtitle: string;
  category?: string;
  image: string | null;
  facts: Array<[string, string]>;
  inputs?: CatalogMaterial[];
  outputs?: CatalogMaterial[];
  station?: string;
  stationSlug?: string;
};
