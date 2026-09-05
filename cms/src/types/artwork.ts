export type ArtworkType = 'poster' | 'banner' | 'thumbnail';

export interface Artwork {
  id: number;
  episode_id: number;
  artwork_type: ArtworkType;
  file_path: string;
  width: number | null;
  height: number | null;
  file_size: number | null;
  mime_type: string | null;
  created_at: string;
  updated_at: string;
}

export interface ArtworkSpec {
  type: ArtworkType;
  label: string;
  width: number;
  height: number;
  aspectRatio: string;
  maxSizeBytes: number;
}

export const ARTWORK_SPECS: Record<ArtworkType, ArtworkSpec> = {
  poster: {
    type: 'poster',
    label: 'Poster',
    width: 600,
    height: 900,
    aspectRatio: '2:3',
    maxSizeBytes: 200 * 1024,
  },
  banner: {
    type: 'banner',
    label: 'Banner',
    width: 1280,
    height: 720,
    aspectRatio: '16:9',
    maxSizeBytes: 200 * 1024,
  },
  thumbnail: {
    type: 'thumbnail',
    label: 'Thumbnail',
    width: 640,
    height: 360,
    aspectRatio: '16:9',
    maxSizeBytes: 200 * 1024,
  },
};
