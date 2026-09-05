import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthContext, AuthContextType } from '../context/AuthContext';
import { SeasonEpisodesSection } from '../components/SeasonEpisodesSection';
import { PublishSeriesModal } from '../components/PublishSeriesModal';
import { EpisodeFormModal } from '../components/EpisodeFormModal';
import { DashboardPage } from '../pages/DashboardPage';
import { Layout } from '../components/Layout';
import { Show } from '../types/show';
import { Season } from '../types/season';

describe('CMS UX & Publishing Workflow Improvements', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  const mockAdminAuth: AuthContextType = {
    user: { id: 1, username: 'admin_user', role: 'admin' },
    token: 'fake-admin-token',
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    isAuthenticated: true,
    isAdmin: true,
    isEditor: false,
  };

  const mockEditorAuth: AuthContextType = {
    user: { id: 2, username: 'editor_user', role: 'editor' },
    token: 'fake-editor-token',
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    isAuthenticated: true,
    isAdmin: false,
    isEditor: true,
  };

  const mockShow: Show = {
    id: 1,
    title: 'Rhyme Rangers',
    slug: 'rhyme-rangers',
    section: 'songs',
    description: 'Rhyme Rangers musical show',
    status: 'draft',
    categories: [],
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };


  const mockSeason: Season = {
    id: 10,
    show_id: 1,
    season_number: 1,
    title: 'Season 1',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    episodes: [
      {
        id: 101,
        season_id: 10,
        episode_id: 'rr-101-en',
        episode_number: 1,
        title: 'Wheels on the Bus',
        synopsis: 'Wheels on the bus synopsis',
        duration_seconds: 120,
        language: 'en',
        content_group: 'cg-rr-1',
        status: 'draft',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 102,
        season_id: 10,
        episode_id: 'rr-102-en',
        episode_number: 2,
        title: 'Old MacDonald',
        synopsis: 'Old MacDonald synopsis',
        duration_seconds: 150,
        language: 'en',
        content_group: 'cg-rr-2',
        status: 'published',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    ],
  };

  it('1. SeasonEpisodesSection displays [Publish] button only for draft episodes and publishes on click', async () => {
    vi.spyOn(window, 'fetch').mockImplementation((input, init) => {
      const url = String(input);
      if (url.includes('/seasons/10/episodes')) {
        return Promise.resolve(
          new Response(JSON.stringify(mockSeason.episodes), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      }
      if (url.includes('/episodes/rr-101-en') && init?.method === 'PATCH') {
        return Promise.resolve(
          new Response(
            JSON.stringify({ ...mockSeason.episodes![0], status: 'published' }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        );
      }
      return Promise.reject(new Error(`Unhandled fetch: ${url}`));
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider value={mockEditorAuth}>
          <BrowserRouter>
            <SeasonEpisodesSection season={mockSeason} />
          </BrowserRouter>
        </AuthContext.Provider>
      </QueryClientProvider>
    );

    // Wait for episodes to render
    await waitFor(() => {
      expect(screen.getByTestId('episode-row-rr-101-en')).toBeInTheDocument();
      expect(screen.getByTestId('episode-row-rr-102-en')).toBeInTheDocument();
    });

    // rr-101-en is draft -> should have Publish button
    const pubBtn = screen.getByTestId('publish-episode-rr-101-en');
    expect(pubBtn).toBeInTheDocument();
    expect(pubBtn).toHaveTextContent('Publish');

    // rr-102-en is published -> should NOT have Publish button
    expect(screen.queryByTestId('publish-episode-rr-102-en')).not.toBeInTheDocument();

    // Click publish on draft episode
    fireEvent.click(pubBtn);

    await waitFor(() => {
      expect(window.fetch).toHaveBeenCalledWith(
        '/episodes/rr-101-en',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ status: 'published' }),
        })
      );
    });
  });

  it('2. PublishSeriesModal displays show breakdown, draft count, and explicit disclaimer', async () => {
    vi.spyOn(window, 'fetch').mockImplementation((input, init) => {
      const url = String(input);
      if (url.includes('/shows/1/publish') && init?.method === 'POST') {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              show_id: 1,
              show_title: 'Rhyme Rangers',
              show_status: 'published',
              episodes_published_count: 1,
              message: 'Success',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        );
      }
      return Promise.reject(new Error(`Unhandled fetch: ${url}`));
    });

    const onClose = vi.fn();
    render(
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider value={mockEditorAuth}>
          <PublishSeriesModal
            isOpen={true}
            onClose={onClose}
            show={mockShow}
            seasons={[mockSeason]}
          />
        </AuthContext.Provider>
      </QueryClientProvider>
    );

    expect(screen.getByTestId('publish-series-modal')).toBeInTheDocument();
    expect(screen.getByTestId('publish-series-title')).toHaveTextContent('Rhyme Rangers');
    expect(screen.getByText(/Publishes this show only/i)).toBeInTheDocument();
    expect(screen.getByText(/Draft episodes remain in draft/i)).toBeInTheDocument();
    expect(
      screen.getByText(/does not deploy the live catalogue/i)
    ).toBeInTheDocument();

    const confirmBtn = screen.getByTestId('confirm-publish-series-btn');
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(window.fetch).toHaveBeenCalledWith(
        '/shows/1/publish',
        expect.objectContaining({ method: 'POST' })
      );
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('3. EpisodeFormModal displays artwork preview when editing an episode', async () => {
    vi.spyOn(window, 'fetch').mockImplementation((input) => {
      const url = String(input);
      if (url.includes('/episodes/rr-101-en/artwork')) {
        return Promise.resolve(
          new Response(
            JSON.stringify([
              {
                id: 1,
                episode_id: 101,
                artwork_type: 'poster',
                file_path: 'artwork/rr-101-en/poster.jpg',
                width: 600,
                height: 900,
                file_size: 150000,
                mime_type: 'image/jpeg',
              },
            ]),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        );
      }
      return Promise.reject(new Error(`Unhandled fetch: ${url}`));
    });

    render(
      <QueryClientProvider client={queryClient}>
        <EpisodeFormModal
          isOpen={true}
          onClose={vi.fn()}
          seasonId={10}
          episodeToEdit={mockSeason.episodes![0]}
        />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('episode-artwork-preview-section')).toBeInTheDocument();
      expect(screen.getByTestId('edit-artwork-img-poster')).toHaveAttribute(
        'src',
        '/artwork/rr-101-en/poster.jpg'
      );
      expect(screen.getByTestId('edit-modal-manage-artwork-btn')).toBeInTheDocument();
    });
  });

  it('4. DashboardPage renders operational metrics and catalogue status', async () => {
    vi.spyOn(window, 'fetch').mockImplementation((input) => {
      const url = String(input);
      if (url.includes('/admin/catalog/status')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              status: 'changes_pending',
              catalogue_version: 'v_20260904120000',
              last_published_at: '2026-09-04T12:00:00Z',
              shows_count: { total: 10, published: 8, draft: 2 },
              episodes_count: { total: 93, published: 92, draft: 1, unique: 73 },
              live_shows_count: 8,
              live_episodes_count: 72,
              validation_errors: [],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        );
      }
      if (url.includes('/admin/catalog/history')) {
        return Promise.resolve(
          new Response(JSON.stringify([]), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      }
      return Promise.reject(new Error(`Unhandled fetch: ${url}`));
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider value={mockAdminAuth}>
          <BrowserRouter>
            <DashboardPage />
          </BrowserRouter>
        </AuthContext.Provider>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('total-shows-count')).toHaveTextContent('10');
      expect(screen.getByTestId('published-shows-count')).toHaveTextContent('8');
      expect(screen.getByTestId('draft-shows-count')).toHaveTextContent('2');

      expect(screen.getByTestId('total-episodes-count')).toHaveTextContent('93');
      expect(screen.getByText('Episode Records')).toBeInTheDocument();
      expect(screen.getByTestId('unique-episodes-count')).toHaveTextContent('73');
      expect(screen.getByText('Unique Episodes')).toBeInTheDocument();
      expect(screen.getByTestId('published-episodes-count')).toHaveTextContent('92');
      expect(screen.getByText('Published Episodes')).toBeInTheDocument();

      expect(screen.getByTestId('dashboard-live-entries')).toHaveTextContent('72 Live Catalogue Episodes');
      expect(screen.getByTestId('dashboard-status-pending')).toBeInTheDocument();
      expect(screen.getByTestId('dashboard-catalogue-version')).toHaveTextContent(
        'v_20260904120000'
      );
    });
  });

  it('5. Layout renders global status indicator for both editor and admin', async () => {
    vi.spyOn(window, 'fetch').mockImplementation((input) => {
      const url = String(input);
      if (url.includes('/admin/catalog/status')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              status: 'live',
              catalogue_version: 'v_20260904120000',
              last_published_at: '2026-09-04T12:00:00Z',
              shows_count: { total: 5, published: 5, draft: 0 },
              episodes_count: { total: 20, published: 20, draft: 0 },
              validation_errors: [],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        );
      }
      return Promise.reject(new Error(`Unhandled fetch: ${url}`));
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider value={mockEditorAuth}>
          <BrowserRouter>
            <Layout />
          </BrowserRouter>
        </AuthContext.Provider>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('global-catalogue-status')).toBeInTheDocument();
      expect(screen.getByTestId('global-status-live')).toHaveTextContent('Live');
      // Editor does not see deploy action
      expect(screen.queryByTestId('global-publish-action-btn')).not.toBeInTheDocument();
    });
  });

  it('6. Layout renders Update Pending and Not Deployed simplified indicators', async () => {
    vi.spyOn(window, 'fetch').mockImplementation((input) => {
      const url = String(input);
      if (url.includes('/admin/catalog/status')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              status: 'changes_pending',
              catalogue_version: 'v_20260904120000',
              last_published_at: '2026-09-04T12:00:00Z',
              shows_count: { total: 5, published: 5, draft: 0 },
              episodes_count: { total: 20, published: 20, draft: 0 },
              validation_errors: [],
              pending_changes: { shows_changed: 1, episodes_changed: 1, artwork_changed: 0, total_changes: 2, details: [] },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        );
      }
      return Promise.reject(new Error(`Unhandled fetch: ${url}`));
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider value={mockAdminAuth}>
          <BrowserRouter>
            <Layout />
          </BrowserRouter>
        </AuthContext.Provider>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('global-status-pending')).toHaveTextContent('Update Pending');
      expect(screen.getByTestId('global-publish-action-btn')).toBeInTheDocument();
    });
  });
});
