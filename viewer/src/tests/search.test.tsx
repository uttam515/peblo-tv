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
          description: 'A magical journey with dragons.',
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
                  duration_seconds: 300,
                  languages: ['en', 'hi'],
                  artwork: {
                    poster: '/storage/dragon_poster.jpg',
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

describe('Viewer Search and Filtering', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders search bar and filter controls in the interface', async () => {
    vi.spyOn(window, 'fetch').mockImplementationOnce(() =>
      Promise.resolve(
        new Response(JSON.stringify(mockFullCatalog), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );

    renderViewer('/');

    expect(screen.getByTestId('header-search-input')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('filter-bar')).toBeInTheDocument();
      expect(screen.getByTestId('filter-section-select')).toBeInTheDocument();
      expect(screen.getByTestId('filter-category-select')).toBeInTheDocument();
      expect(screen.getByTestId('filter-language-select')).toBeInTheDocument();
    });
  });

  it('makes search request with debounced query and displays results without duplicating variants', async () => {
    let capturedUrl = '';
    vi.spyOn(window, 'fetch').mockImplementation((input) => {
      capturedUrl = String(input);
      return Promise.resolve(
        new Response(JSON.stringify(mockFullCatalog), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    renderViewer('/');

    await waitFor(() => {
      expect(screen.getByTestId('hero-section')).toBeInTheDocument();
    });

    const searchInput = screen.getByTestId('header-search-input');
    fireEvent.change(searchInput, { target: { value: 'Dragon' } });

    await waitFor(
      () => {
        expect(capturedUrl).toContain('/catalog/search?q=Dragon');
        expect(screen.getByTestId('search-results-container')).toBeInTheDocument();
        expect(screen.getByTestId('show-card-dragon-tales')).toBeInTheDocument();
        // Hero is hidden during search
        expect(screen.queryByTestId('hero-section')).not.toBeInTheDocument();
      },
      { timeout: 1000 }
    );
  });

  it('initializes search and filters from URL query parameters', async () => {
    let capturedUrl = '';
    vi.spyOn(window, 'fetch').mockImplementationOnce((input) => {
      capturedUrl = String(input);
      return Promise.resolve(
        new Response(JSON.stringify(mockFullCatalog), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    renderViewer('/?q=Space&section=series&language=en');

    await waitFor(() => {
      expect(capturedUrl).toContain('q=Space');
      expect(capturedUrl).toContain('section=series');
      expect(capturedUrl).toContain('language=en');
      expect(screen.getByTestId('header-search-input')).toHaveValue('Space');
      expect(screen.getByTestId('filter-section-select')).toHaveValue('series');
      expect(screen.getByTestId('filter-language-select')).toHaveValue('en');
    });
  });

  it('composes multiple filters (section, category, language) and updates URL', async () => {
    let capturedUrl = '';
    vi.spyOn(window, 'fetch').mockImplementation((input) => {
      capturedUrl = String(input);
      return Promise.resolve(
        new Response(JSON.stringify(mockFullCatalog), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    renderViewer('/');

    await waitFor(() => {
      expect(screen.getByTestId('filter-bar')).toBeInTheDocument();
    });

    // Select Section
    fireEvent.change(screen.getByTestId('filter-section-select'), {
      target: { value: 'series' },
    });

    // Select Language
    fireEvent.change(screen.getByTestId('filter-language-select'), {
      target: { value: 'en' },
    });

    await waitFor(() => {
      expect(capturedUrl).toContain('section=series');
      expect(capturedUrl).toContain('language=en');
      expect(screen.getByTestId('reset-filters-btn')).toBeInTheDocument();
    });
  });

  it('renders empty search results state when no shows match', async () => {
    const emptySearchResult: CatalogueData = {
      sections: [
        { name: 'featured', shows: [] },
        { name: 'series', shows: [] },
      ],
    };

    vi.spyOn(window, 'fetch').mockImplementationOnce(() =>
      Promise.resolve(
        new Response(JSON.stringify(emptySearchResult), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );

    renderViewer('/?q=nonexistent-show-xyz');

    await waitFor(() => {
      expect(screen.getByTestId('search-empty-state')).toBeInTheDocument();
      expect(screen.getByText(/No Shows Found/i)).toBeInTheDocument();
      expect(screen.getByTestId('clear-search-filters-btn')).toBeInTheDocument();
    });

    // Clicking clear search filters
    fireEvent.click(screen.getByTestId('clear-search-filters-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('header-search-input')).toHaveValue('');
    });
  });

  it('resets all filters when reset-filters-btn is clicked', async () => {
    vi.spyOn(window, 'fetch').mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify(mockFullCatalog), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );

    renderViewer('/?section=series&language=en');

    await waitFor(() => {
      expect(screen.getByTestId('reset-filters-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('reset-filters-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('filter-section-select')).toHaveValue('');
      expect(screen.getByTestId('filter-language-select')).toHaveValue('');
      expect(screen.queryByTestId('reset-filters-btn')).not.toBeInTheDocument();
      expect(screen.getByTestId('hero-section')).toBeInTheDocument();
    });
  });

  it('opens show preview modal on search result card click and navigates via Watch Show', async () => {
    vi.spyOn(window, 'fetch').mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify(mockFullCatalog), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );

    renderViewer('/?q=Dragon');

    await waitFor(() => {
      expect(screen.getByTestId('show-card-dragon-tales')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('show-card-dragon-tales'));

    await waitFor(() => {
      expect(screen.getByTestId('show-preview-modal')).toBeInTheDocument();
      expect(screen.getByTestId('preview-show-title')).toHaveTextContent('Dragon Tales');
      expect(screen.getByTestId('watch-show-button')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('watch-show-button'));

    await waitFor(() => {
      expect(screen.getByTestId('viewer-show-detail-page')).toBeInTheDocument();
      expect(screen.getByTestId('show-title')).toHaveTextContent('Dragon Tales');
    });
  });
});
