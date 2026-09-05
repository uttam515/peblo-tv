import { CatalogueShow } from '../types/catalog';

export function formatArtworkUrl(url?: string): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/')) {
    return url;
  }
  return `/${url}`;
}

export function getShowPoster(show: CatalogueShow): string | undefined {
  for (const season of show.seasons || []) {
    for (const ep of season.episodes || []) {
      if (ep.artwork?.poster) {
        return formatArtworkUrl(ep.artwork.poster);
      }
    }
  }
  return undefined;
}

export function getShowBanner(show: CatalogueShow): string | undefined {
  for (const season of show.seasons || []) {
    for (const ep of season.episodes || []) {
      if (ep.artwork?.banner) {
        return formatArtworkUrl(ep.artwork.banner);
      }
    }
  }
  return undefined;
}
