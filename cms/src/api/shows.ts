import { apiClient } from './client';
import {
  Show,
  ShowCreatePayload,
  ShowListResponse,
  ShowQueryParams,
  ShowUpdatePayload,
} from '../types/show';
import { PublishSeriesResponse } from '../types/publish';

export async function getShows(params: ShowQueryParams = {}): Promise<ShowListResponse> {
  const searchParams = new URLSearchParams();
  if (params.q) searchParams.set('q', params.q);
  if (params.section) searchParams.set('section', params.section);
  if (params.status) searchParams.set('status', params.status);
  if (params.page !== undefined) searchParams.set('page', String(params.page));
  if (params.page_size !== undefined) searchParams.set('page_size', String(params.page_size));

  const queryString = searchParams.toString();
  const endpoint = queryString ? `/shows?${queryString}` : '/shows';

  return apiClient<ShowListResponse>(endpoint, { method: 'GET' });
}

export async function getShow(id: number): Promise<Show> {
  return apiClient<Show>(`/shows/${id}`, { method: 'GET' });
}

export async function createShow(payload: ShowCreatePayload): Promise<Show> {
  return apiClient<Show>('/shows', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateShow(id: number, payload: ShowUpdatePayload): Promise<Show> {
  return apiClient<Show>(`/shows/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteShow(id: number): Promise<void> {
  return apiClient<void>(`/shows/${id}`, {
    method: 'DELETE',
  });
}

export async function publishSeries(showId: number): Promise<PublishSeriesResponse> {
  return apiClient<PublishSeriesResponse>(`/shows/${showId}/publish`, {
    method: 'POST',
  });
}

