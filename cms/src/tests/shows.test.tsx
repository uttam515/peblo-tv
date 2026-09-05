import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../context/AuthContext';
import { ShowsPage } from '../pages/ShowsPage';

const mockShows = [
  {
    id: 1,
    title: 'Alpha Cosmic',
    slug: 'alpha-cosmic',
    section: 'featured',
    description: 'An awesome space journey',
    status: 'published',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
    categories: [
      { id: 10, name: 'Sci-Fi', slug: 'sci-fi' },
      { id: 11, name: 'Adventure', slug: 'adventure' },
    ],
  },
  {
    id: 2,
    title: 'Beta Stories',
    slug: 'beta-stories',
    section: 'series',
    description: 'Storyline series',
    status: 'draft',
    created_at: '2026-01-03T00:00:00Z',
    updated_at: '2026-01-04T00:00:00Z',
    categories: [],
  },
];

function renderShowsPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  window.localStorage.setItem('peblo_tv_cms_token', 'test-jwt');
  window.localStorage.setItem(
    'peblo_tv_cms_user',
    JSON.stringify({ username: 'editor_user', role: 'editor' })
  );

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter>
          <ShowsPage />
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

describe('Shows Management Page', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockGetMe = () => ({
    id: 1,
    username: 'editor_user',
    role: 'editor',
  });

  it('renders loading state and displays show list with details', async () => {
    vi.spyOn(window, 'fetch').mockImplementation((input) => {
      const url = String(input);
      if (url.includes('/auth/me')) {
        return Promise.resolve(
          new Response(JSON.stringify(mockGetMe()), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      }
      if (url.includes('/shows')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              total: 2,
              page: 1,
              page_size: 10,
              results: mockShows,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        );
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });

    renderShowsPage();

    expect(screen.getByTestId('shows-loading')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Alpha Cosmic')).toBeInTheDocument();
      expect(screen.getByText('alpha-cosmic')).toBeInTheDocument();
      expect(screen.getByText('featured')).toBeInTheDocument();
      expect(screen.getByText('published')).toBeInTheDocument();
      expect(screen.getByText('Sci-Fi')).toBeInTheDocument();
      expect(screen.getByText('Adventure')).toBeInTheDocument();

      expect(screen.getByText('Beta Stories')).toBeInTheDocument();
      expect(screen.getByText('beta-stories')).toBeInTheDocument();
    });
  });

  it('handles search and filter changes triggering API requests', async () => {
    const fetchSpy = vi.spyOn(window, 'fetch').mockImplementation((input) => {
      const url = String(input);
      if (url.includes('/auth/me')) {
        return Promise.resolve(
          new Response(JSON.stringify(mockGetMe()), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({
            total: 1,
            page: 1,
            page_size: 10,
            results: [mockShows[0]],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );
    });

    renderShowsPage();

    await waitFor(() => {
      expect(screen.getByText('Alpha Cosmic')).toBeInTheDocument();
    });

    const searchInput = screen.getByTestId('search-input');
    fireEvent.change(searchInput, { target: { value: 'Alpha' } });

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('q=Alpha'),
        expect.anything()
      );
    });

    const sectionFilter = screen.getByTestId('section-filter');
    fireEvent.change(sectionFilter, { target: { value: 'featured' } });

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('section=featured'),
        expect.anything()
      );
    });
  });

  it('creates a new show successfully', async () => {
    let currentShows: any[] = [];

    const fetchSpy = vi.spyOn(window, 'fetch').mockImplementation((input, init) => {
      const url = String(input);
      const method = init?.method || 'GET';

      if (url.includes('/auth/me')) {
        return Promise.resolve(
          new Response(JSON.stringify(mockGetMe()), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      }

      if (url === '/shows' && method === 'POST') {
        const body = JSON.parse(init?.body as string);
        const created = {
          id: 3,
          ...body,
          created_at: '2026-01-05T00:00:00Z',
          updated_at: '2026-01-05T00:00:00Z',
          categories: [],
        };
        currentShows = [created];
        return Promise.resolve(
          new Response(JSON.stringify(created), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      }

      if (url.includes('/shows') && method === 'GET') {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              total: currentShows.length,
              page: 1,
              page_size: 10,
              results: currentShows,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        );
      }

      return Promise.reject(new Error(`Unhandled: ${url}`));
    });

    renderShowsPage();

    await waitFor(() => {
      expect(screen.getByTestId('shows-empty')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('create-show-btn'));

    const titleInput = screen.getByLabelText(/Title/i);
    const slugInput = screen.getByLabelText(/Slug/i);
    const saveBtn = screen.getByTestId('save-show-btn');

    fireEvent.change(titleInput, { target: { value: 'New Galactic Show' } });
    fireEvent.change(slugInput, { target: { value: 'new-galactic-show' } });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        '/shows',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByText('New Galactic Show')).toBeInTheDocument();
    });
  });

  it('handles duplicate slug error (409) when creating show', async () => {
    vi.spyOn(window, 'fetch').mockImplementation((input, init) => {
      const url = String(input);
      const method = init?.method || 'GET';

      if (url.includes('/auth/me')) {
        return Promise.resolve(
          new Response(JSON.stringify(mockGetMe()), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      }

      if (url === '/shows' && method === 'POST') {
        return Promise.resolve(
          new Response(
            JSON.stringify({ detail: 'Show with this slug already exists' }),
            { status: 409, headers: { 'Content-Type': 'application/json' } }
          )
        );
      }

      return Promise.resolve(
        new Response(
          JSON.stringify({ total: 0, page: 1, page_size: 10, results: [] }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );
    });

    renderShowsPage();

    await waitFor(() => {
      expect(screen.getByTestId('shows-empty')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('create-show-btn'));

    const titleInput = screen.getByLabelText(/Title/i);
    const slugInput = screen.getByLabelText(/Slug/i);
    const saveBtn = screen.getByTestId('save-show-btn');

    fireEvent.change(titleInput, { target: { value: 'Alpha Cosmic' } });
    fireEvent.change(slugInput, { target: { value: 'alpha-cosmic' } });
    fireEvent.click(saveBtn);

    expect(
      await screen.findByText('Show with this slug already exists')
    ).toBeInTheDocument();
  });

  it('edits a show with partial updates', async () => {
    let currentShows = [mockShows[0]];

    const fetchSpy = vi.spyOn(window, 'fetch').mockImplementation((input, init) => {
      const url = String(input);
      const method = init?.method || 'GET';

      if (url.includes('/auth/me')) {
        return Promise.resolve(
          new Response(JSON.stringify(mockGetMe()), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      }

      if (url.includes('/shows/1') && method === 'PATCH') {
        const body = JSON.parse(init?.body as string);
        const updated = { ...currentShows[0], ...body };
        currentShows = [updated];
        return Promise.resolve(
          new Response(JSON.stringify(updated), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      }

      return Promise.resolve(
        new Response(
          JSON.stringify({
            total: currentShows.length,
            page: 1,
            page_size: 10,
            results: currentShows,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );
    });

    renderShowsPage();

    await waitFor(() => {
      expect(screen.getByText('Alpha Cosmic')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('edit-show-1'));

    const titleInput = screen.getByLabelText(/Title/i);
    expect(titleInput).toHaveValue('Alpha Cosmic');

    fireEvent.change(titleInput, { target: { value: 'Alpha Cosmic Updated' } });
    fireEvent.click(screen.getByTestId('save-show-btn'));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        '/shows/1',
        expect.objectContaining({
          method: 'PATCH',
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByText('Alpha Cosmic Updated')).toBeInTheDocument();
    });
  });

  it('deletes a show after confirmation', async () => {
    let currentShows = [mockShows[0]];

    const fetchSpy = vi.spyOn(window, 'fetch').mockImplementation((input, init) => {
      const url = String(input);
      const method = init?.method || 'GET';

      if (url.includes('/auth/me')) {
        return Promise.resolve(
          new Response(JSON.stringify(mockGetMe()), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      }

      if (url.includes('/shows/1') && method === 'DELETE') {
        currentShows = [];
        return Promise.resolve(new Response(null, { status: 204 }));
      }

      return Promise.resolve(
        new Response(
          JSON.stringify({
            total: currentShows.length,
            page: 1,
            page_size: 10,
            results: currentShows,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );
    });

    renderShowsPage();

    await waitFor(() => {
      expect(screen.getByText('Alpha Cosmic')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('delete-show-1'));

    expect(screen.getByText(/Confirm Deletion/i)).toBeInTheDocument();
    expect(screen.getByText(/Are you sure you want to delete/i)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('confirm-delete-btn'));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        '/shows/1',
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('shows-empty')).toBeInTheDocument();
    });
  });

  it('displays API error state when fetch fails', async () => {
    vi.spyOn(window, 'fetch').mockImplementation((input) => {
      const url = String(input);
      if (url.includes('/auth/me')) {
        return Promise.resolve(
          new Response(JSON.stringify(mockGetMe()), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({ detail: 'Database connection error' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        )
      );
    });

    renderShowsPage();

    expect(await screen.findByTestId('shows-error')).toBeInTheDocument();
    expect(screen.getByText(/Database connection error/i)).toBeInTheDocument();
  });

  it('handles pagination navigation and button states', async () => {
    const fetchSpy = vi.spyOn(window, 'fetch').mockImplementation((input) => {
      const url = String(input);
      if (url.includes('/auth/me')) {
        return Promise.resolve(
          new Response(JSON.stringify(mockGetMe()), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({
            total: 25,
            page: url.includes('page=2') ? 2 : 1,
            page_size: 10,
            results: mockShows,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );
    });

    renderShowsPage();

    await waitFor(() => {
      expect(screen.getByText(/Showing page/i)).toHaveTextContent(
        'Showing page 1 of 3 (25 total shows)'
      );
    });

    const prevBtn = screen.getByTestId('prev-page-btn');
    const nextBtn = screen.getByTestId('next-page-btn');

    expect(prevBtn).toBeDisabled();
    expect(nextBtn).not.toBeDisabled();

    fireEvent.click(nextBtn);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('page=2'),
        expect.anything()
      );
    });
  });
});
