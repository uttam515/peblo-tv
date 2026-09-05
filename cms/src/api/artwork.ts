import { apiClient } from './client';
import { Artwork, ArtworkType } from '../types/artwork';

export async function getEpisodeArtwork(episodeId: string): Promise<Artwork[]> {
  return apiClient<Artwork[]>(`/episodes/${episodeId}/artwork`, { method: 'GET' });
}

export async function uploadArtwork(
  episodeId: string,
  artworkType: ArtworkType,
  file: File
): Promise<Artwork> {
  const formData = new FormData();
  formData.append('artwork_type', artworkType);
  formData.append('file', file);

  return apiClient<Artwork>(`/episodes/${episodeId}/artwork`, {
    method: 'POST',
    body: formData,
  });
}

export async function deleteArtwork(
  episodeId: string,
  artworkType: ArtworkType
): Promise<void> {
  return apiClient<void>(`/episodes/${episodeId}/artwork/${artworkType}`, {
    method: 'DELETE',
  });
}
