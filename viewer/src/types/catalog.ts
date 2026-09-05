export interface CatalogueArtwork {
  poster?: string;
  banner?: string;
  thumbnail?: string;
  [key: string]: string | undefined;
}

export interface CatalogueEpisode {
  content_group: string;
  episode_number: number;
  title: string;
  synopsis?: string | null;
  duration_seconds: number;
  languages: string[];
  artwork?: CatalogueArtwork;
}

export interface CatalogueSeason {
  season_number: number;
  title?: string | null;
  description?: string | null;
  episodes: CatalogueEpisode[];
}

export interface CatalogueShow {
  id: number;
  title: string;
  slug: string;
  section: string;
  description?: string | null;
  categories: string[];
  seasons: CatalogueSeason[];
}

export interface CatalogueSection {
  name: string;
  shows: CatalogueShow[];
}

export interface CatalogueData {
  sections: CatalogueSection[];
}

export interface CatalogSearchParams {
  q?: string;
  category?: string;
  language?: string;
  section?: string;
}
