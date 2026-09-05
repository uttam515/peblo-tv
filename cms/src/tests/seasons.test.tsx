import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../context/AuthContext';
import { ShowDetailPage, getDefaultSeason } from '../pages/ShowDetailPage';

const mockShow = {
  id: 1,
  title: 'Cosmic Adventures',
  slug: 'cosmic-adventures',
  section: 'series',
  description: 'An epic adventure in outer space',
  status: 'published',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-02T00:00:00Z',
  categories: [
    { id: 10, name: 'Sci-Fi', slug: 'sci-fi' },
    { id: 11, name: 'Space', slug: 'space' },
  ],
};

const mockSeasons = [
  {
    id: 100,
    show_id: 1,
    season_number: 0,
    title: 'Official Teasers & Trailers',
    created_at: '2026-01-02T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
  },
  {
    id: 101,
    show_id: 1,
    season_number: 1,
    title: 'The Voyage Begins',
    created_at: '2026-01-03T00:00:00Z',
    updated_at: '2026-01-03T00:00:00Z',
  },
];

function renderShowDetailPage(showId = '1') {
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
        <MemoryRouter initialEntries={[`/shows/${showId}`]}>
          <Routes>
            <Route path="/shows/:showId" element={<ShowDetailPage />} />
            <Route path="/shows" element={<div data-testid="shows-list-page">Shows List Page</div>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

describe('Show Detail & Seasons Management', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockGetMe = () => ({
    id: 1,
    username: 'editor_user',
    role: 'editor',
  });

  it('getDefaultSeason correctly prioritizes Season 1, then normal season, then Trailers', () => {
    expect(getDefaultSeason([])).toBeNull();
    // Prioritizes Season 1
    expect(getDefaultSeason(mockSeasons)?.id).toBe(101);
    // Non-trailer fallback
    const seasonsNoS1 = [
      { id: 100, show_id: 1, season_number: 0, title: null, created_at: '', updated_at: '' },
      { id: 102, show_id: 1, season_number: 2, title: null, created_at: '', updated_at: '' },
    ];
    expect(getDefaultSeason(seasonsNoS1)?.id).toBe(102);
    // Trailer only fallback
    const seasonsOnlyTrailer = [
      { id: 100, show_id: 1, season_number: 0, title: null, created_at: '', updated_at: '' },
    ];
    expect(getDefaultSeason(seasonsOnlyTrailer)?.id).toBe(100);
  });

  it('renders show details, Netflix-style season selector, and Season 0 as Trailers', async () => {
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
      if (url.includes('/shows/1/seasons')) {
        return Promise.resolve(
          new Response(JSON.stringify(mockSeasons), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      }
      if (url.includes('/shows/1')) {
        return Promise.resolve(
          new Response(JSON.stringify(mockShow), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      }
      if (url.includes('/episodes')) {
        return Promise.resolve(
          new Response(JSON.stringify([]), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      }
      if (url.includes('/artwork')) {
        return Promise.resolve(
          new Response(JSON.stringify([]), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });

    renderShowDetailPage('1');

    await waitFor(() => {
      expect(screen.getByTestId('show-title')).toHaveTextContent('Cosmic Adventures');
      expect(screen.getByText('cosmic-adventures')).toBeInTheDocument();
      expect(screen.getByText('An epic adventure in outer space')).toBeInTheDocument();
      expect(screen.getByText('Sci-Fi')).toBeInTheDocument();
      expect(screen.getByText('Space')).toBeInTheDocument();
    });

    // Verify season dropdown rendering
    const seasonSelect = screen.getByTestId('season-select');
    expect(seasonSelect).toBeInTheDocument();
    expect(seasonSelect).toHaveValue('101'); // Season 1 selected by default

    expect(screen.getByRole('option', { name: 'Trailers' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Season 1' })).toBeInTheDocument();

    // Verify duplicated labels or "Season 0" are never displayed
    expect(screen.queryByText(/Season 1 - Season 1/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Trailers - Trailers/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Season 0/i)).not.toBeInTheDocument();

    // Switch to Trailers
    fireEvent.change(seasonSelect, { target: { value: '100' } });
    expect(seasonSelect).toHaveValue('100');
  });

  it('navigates back to Shows list when clicking Back to Shows', async () => {
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
      if (url.includes('/shows/1/seasons')) {
        return Promise.resolve(
          new Response(JSON.stringify(mockSeasons), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      }
      if (url.includes('/shows/1')) {
        return Promise.resolve(
          new Response(JSON.stringify(mockShow), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      }
      if (url.includes('/episodes')) {
        return Promise.resolve(
          new Response(JSON.stringify([]), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });

    renderShowDetailPage('1');

    await waitFor(() => {
      expect(screen.getByTestId('show-title')).toBeInTheDocument();
    });

    const backLink = screen.getByTestId('back-to-shows');
    fireEvent.click(backLink);

    expect(await screen.findByTestId('shows-list-page')).toBeInTheDocument();
  });

  it('creates a new season successfully', async () => {
    let currentSeasons = [...mockSeasons];

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
      if (url.includes('/shows/1/seasons') && method === 'POST') {
        const body = JSON.parse(init?.body as string);
        const created = {
          id: 102,
          show_id: 1,
          ...body,
          created_at: '2026-01-04T00:00:00Z',
          updated_at: '2026-01-04T00:00:00Z',
        };
        currentSeasons = [...currentSeasons, created];
        return Promise.resolve(
          new Response(JSON.stringify(created), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      }
      if (url.includes('/shows/1/seasons') && method === 'GET') {
        return Promise.resolve(
          new Response(JSON.stringify(currentSeasons), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      }
      if (url.includes('/shows/1')) {
        return Promise.resolve(
          new Response(JSON.stringify(mockShow), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      }
      if (url.includes('/episodes')) {
        return Promise.resolve(
          new Response(JSON.stringify([]), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });

    renderShowDetailPage('1');

    await waitFor(() => {
      expect(screen.getByTestId('season-select')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('create-season-btn'));

    const numberInput = screen.getByLabelText(/Season Number/i);
    const titleInput = screen.getByLabelText(/Title/i);
    const saveBtn = screen.getByTestId('save-season-btn');

    fireEvent.change(numberInput, { target: { value: '2' } });
    fireEvent.change(titleInput, { target: { value: 'Season 2: Deep Void' } });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        '/shows/1/seasons',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            season_number: 2,
            title: 'Season 2: Deep Void',
          }),
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Season 2' })).toBeInTheDocument();
    });
  });

  it('handles duplicate season number error (409)', async () => {
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
      if (url.includes('/shows/1/seasons') && method === 'POST') {
        return Promise.resolve(
          new Response(
            JSON.stringify({ detail: 'Season with this number already exists for this show' }),
            { status: 409, headers: { 'Content-Type': 'application/json' } }
          )
        );
      }
      if (url.includes('/shows/1/seasons')) {
        return Promise.resolve(
          new Response(JSON.stringify(mockSeasons), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      }
      if (url.includes('/shows/1')) {
        return Promise.resolve(
          new Response(JSON.stringify(mockShow), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      }
      if (url.includes('/episodes')) {
        return Promise.resolve(
          new Response(JSON.stringify([]), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      }
      return Promise.reject(new Error(`Unhandled: ${url}`));
    });

    renderShowDetailPage('1');

    await waitFor(() => {
      expect(screen.getByTestId('season-select')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('create-season-btn'));

    const numberInput = screen.getByLabelText(/Season Number/i);
    const saveBtn = screen.getByTestId('save-season-btn');

    fireEvent.change(numberInput, { target: { value: '1' } });
    fireEvent.click(saveBtn);

    expect(
      await screen.findByText('Season with this number already exists for this show')
    ).toBeInTheDocument();
  });

  it('edits a season with PATCH /seasons/{id}', async () => {
    let currentSeasons = [...mockSeasons];

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
      if (url.includes('/seasons/101') && method === 'PATCH') {
        const body = JSON.parse(init?.body as string);
        const updated = { ...currentSeasons[1], ...body };
        currentSeasons[1] = updated;
        return Promise.resolve(
          new Response(JSON.stringify(updated), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      }
      if (url.includes('/shows/1/seasons')) {
        return Promise.resolve(
          new Response(JSON.stringify(currentSeasons), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      }
      if (url.includes('/shows/1')) {
        return Promise.resolve(
          new Response(JSON.stringify(mockShow), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      }
      if (url.includes('/episodes')) {
        return Promise.resolve(
          new Response(JSON.stringify([]), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      }
      return Promise.reject(new Error(`Unhandled: ${url}`));
    });

    renderShowDetailPage('1');

    await waitFor(() => {
      expect(screen.getByTestId('edit-season-101')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('edit-season-101'));

    const titleInput = screen.getByLabelText(/Title/i);
    expect(titleInput).toHaveValue('The Voyage Begins');

    fireEvent.change(titleInput, { target: { value: 'The Voyage Begins (Extended)' } });
    fireEvent.click(screen.getByTestId('save-season-btn'));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        '/seasons/101',
        expect.objectContaining({ method: 'PATCH' })
      );
    });

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Season 1' })).toBeInTheDocument();
    });
  });

  it('deletes a season with confirmation dialog', async () => {
    let currentSeasons = [...mockSeasons];

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
      if (url.includes('/seasons/101') && method === 'DELETE') {
        currentSeasons = currentSeasons.filter((s) => s.id !== 101);
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      if (url.includes('/shows/1/seasons')) {
        return Promise.resolve(
          new Response(JSON.stringify(currentSeasons), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      }
      if (url.includes('/shows/1')) {
        return Promise.resolve(
          new Response(JSON.stringify(mockShow), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      }
      if (url.includes('/episodes')) {
        return Promise.resolve(
          new Response(JSON.stringify([]), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      }
      return Promise.reject(new Error(`Unhandled: ${url}`));
    });

    renderShowDetailPage('1');

    await waitFor(() => {
      expect(screen.getByTestId('delete-season-101')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('delete-season-101'));

    expect(screen.getByText(/Confirm Deletion/i)).toBeInTheDocument();
    expect(screen.getByText(/Are you sure you want to delete/i)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('confirm-delete-season-btn'));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        '/seasons/101',
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    await waitFor(() => {
      expect(screen.queryByRole('option', { name: 'Season 1' })).not.toBeInTheDocument();
    });
  });

  it('handles empty seasons state and error states', async () => {
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
      if (url.includes('/shows/1/seasons')) {
        return Promise.resolve(
          new Response(JSON.stringify([]), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      }
      if (url.includes('/shows/1')) {
        return Promise.resolve(
          new Response(JSON.stringify(mockShow), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      }
      return Promise.reject(new Error(`Unhandled: ${url}`));
    });

    renderShowDetailPage('1');

    await waitFor(() => {
      expect(screen.getByTestId('seasons-empty')).toBeInTheDocument();
      expect(screen.getByText(/No seasons found for this show yet/i)).toBeInTheDocument();
    });
  });
});
