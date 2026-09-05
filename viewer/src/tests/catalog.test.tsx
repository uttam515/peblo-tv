import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCatalog, searchCatalog } from '../api/catalog';
import { ApiError } from '../api/client';
import { CatalogueData } from '../types/catalog';

const mockCatalog: CatalogueData = {
  sections: [
    {
      name: 'featured',
      shows: [
        {
          id: 1,
          title: 'Star Quest',
          slug: 'star-quest',
          section: 'featured',
          description: 'A space odyssey for kids',
          categories: ['Sci-Fi', 'Adventure'],
          seasons: [
            {
              season_number: 1,
              title: 'Season 1',
              episodes: [
                {
                  content_group: 'cg-101',
                  episode_number: 1,
                  title: 'Launch Day',
                  duration_seconds: 120,
                  languages: ['en', 'hi'],
                  artwork: {
                    poster: '/storage/art_poster.jpg',
                    banner: '/storage/art_banner.jpg',
                    thumbnail: '/storage/art_thumb.jpg',
                  },
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

describe('Viewer Catalogue API Client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('successfully fetches full catalogue from GET /catalog', async () => {
    vi.spyOn(window, 'fetch').mockImplementationOnce(() =>
      Promise.resolve(
        new Response(JSON.stringify(mockCatalog), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );

    const result = await getCatalog();
    expect(result.sections).toHaveLength(1);
    expect(result.sections[0].name).toBe('featured');
    expect(result.sections[0].shows[0].title).toBe('Star Quest');
    expect(result.sections[0].shows[0].slug).toBe('star-quest');
  });

  it('throws ApiError with 404 when catalogue is not yet published', async () => {
    vi.spyOn(window, 'fetch').mockImplementationOnce(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({ detail: 'Catalogue has not been published yet' }),
          {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      )
    );

    await expect(getCatalog()).rejects.toThrow(ApiError);
  });

  it('builds query parameters correctly in searchCatalog', async () => {
    let capturedUrl = '';
    vi.spyOn(window, 'fetch').mockImplementationOnce((input) => {
      capturedUrl = String(input);
      return Promise.resolve(
        new Response(JSON.stringify(mockCatalog), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    const result = await searchCatalog({
      q: 'star',
      category: 'sci-fi',
      language: 'en',
      section: 'featured',
    });

    expect(capturedUrl).toContain('q=star');
    expect(capturedUrl).toContain('category=sci-fi');
    expect(capturedUrl).toContain('language=en');
    expect(capturedUrl).toContain('section=featured');
    expect(result.sections).toHaveLength(1);
  });
});
