import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from '../App';
import { CatalogueData } from '../types/catalog';

const mockFullCatalog: CatalogueData = {
  sections: [
    {
      name: 'featured',
      shows: [
        {
          id: 1,
          title: 'Dragon Tales',
          slug: 'dragon-tales',
          section: 'featured',
          description: 'A magical journey with dragons and friends.',
          categories: ['Fantasy', 'Kids'],
          seasons: [
            {
              season_number: 1,
              title: 'Season 1',
              episodes: [
                {
                  content_group: 'cg-dt-1',
                  episode_number: 1,
                  title: 'Dragon Island',
                  synopsis: 'Landing on Dragon Island for the first time.',
                  duration_seconds: 300,
                  languages: ['en', 'hi'],
                  artwork: {
                    poster: '/storage/dragon_poster.jpg',
                    banner: '/storage/dragon_banner.jpg',
                    thumbnail: '/storage/dragon_thumb.jpg',
                  },
                },
              ],
            },
          ],
        },
      ],
    },
    {
      name: 'series',
      shows: [
        {
          id: 2,
          title: 'Space Explorers',
          slug: 'space-explorers',
          section: 'series',
          description: 'Exploring the outer solar system.',
          categories: ['Sci-Fi'],
          seasons: [
            {
              season_number: 1,
              title: 'Season 1',
              episodes: [
                {
                  content_group: 'cg-se-1',
                  episode_number: 1,
                  title: 'Moon Landing',
                  duration_seconds: 240,
                  languages: ['en'],
                  artwork: {
                    poster: '/storage/space_poster.jpg',
                  },
                },
              ],
            },
          ],
        },
      ],
    },
    {
      name: 'minisodes',
      shows: [], // Empty section should not render
    },
    {
      name: 'songs',
      shows: [
        {
          id: 3,
          title: 'Happy Rhymes',
          slug: 'happy-rhymes',
          section: 'songs',
          description: 'Catchy nursery rhymes and tunes.',
          categories: ['Music'],
          seasons: [
            {
              season_number: 1,
              title: 'Season 1',
              episodes: [
                {
                  content_group: 'cg-hr-1',
                  episode_number: 1,
                  title: 'Sing Along',
                  duration_seconds: 90,
                  languages: ['en'],
                  artwork: {},
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

function renderHome() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Viewer Home Page', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders loading skeleton while catalogue is loading', async () => {
    let resolvePromise: (value: Response) => void;
    const fetchPromise = new Promise<Response>((resolve) => {
      resolvePromise = resolve;
    });

    vi.spyOn(window, 'fetch').mockImplementationOnce(() => fetchPromise);

    renderHome();

    expect(screen.getByTestId('viewer-skeleton')).toBeInTheDocument();

    // Resolve request
    resolvePromise!(
      new Response(JSON.stringify(mockFullCatalog), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await waitFor(() => {
      expect(screen.queryByTestId('viewer-skeleton')).not.toBeInTheDocument();
      expect(screen.getByTestId('hero-section')).toBeInTheDocument();
    });
  });

  it('renders hero section from featured content with banner, title, and link', async () => {
    vi.spyOn(window, 'fetch').mockImplementationOnce(() =>
      Promise.resolve(
        new Response(JSON.stringify(mockFullCatalog), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );

    renderHome();

    await waitFor(() => {
      expect(screen.getByTestId('hero-section')).toBeInTheDocument();
      expect(screen.getByTestId('hero-title')).toHaveTextContent('Dragon Tales');
      expect(screen.getByTestId('hero-description')).toHaveTextContent('A magical journey with dragons and friends.');
      expect(screen.getByTestId('hero-section')).toHaveTextContent('Fantasy');
      expect(screen.getByTestId('hero-section')).toHaveTextContent('Kids');
      expect(screen.getByTestId('hero-banner-image')).toHaveAttribute('src', '/storage/dragon_banner.jpg');
      expect(screen.getByTestId('hero-view-show')).toHaveAttribute('href', '/shows/dragon-tales');
    });
  });

  it('renders section rows for non-empty sections only and displays show cards', async () => {
    vi.spyOn(window, 'fetch').mockImplementationOnce(() =>
      Promise.resolve(
        new Response(JSON.stringify(mockFullCatalog), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );

    renderHome();

    await waitFor(() => {
      expect(screen.getByTestId('section-row-featured')).toBeInTheDocument();
      expect(screen.getByTestId('section-row-series')).toBeInTheDocument();
      expect(screen.getByTestId('section-row-songs')).toBeInTheDocument();
      expect(screen.queryByTestId('section-row-minisodes')).not.toBeInTheDocument();

      // Show cards
      expect(screen.getByTestId('show-card-dragon-tales')).toBeInTheDocument();
      expect(screen.getByTestId('show-card-space-explorers')).toBeInTheDocument();
      expect(screen.getByTestId('show-card-happy-rhymes')).toBeInTheDocument();
    });
  });

  it('renders empty catalogue state when no shows exist in catalogue', async () => {
    const emptyCatalog: CatalogueData = {
      sections: [
        { name: 'featured', shows: [] },
        { name: 'series', shows: [] },
      ],
    };

    vi.spyOn(window, 'fetch').mockImplementationOnce(() =>
      Promise.resolve(
        new Response(JSON.stringify(emptyCatalog), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );

    renderHome();

    await waitFor(() => {
      expect(screen.getByTestId('viewer-empty')).toBeInTheDocument();
      expect(screen.getByText(/No Shows Available/i)).toBeInTheDocument();
    });
  });

  it('renders error state and supports retry action', async () => {
    let callCount = 0;

    vi.spyOn(window, 'fetch').mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve(
          new Response(JSON.stringify({ detail: 'Internal server error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      }
      return Promise.resolve(
        new Response(JSON.stringify(mockFullCatalog), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    renderHome();

    await waitFor(() => {
      expect(screen.getByTestId('viewer-error')).toBeInTheDocument();
      expect(screen.getByText(/Internal server error/i)).toBeInTheDocument();
      expect(screen.getByTestId('viewer-retry-btn')).toBeInTheDocument();
    });

    // Click retry
    fireEvent.click(screen.getByTestId('viewer-retry-btn'));

    await waitFor(() => {
      expect(screen.queryByTestId('viewer-error')).not.toBeInTheDocument();
      expect(screen.getByTestId('hero-section')).toBeInTheDocument();
    });
  });
});
