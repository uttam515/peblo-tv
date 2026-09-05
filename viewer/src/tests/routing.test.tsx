import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from '../App';
import { CatalogueData } from '../types/catalog';

const mockCatalog: CatalogueData = {
  sections: [
    {
      name: 'featured',
      shows: [
        {
          id: 10,
          title: 'Cosmic Journey',
          slug: 'cosmic-journey',
          section: 'featured',
          description: 'A fun space adventure',
          categories: ['Sci-Fi'],
          seasons: [
            {
              season_number: 1,
              title: 'Season 1',
              episodes: [
                {
                  content_group: 'cg-1',
                  episode_number: 1,
                  title: 'Blast Off',
                  duration_seconds: 150,
                  languages: ['en'],
                  artwork: {
                    poster: '/storage/art1.jpg',
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

function renderViewer(initialRoute = '/') {
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

describe('Viewer Application Foundation & Routing', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders Header with brand and navigates to HomePage', async () => {
    vi.spyOn(window, 'fetch').mockImplementationOnce(() =>
      Promise.resolve(
        new Response(JSON.stringify(mockCatalog), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );

    renderViewer('/');

    expect(screen.getByTestId('viewer-header')).toBeInTheDocument();
    expect(screen.getByTestId('brand-link')).toHaveTextContent('Peblo TV');

    await waitFor(() => {
      expect(screen.getByTestId('viewer-home-page')).toBeInTheDocument();
      expect(screen.getAllByText('Cosmic Journey').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByTestId('show-card-cosmic-journey')).toBeInTheDocument();
    });
  });

  it('navigates from HomePage to ShowDetailPage via show card preview and Watch Show action', async () => {
    vi.spyOn(window, 'fetch').mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify(mockCatalog), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );

    renderViewer('/');

    await waitFor(() => {
      expect(screen.getByTestId('show-card-cosmic-journey')).toBeInTheDocument();
    });

    // Step 1: Clicking show card opens the Netflix-style preview modal
    fireEvent.click(screen.getByTestId('show-card-cosmic-journey'));

    await waitFor(() => {
      expect(screen.getByTestId('show-preview-modal')).toBeInTheDocument();
      expect(screen.getByTestId('preview-show-title')).toHaveTextContent('Cosmic Journey');
      expect(screen.getByTestId('watch-show-button')).toBeInTheDocument();
    });

    // Step 2: Clicking "Watch Show" navigates to Show Detail page
    fireEvent.click(screen.getByTestId('watch-show-button'));

    await waitFor(() => {
      expect(screen.getByTestId('viewer-show-detail-page')).toBeInTheDocument();
      expect(screen.getByTestId('show-title')).toHaveTextContent('Cosmic Journey');
      expect(screen.getByTestId('show-description')).toHaveTextContent('A fun space adventure');
      expect(screen.getByTestId('episode-card-1')).toBeInTheDocument();
    });
  });

  it('opens show preview modal and can be closed without navigating away', async () => {
    vi.spyOn(window, 'fetch').mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify(mockCatalog), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );

    renderViewer('/');

    await waitFor(() => {
      expect(screen.getByTestId('show-card-cosmic-journey')).toBeInTheDocument();
    });

    // Open preview
    fireEvent.click(screen.getByTestId('show-card-cosmic-journey'));

    await waitFor(() => {
      expect(screen.getByTestId('show-preview-modal')).toBeInTheDocument();
    });

    // Close preview via close button
    fireEvent.click(screen.getByTestId('close-preview-btn'));

    await waitFor(() => {
      expect(screen.queryByTestId('show-preview-modal')).not.toBeInTheDocument();
      expect(screen.getByTestId('viewer-home-page')).toBeInTheDocument();
    });
  });

  it('handles direct navigation to /shows/:slug', async () => {
    vi.spyOn(window, 'fetch').mockImplementationOnce(() =>
      Promise.resolve(
        new Response(JSON.stringify(mockCatalog), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );

    renderViewer('/shows/cosmic-journey');

    await waitFor(() => {
      expect(screen.getByTestId('viewer-show-detail-page')).toBeInTheDocument();
      expect(screen.getByTestId('show-title')).toHaveTextContent('Cosmic Journey');
    });
  });

  it('renders show not found state for nonexistent slug', async () => {
    vi.spyOn(window, 'fetch').mockImplementationOnce(() =>
      Promise.resolve(
        new Response(JSON.stringify(mockCatalog), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );

    renderViewer('/shows/non-existent-show');

    await waitFor(() => {
      expect(screen.getByTestId('show-not-found')).toBeInTheDocument();
      expect(screen.getByText(/Could not find any published show matching slug/i)).toBeInTheDocument();
    });
  });

  it('renders Catalogue Coming Soon message when catalogue is 404', async () => {
    vi.spyOn(window, 'fetch').mockImplementationOnce(() =>
      Promise.resolve(
        new Response(JSON.stringify({ detail: 'Catalogue has not been published yet' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );

    renderViewer('/');

    await waitFor(() => {
      expect(screen.getByTestId('viewer-error')).toBeInTheDocument();
      expect(screen.getByText(/Catalogue Coming Soon/i)).toBeInTheDocument();
    });
  });
});
