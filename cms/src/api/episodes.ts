import { apiClient } from './client';
import { Episode, EpisodeCreatePayload, EpisodeUpdatePayload } from '../types/episode';

export async function getEpisodesForSeason(seasonId: number): Promise<Episode[]> {
  return apiClient<Episode[]>(`/seasons/${seasonId}/episodes`, { method: 'GET' });
}

export async function getEpisode(episodeId: string): Promise<Episode> {
  return apiClient<Episode>(`/episodes/${episodeId}`, { method: 'GET' });
}

export async function createEpisode(
  seasonId: number,
  payload: EpisodeCreatePayload
): Promise<Episode> {
  return apiClient<Episode>(`/seasons/${seasonId}/episodes`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateEpisode(
  episodeId: string,
  payload: EpisodeUpdatePayload
): Promise<Episode> {
  return apiClient<Episode>(`/episodes/${episodeId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteEpisode(episodeId: string): Promise<void> {
  return apiClient<void>(`/episodes/${episodeId}`, {
    method: 'DELETE',
  });
}
