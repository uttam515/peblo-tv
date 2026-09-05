import { apiClient } from './client';
import { Season, SeasonCreatePayload, SeasonUpdatePayload } from '../types/season';

export async function getSeasonsForShow(showId: number): Promise<Season[]> {
  return apiClient<Season[]>(`/shows/${showId}/seasons`, { method: 'GET' });
}

export async function getSeason(seasonId: number): Promise<Season> {
  return apiClient<Season>(`/seasons/${seasonId}`, { method: 'GET' });
}

export async function createSeason(
  showId: number,
  payload: SeasonCreatePayload
): Promise<Season> {
  return apiClient<Season>(`/shows/${showId}/seasons`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateSeason(
  seasonId: number,
  payload: SeasonUpdatePayload
): Promise<Season> {
  return apiClient<Season>(`/seasons/${seasonId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteSeason(seasonId: number): Promise<void> {
  return apiClient<void>(`/seasons/${seasonId}`, {
    method: 'DELETE',
  });
}
