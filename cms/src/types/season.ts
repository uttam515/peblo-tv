import { Episode } from './episode';

export interface Season {
  id: number;
  show_id: number;
  season_number: number;
  title: string | null;
  created_at: string;
  updated_at: string;
  episodes?: Episode[];
}

export interface SeasonCreatePayload {
  season_number: number;
  title?: string | null;
}

export interface SeasonUpdatePayload {
  season_number?: number;
  title?: string | null;
}
