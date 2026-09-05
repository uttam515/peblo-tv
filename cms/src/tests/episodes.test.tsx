import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../context/AuthContext';
import { ShowDetailPage } from '../pages/ShowDetailPage';

const mockShow = {
  id: 1,
  title: 'Cosmic Adventures',
  slug: 'cosmic-adventures',
  section: 'series',
  description: 'An epic adventure in outer space',
  status: 'published',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-02T00:00:00Z',
  categories: [{ id: 10, name: 'Sci-Fi', slug: 'sci-fi' }],
};

const mockSeasons = [
  {
    id: 10,
    show_id: 1,
    season_number: 1,
    title: 'Season 1',
    created_at: '2026-01-02T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
  },
];

const mockEpisodes = [
  {
    id: 1001,
    episode_id: 'ep-101-en',
    season_id: 10,
    episode_number: 1,
    title: 'Pilot: English Edition',
    synopsis: 'The adventure begins in English',
    duration_seconds: 120,
    language: 'en',
    content_group: 'cg-pilot',
    status: 'published',
    created_at: '2026-01-03T00:00:00Z',
    updated_at: '2026-01-03T00:00:00Z',
  },
  {
    id: 1002,
    episode_id: 'ep-101-hi',
    season_id: 10,
    episode_number: 1,
    title: 'Pilot: Hindi Edition',
    synopsis: 'The adventure begins in Hindi',
    duration_seconds: 120,
    language: 'hi',
    content_group: 'cg-pilot',
    status: 'published',
    created_at: '2026-01-03T00:00:00Z',
    updated_at: '2026-01-03T00:00:00Z',
  },
];

