export type LanguageType = 'en' | 'hi';
export type EpisodeStatus = 'draft' | 'published';

export interface Episode {
  id: number;
  episode_id: string;
  season_id: number;
  episode_number: number;
  title: string;
  synopsis: string | null;
  duration_seconds: number | null;
  language: LanguageType;
  content_group: string;
  status: EpisodeStatus;
  created_at: string;
  updated_at: string;
}

export interface EpisodeCreatePayload {
  episode_id: string;
  episode_number: number;
  title: string;
  synopsis?: string | null;
  duration_seconds?: number | null;
  language: LanguageType;
  content_group: string;
  status?: EpisodeStatus;
}

export interface EpisodeUpdatePayload {
  episode_id?: string;
  episode_number?: number;
  title?: string;
  synopsis?: string | null;
  duration_seconds?: number | null;
  language?: LanguageType;
  content_group?: string;
  status?: EpisodeStatus;
}
