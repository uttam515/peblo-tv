import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from '../App';
import { CatalogueData } from '../types/catalog';
import { formatSeasonLabel } from '../utils/format';

const mockFullCatalog: CatalogueData = {
  sections: [
    {
      name: 'featured',
      shows: [
        {
          id: 1,
          title: 'Quantum Explorers',
          slug: 'quantum-explorers',
          section: 'featured',
          description: 'A thrilling quantum science journey through the multiverse.',
          categories: ['Sci-Fi', 'Adventure'],
          seasons: [
            {
              season_number: 0,
              title: 'Trailers & Teasers',
              episodes: [
                {
                  content_group: 'cg-trailer-1',
                  episode_number: 1,
                  title: 'Official Teaser',
                  duration_seconds: 45,
                  languages: ['en'],
                  artwork: {
                    banner: '/storage/trailer-banner.jpg',
                  },
                },
              ],
            },
            {
              season_number: 2,
              title: 'Parallel Realities',
              description: 'The team explores mirror dimensions.',
              episodes: [
                {
                  content_group: 'cg-s2-e2',
                  episode_number: 2,
                  title: 'The Mirror Paradox',
                  synopsis: 'They face alternate versions of themselves.',
                  duration_seconds: 1800,
                  languages: ['en'],
                  artwork: {
                    thumbnail: '/storage/s2e2-thumb.jpg',
                  },
                },
                {
                  content_group: 'cg-s2-e1',
                  episode_number: 1,
                  title: 'Multiverse Rift',
                  synopsis: 'A portal opens into universe 42.',
                  duration_seconds: 1500,
                  languages: ['en', 'hi'],
                  artwork: {
                    thumbnail: '/storage/s2e1-thumb.jpg',
                  },
                },
              ],
            },
            {
              season_number: 1,
              title: 'The Quantum Leap',
              description: 'Inception of the quantum jump technology.',
              episodes: [
                {
                  content_group: 'cg-s1-e2',
                  episode_number: 2,
                  title: 'Subatomic Journey',
                  synopsis: 'Shrinking down to microscopic scales.',
                  duration_seconds: 1350,
                  languages: ['en'],
                  artwork: {},
                },
                {
                  content_group: 'cg-s1-e1',
                  episode_number: 1,
                  title: 'First Jump',
                  synopsis: 'The initial test goes awry.',
                  duration_seconds: 1200,
                  languages: ['en', 'hi'],
                  artwork: {
                    thumbnail: '/storage/s1e1-thumb.jpg',
                    poster: '/storage/s1e1-poster.jpg',
                    banner: '/storage/s1e1-banner.jpg',
                  },
                },
              ],
            },
          ],
        },
        {
          id: 2,
          title: 'Trailer Only Show',
          slug: 'trailer-only-show',
          section: 'series',
          description: 'A show that currently only has trailers.',
          categories: ['Drama'],
          seasons: [
            {
              season_number: 0,
              title: 'Trailers',
              episodes: [
                {
                  content_group: 'cg-tr-1',
                  episode_number: 1,
                  title: 'Teaser 1',
                  duration_seconds: 60,
                  languages: ['en'],
                },
              ],
            },
          ],
        },
        {
          id: 3,
          title: 'Empty Artwork Show',
          slug: 'empty-artwork-show',
          section: 'minisodes',
          description: 'A show with no banner or thumbnail artwork.',
          categories: ['Comedy'],
          seasons: [
            {
              season_number: 1,
              title: 'Season 1',
              episodes: [
                {
                  content_group: 'cg-empty-1',
                  episode_number: 1,
                  title: 'Pilot Episode',
                  synopsis: 'The pilot with zero artwork.',
                  duration_seconds: 300,
                  languages: ['en'],
                },
              ],
            },
          ],
        },
        {
          id: 4,
          title: 'Hindi Only Show',
          slug: 'hindi-only-show',
          section: 'series',
          description: 'A show with episodes available only in Hindi.',
          categories: ['Drama'],
          seasons: [
            {
              season_number: 1,
              title: 'Season 1',
              episodes: [
                {
                  content_group: 'cg-hi-1',
                  episode_number: 1,
                  title: 'Namaste India',
                  synopsis: 'Introduction episode.',
                  duration_seconds: 600,
                  languages: ['hi'],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

function renderViewer(initialRoute = '/shows/quantum-explorers') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialRoute]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Viewer Show Detail Page', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('finds show by slug and renders all show metadata, banner, and categories', async () => {
    vi.spyOn(window, 'fetch').mockImplementationOnce(() =>
      Promise.resolve(
        new Response(JSON.stringify(mockFullCatalog), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );

    renderViewer('/shows/quantum-explorers');

    await waitFor(() => {
      expect(screen.getByTestId('viewer-show-detail-page')).toBeInTheDocument();
    });

    // Show Hero checks
    expect(screen.getByTestId('show-title')).toHaveTextContent('Quantum Explorers');
    expect(screen.getByTestId('show-description')).toHaveTextContent(
      'A thrilling quantum science journey through the multiverse.'
    );
    expect(screen.getByTestId('show-section-badge')).toHaveTextContent('featured');
    expect(screen.getByText('Sci-Fi')).toBeInTheDocument();
    expect(screen.getByText('Adventure')).toBeInTheDocument();
    expect(screen.getByTestId('show-banner-image')).toBeInTheDocument();
    expect(screen.getByTestId('back-to-home')).toBeInTheDocument();
  });

  it('renders graceful banner and thumbnail fallback when artwork is missing', async () => {
    vi.spyOn(window, 'fetch').mockImplementationOnce(() =>
      Promise.resolve(
        new Response(JSON.stringify(mockFullCatalog), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );

    renderViewer('/shows/empty-artwork-show');

    await waitFor(() => {
      expect(screen.getByTestId('viewer-show-detail-page')).toBeInTheDocument();
    });

    expect(screen.getByTestId('show-title')).toHaveTextContent('Empty Artwork Show');
    // Banner should not crash and banner img should not be present
    expect(screen.queryByTestId('show-banner-image')).not.toBeInTheDocument();
    // Thumbnail fallback text preview should be shown
    expect(screen.getByText('Preview')).toBeInTheDocument();
  });

  it('orders seasons ascending, displays clean season labels, and hides Season 0 from regular list', async () => {
    vi.spyOn(window, 'fetch').mockImplementationOnce(() =>
      Promise.resolve(
        new Response(JSON.stringify(mockFullCatalog), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );

    renderViewer('/shows/quantum-explorers');

    await waitFor(() => {
      expect(screen.getByTestId('seasons-container')).toBeInTheDocument();
    });

    // Season 0 must NOT appear in tab list or title
    expect(screen.queryByTestId('season-tab-0')).not.toBeInTheDocument();
    expect(screen.queryByText('Season 0')).not.toBeInTheDocument();
    expect(screen.queryByText('Trailers & Teasers')).not.toBeInTheDocument();

    // Normal seasons (1 and 2) must be present in tab list with clean labels
    const tab1 = screen.getByTestId('season-tab-1');
    const tab2 = screen.getByTestId('season-tab-2');
    expect(tab1).toBeInTheDocument();
    expect(tab1).toHaveTextContent('Season 1');
    expect(tab2).toBeInTheDocument();
    expect(tab2).toHaveTextContent('Season 2');

    // Default active season should be Season 1
    expect(tab1).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('active-season-heading')).toHaveTextContent('Season 1: The Quantum Leap');

    // Never render duplicated season names
    expect(screen.queryByText('Season 1 - Season 1')).not.toBeInTheDocument();
    expect(screen.queryByText('Trailers - Trailers')).not.toBeInTheDocument();
  });

  it('correctly tests formatSeasonLabel utility for season numbers and trailers', () => {
    expect(formatSeasonLabel(0)).toBe('Trailers');
    expect(formatSeasonLabel(1)).toBe('Season 1');
    expect(formatSeasonLabel(2)).toBe('Season 2');
    expect(formatSeasonLabel(5)).toBe('Season 5');
  });

  it('orders episodes within a season by episode_number and renders details & duration format', async () => {
    vi.spyOn(window, 'fetch').mockImplementationOnce(() =>
      Promise.resolve(
        new Response(JSON.stringify(mockFullCatalog), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );

    renderViewer('/shows/quantum-explorers');

    await waitFor(() => {
      expect(screen.getByTestId('episode-card-1')).toBeInTheDocument();
      expect(screen.getByTestId('episode-card-2')).toBeInTheDocument();
    });

    // Episode 1 checks
    expect(screen.getByTestId('episode-title-1')).toHaveTextContent('First Jump');
    expect(screen.getByTestId('episode-synopsis-1')).toHaveTextContent('The initial test goes awry.');
    // 1200 seconds = 20 minutes -> '20m'
    expect(screen.getByText('20m')).toBeInTheDocument();
    expect(screen.getByTestId('episode-thumbnail-1')).toBeInTheDocument();

    // Episode 2 checks
    expect(screen.getByTestId('episode-title-2')).toHaveTextContent('Subatomic Journey');
    // 1350 seconds = 22m
    expect(screen.getByText('22m')).toBeInTheDocument();
  });

  it('filters episodes by selected language using the language dropdown', async () => {
    vi.spyOn(window, 'fetch').mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify(mockFullCatalog), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );

    renderViewer('/shows/quantum-explorers');

    await waitFor(() => {
      expect(screen.getByTestId('show-detail-language-select')).toBeInTheDocument();
    });

    const langSelect = screen.getByTestId('show-detail-language-select');
    // Default should be English ('en')
    expect(langSelect).toHaveValue('en');

    // Both Ep 1 (en, hi) and Ep 2 (en) are visible under English
    expect(screen.getByTestId('episode-card-1')).toBeInTheDocument();
    expect(screen.getByTestId('episode-card-2')).toBeInTheDocument();

    // Change language to Hindi ('hi')
    fireEvent.change(langSelect, { target: { value: 'hi' } });

    await waitFor(() => {
      expect(langSelect).toHaveValue('hi');
      // Ep 1 has Hindi -> visible
      expect(screen.getByTestId('episode-card-1')).toBeInTheDocument();
      // Ep 2 does not have Hindi -> hidden
      expect(screen.queryByTestId('episode-card-2')).not.toBeInTheDocument();
    });
  });

  it('defaults language selector to Hindi when show has only Hindi episodes', async () => {
    vi.spyOn(window, 'fetch').mockImplementationOnce(() =>
      Promise.resolve(
        new Response(JSON.stringify(mockFullCatalog), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );

    renderViewer('/shows/hindi-only-show');

    await waitFor(() => {
      expect(screen.getByTestId('show-detail-language-select')).toBeInTheDocument();
    });

    // Should default to 'hi' because show has no English episodes
    expect(screen.getByTestId('show-detail-language-select')).toHaveValue('hi');
    expect(screen.getByTestId('episode-card-1')).toBeInTheDocument();
    expect(screen.getByTestId('episode-title-1')).toHaveTextContent('Namaste India');
  });

  it('displays empty state for season when selected language has no matching episodes', async () => {
    vi.spyOn(window, 'fetch').mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify(mockFullCatalog), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );

    renderViewer('/shows/empty-artwork-show');

    await waitFor(() => {
      expect(screen.getByTestId('show-detail-language-select')).toBeInTheDocument();
    });

    const langSelect = screen.getByTestId('show-detail-language-select');
    // Switch to Hindi on a show that only has English
    fireEvent.change(langSelect, { target: { value: 'hi' } });

    await waitFor(() => {
      expect(screen.getByTestId('no-episodes-message')).toBeInTheDocument();
      expect(screen.getByText(/No Hindi episodes found in Season 1/i)).toBeInTheDocument();
    });
  });

  it('switches seasons when clicking season tabs', async () => {
    vi.spyOn(window, 'fetch').mockImplementationOnce(() =>
      Promise.resolve(
        new Response(JSON.stringify(mockFullCatalog), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );

    renderViewer('/shows/quantum-explorers');

    await waitFor(() => {
      expect(screen.getByTestId('season-tab-2')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('season-tab-2'));

    // Should now show Season 2 episodes
    expect(screen.getByTestId('active-season-heading')).toHaveTextContent('Season 2: Parallel Realities');
    expect(screen.getByTestId('episode-title-1')).toHaveTextContent('Multiverse Rift');
    expect(screen.getByTestId('episode-title-2')).toHaveTextContent('The Mirror Paradox');
    // 1800s = 30m, 1500s = 25m
    expect(screen.getByText('30m')).toBeInTheDocument();
    expect(screen.getByText('25m')).toBeInTheDocument();
  });

  it('displays helpful empty state when show only has Season 0 (trailers)', async () => {
    vi.spyOn(window, 'fetch').mockImplementationOnce(() =>
      Promise.resolve(
        new Response(JSON.stringify(mockFullCatalog), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );

    renderViewer('/shows/trailer-only-show');

    await waitFor(() => {
      expect(screen.getByTestId('no-regular-seasons')).toBeInTheDocument();
      expect(screen.getByText(/No Full Episodes Released Yet/i)).toBeInTheDocument();
      expect(
        screen.getByText(/This title currently only has promotional trailers and previews./i)
      ).toBeInTheDocument();
    });
  });

  it('displays not-found state with link to home for nonexistent show slug', async () => {
    vi.spyOn(window, 'fetch').mockImplementationOnce(() =>
      Promise.resolve(
        new Response(JSON.stringify(mockFullCatalog), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );

    renderViewer('/shows/unknown-slug');

    await waitFor(() => {
      expect(screen.getByTestId('show-not-found')).toBeInTheDocument();
      expect(screen.getByText(/Show Not Found/i)).toBeInTheDocument();
      expect(
        screen.getByText(/Could not find any published show matching slug "unknown-slug"./i)
      ).toBeInTheDocument();
    });

    expect(screen.getByRole('link', { name: /Return to Catalogue/i })).toHaveAttribute('href', '/');
  });

  it('renders loading skeleton while catalogue is loading', () => {
    vi.spyOn(window, 'fetch').mockImplementationOnce(
      () => new Promise(() => {}) // never resolves
    );

    renderViewer('/shows/quantum-explorers');

    expect(screen.getByTestId('show-detail-skeleton')).toBeInTheDocument();
  });

  it('renders error state with retry button on network/server error', async () => {
    vi.spyOn(window, 'fetch').mockImplementationOnce(() =>
      Promise.reject(new Error('Network connection failed'))
    );

    renderViewer('/shows/quantum-explorers');

    await waitFor(() => {
      expect(screen.getByTestId('show-detail-error')).toBeInTheDocument();
      expect(screen.getByText('Unable to Load Show')).toBeInTheDocument();
      expect(screen.getByText('Network connection failed')).toBeInTheDocument();
      expect(screen.getByTestId('retry-button')).toBeInTheDocument();
    });
  });
});