function renderShowDetail() {
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
        <MemoryRouter initialEntries={['/shows/1']}>
          <Routes>
            <Route path="/shows/:showId" element={<ShowDetailPage />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

describe('CMS Episode Management', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockGetMe = () => ({
    id: 1,
    username: 'editor_user',
    role: 'editor',
  });

  it('renders show details and displays episodes in the episode table', async () => {
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
      if (url.includes('/seasons/10/episodes')) {
        return Promise.resolve(
          new Response(JSON.stringify(mockEpisodes), {
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

    renderShowDetail();

    await waitFor(() => {
      expect(screen.getByTestId('show-title')).toHaveTextContent('Cosmic Adventures');
      expect(screen.getByTestId('season-select')).toHaveValue('10');
      expect(screen.getByText('Pilot: English Edition')).toBeInTheDocument();
      expect(screen.getByText('Pilot: Hindi Edition')).toBeInTheDocument();
      expect(screen.getByTestId('episode-id-ep-101-en')).toHaveTextContent('ep-101-en');
      expect(screen.getByTestId('episode-id-ep-101-hi')).toHaveTextContent('ep-101-hi');
      expect(screen.getByTestId('episode-lang-ep-101-en')).toHaveTextContent('EN');
      expect(screen.getByTestId('episode-lang-ep-101-hi')).toHaveTextContent('HI');
    });

    // Published episodes should only have Edit and Delete (no published button)
    expect(screen.getByTestId('edit-episode-ep-101-en')).toBeInTheDocument();
    expect(screen.getByTestId('delete-episode-ep-101-en')).toBeInTheDocument();
    expect(screen.queryByTestId('publish-episode-ep-101-en')).not.toBeInTheDocument();
  });

  it('creates a new episode and refetches episode list', async () => {
    let currentEpisodes = [...mockEpisodes];

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
      if (url.includes('/seasons/10/episodes') && method === 'POST') {
        const body = JSON.parse(init?.body as string);
        const created = {
          id: 1003,
          season_id: 10,
          ...body,
          created_at: '2026-01-04T00:00:00Z',
          updated_at: '2026-01-04T00:00:00Z',
        };
        currentEpisodes = [...currentEpisodes, created];
        return Promise.resolve(
          new Response(JSON.stringify(created), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      }
      if (url.includes('/seasons/10/episodes') && method === 'GET') {
        return Promise.resolve(
          new Response(JSON.stringify(currentEpisodes), {
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

    renderShowDetail();

    await waitFor(() => {
      expect(screen.getByTestId('create-episode-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('create-episode-btn'));

    const idInput = screen.getByLabelText(/Episode ID/i);
    const numInput = screen.getByLabelText(/Episode Number/i);
    const titleInput = screen.getByLabelText(/^Title/i);
    const cgInput = screen.getByLabelText(/Content Group/i);
    const langSelect = screen.getByLabelText(/Language/i);
    const statusSelect = screen.getByLabelText(/Status/i);
    const durationInput = screen.getByLabelText(/Duration/i);
    const saveBtn = screen.getByTestId('save-episode-btn');

    fireEvent.change(idInput, { target: { value: 'ep-102-en' } });
    fireEvent.change(numInput, { target: { value: '2' } });
    fireEvent.change(titleInput, { target: { value: 'Episode 2: Exploration' } });
    fireEvent.change(cgInput, { target: { value: 'cg-ep2' } });
    fireEvent.change(langSelect, { target: { value: 'en' } });
    fireEvent.change(statusSelect, { target: { value: 'published' } });
    fireEvent.change(durationInput, { target: { value: '180' } });

    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        '/seasons/10/episodes',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            episode_id: 'ep-102-en',
            episode_number: 2,
            title: 'Episode 2: Exploration',
            content_group: 'cg-ep2',
            language: 'en',
            status: 'published',
            duration_seconds: 180,
            synopsis: null,
          }),
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByText('Episode 2: Exploration')).toBeInTheDocument();
    });
  });

  it('validates that published episode requires duration', async () => {
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
      if (url.includes('/seasons/10/episodes')) {
        return Promise.resolve(
          new Response(JSON.stringify(mockEpisodes), {
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

    renderShowDetail();

    await waitFor(() => {
      expect(screen.getByTestId('create-episode-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('create-episode-btn'));

    const idInput = screen.getByLabelText(/Episode ID/i);
    const titleInput = screen.getByLabelText(/^Title/i);
    const cgInput = screen.getByLabelText(/Content Group/i);
    const statusSelect = screen.getByLabelText(/Status/i);
    const saveBtn = screen.getByTestId('save-episode-btn');

    fireEvent.change(idInput, { target: { value: 'ep-test' } });
    fireEvent.change(titleInput, { target: { value: 'Test Episode' } });
    fireEvent.change(cgInput, { target: { value: 'cg-test' } });
    fireEvent.change(statusSelect, { target: { value: 'published' } });

    fireEvent.click(saveBtn);

    expect(
      await screen.findByText('Published episodes must have a valid duration in seconds.')
    ).toBeInTheDocument();
  });

  it('displays 409 conflict error on duplicate episode_id', async () => {
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
      if (url.includes('/seasons/10/episodes') && method === 'POST') {
        return Promise.resolve(
          new Response(
            JSON.stringify({ detail: "Episode with episode_id 'ep-101-en' already exists" }),
            { status: 409, headers: { 'Content-Type': 'application/json' } }
          )
        );
      }
      if (url.includes('/seasons/10/episodes')) {
        return Promise.resolve(
          new Response(JSON.stringify(mockEpisodes), {
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

    renderShowDetail();

    await waitFor(() => {
      expect(screen.getByTestId('create-episode-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('create-episode-btn'));

    const idInput = screen.getByLabelText(/Episode ID/i);
    const titleInput = screen.getByLabelText(/^Title/i);
    const cgInput = screen.getByLabelText(/Content Group/i);
    const saveBtn = screen.getByTestId('save-episode-btn');

    fireEvent.change(idInput, { target: { value: 'ep-101-en' } });
    fireEvent.change(titleInput, { target: { value: 'Duplicate Episode' } });
    fireEvent.change(cgInput, { target: { value: 'cg-dup' } });

    fireEvent.click(saveBtn);

    expect(
      await screen.findByText("Episode with episode_id 'ep-101-en' already exists")
    ).toBeInTheDocument();
  });

  it('displays 409 conflict error on duplicate (content_group, language)', async () => {
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
      if (url.includes('/seasons/10/episodes') && method === 'POST') {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              detail:
                "Episode with content_group 'cg-pilot' and language 'en' already exists",
            }),
            { status: 409, headers: { 'Content-Type': 'application/json' } }
          )
        );
      }
      if (url.includes('/seasons/10/episodes')) {
        return Promise.resolve(
          new Response(JSON.stringify(mockEpisodes), {
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

    renderShowDetail();

    await waitFor(() => {
      expect(screen.getByTestId('create-episode-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('create-episode-btn'));

    const idInput = screen.getByLabelText(/Episode ID/i);
    const titleInput = screen.getByLabelText(/^Title/i);
    const cgInput = screen.getByLabelText(/Content Group/i);
    const saveBtn = screen.getByTestId('save-episode-btn');

    fireEvent.change(idInput, { target: { value: 'ep-diff-id' } });
    fireEvent.change(titleInput, { target: { value: 'Pilot Alt' } });
    fireEvent.change(cgInput, { target: { value: 'cg-pilot' } });

    fireEvent.click(saveBtn);

    expect(
      await screen.findByText(
        "Episode with content_group 'cg-pilot' and language 'en' already exists"
      )
    ).toBeInTheDocument();
  });

  it('edits an episode with PATCH', async () => {
    let currentEpisodes = [...mockEpisodes];

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
      if (url.includes('/episodes/ep-101-en') && method === 'PATCH') {
        const body = JSON.parse(init?.body as string);
        const updated = { ...currentEpisodes[0], ...body };
        currentEpisodes[0] = updated;
        return Promise.resolve(
          new Response(JSON.stringify(updated), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      }
      if (url.includes('/seasons/10/episodes')) {
        return Promise.resolve(
          new Response(JSON.stringify(currentEpisodes), {
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

    renderShowDetail();

    await waitFor(() => {
      expect(screen.getByTestId('edit-episode-ep-101-en')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('edit-episode-ep-101-en'));

    const titleInput = screen.getByLabelText(/^Title/i);
    expect(titleInput).toHaveValue('Pilot: English Edition');

    fireEvent.change(titleInput, { target: { value: 'Pilot: English (Remastered)' } });
    fireEvent.click(screen.getByTestId('save-episode-btn'));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        '/episodes/ep-101-en',
        expect.objectContaining({ method: 'PATCH' })
      );
    });

    await waitFor(() => {
      expect(screen.getByText('Pilot: English (Remastered)')).toBeInTheDocument();
    });
  });

  it('deletes an episode with confirmation dialog', async () => {
    let currentEpisodes = [...mockEpisodes];

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
      if (url.includes('/episodes/ep-101-en') && method === 'DELETE') {
        currentEpisodes = currentEpisodes.filter((e) => e.episode_id !== 'ep-101-en');
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      if (url.includes('/seasons/10/episodes')) {
        return Promise.resolve(
          new Response(JSON.stringify(currentEpisodes), {
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

    renderShowDetail();

    await waitFor(() => {
      expect(screen.getByTestId('delete-episode-ep-101-en')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('delete-episode-ep-101-en'));

    expect(screen.getByText(/Confirm Deletion/i)).toBeInTheDocument();
    expect(screen.getByText(/Are you sure you want to delete Episode #1/i)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('confirm-delete-episode-btn'));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        '/episodes/ep-101-en',
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    await waitFor(() => {
      expect(screen.queryByText('Pilot: English Edition')).not.toBeInTheDocument();
    });
  });

  it('handles empty episodes state', async () => {
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
      if (url.includes('/seasons/10/episodes')) {
        return Promise.resolve(
          new Response(JSON.stringify([]), {
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

    renderShowDetail();

    await waitFor(() => {
      expect(screen.getByTestId('episodes-empty')).toBeInTheDocument();
      expect(screen.getByText(/No episodes found in this season yet/i)).toBeInTheDocument();
    });
  });
});
