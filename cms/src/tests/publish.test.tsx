import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../context/AuthContext';
import { App } from '../App';

function renderPublishPage(initialRole = 'admin', initialUsername = 'admin_user') {
  window.localStorage.setItem('peblo_tv_cms_token', 'mock-token');
  window.localStorage.setItem(
    'peblo_tv_cms_user',
    JSON.stringify({ username: initialUsername, role: initialRole })
  );

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter initialEntries={['/publish']}>
          <App />
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

describe('CMS Catalogue Publishing', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  const mockGetMe = (role = 'admin', username = 'admin_user') => ({
    id: 1,
    username,
    role,
  });

  const mockCatalogStatus = {
    exists: true,
    version: 'v_20260904150000',
    generated_at: '2026-09-04T15:00:00Z',
    has_pending_changes: false,
    live_shows_count: 5,
    live_episodes_count: 12,
  };

  it('allows admin user to access publish page with controls, rules, and history', async () => {
    vi.spyOn(window, 'fetch').mockImplementation((input) => {
      const url = String(input);
      if (url.includes('/auth/me')) {
        return Promise.resolve(
          new Response(JSON.stringify(mockGetMe('admin', 'admin_user')), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      }
      if (url.includes('/admin/catalog/status')) {
        return Promise.resolve(
          new Response(JSON.stringify(mockCatalogStatus), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
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
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });

    renderPublishPage('admin', 'admin_user');

    await waitFor(() => {
      expect(screen.getByTestId('publish-page-admin')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /Deploy to Viewer|Publish Catalogue/i })).toBeInTheDocument();
      expect(screen.getByTestId('publish-preflight-rules')).toBeInTheDocument();
      expect(screen.getByTestId('publish-catalog-btn')).toBeInTheDocument();
      expect(screen.getByTestId('publish-history-empty')).toBeInTheDocument();
    });
  });

  it('shows clear permission denied (403) state for editor users', async () => {
    vi.spyOn(window, 'fetch').mockImplementation((input) => {
      const url = String(input);
      if (url.includes('/auth/me')) {
        return Promise.resolve(
          new Response(JSON.stringify(mockGetMe('editor', 'editor_user')), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      }
      if (url.includes('/admin/catalog/status')) {
        return Promise.resolve(
          new Response(JSON.stringify(mockCatalogStatus), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });

    renderPublishPage('editor', 'editor_user');

    await waitFor(() => {
      expect(screen.getByTestId('publish-page-editor')).toBeInTheDocument();
      expect(screen.getByTestId('permission-denied')).toBeInTheDocument();
      expect(screen.getByText(/Permission Denied \(403\)/i)).toBeInTheDocument();
      expect(screen.getByTestId('permission-denied')).toHaveTextContent('editor_user');
      expect(screen.queryByTestId('publish-catalog-btn')).not.toBeInTheDocument();
    });
  });

  it('handles successful catalogue publishing and updates history & metrics', async () => {
    const mockPublishResponse = {
      status: 'success',
      catalogue_version: 'v_20260904160000',
      shows_count: 5,
      episodes_count: 12,
      catalog: {
        sections: [
          {
            name: 'series',
            shows: [],
          },
        ],
      },
    };

    let historyItems = [
      {
        id: 1,
        status: 'success',
        triggered_by: 'admin_user',
        catalogue_version: 'v_20260904150000',
        shows_count: 4,
        episodes_count: 10,
        started_at: '2026-09-04T15:00:00Z',
        completed_at: '2026-09-04T15:00:01Z',
        summary: 'Previous run',
      },
    ];

    vi.spyOn(window, 'fetch').mockImplementation((input) => {
      const url = String(input);
      if (url.includes('/auth/me')) {
        return Promise.resolve(
          new Response(JSON.stringify(mockGetMe('admin', 'admin_user')), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      }
      if (url.includes('/admin/catalog/status')) {
        return Promise.resolve(
          new Response(JSON.stringify(mockCatalogStatus), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      }
      if (url.includes('/admin/catalog/history')) {
        return Promise.resolve(
          new Response(JSON.stringify(historyItems), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      }
      if (url.includes('/admin/catalog/publish')) {
        historyItems = [
          {
            id: 2,
            status: 'success',
            triggered_by: 'admin_user',
            catalogue_version: 'v_20260904160000',
            shows_count: 5,
            episodes_count: 12,
            started_at: '2026-09-04T16:00:00Z',
            completed_at: '2026-09-04T16:00:01Z',
            summary: 'Successfully published catalogue v_20260904160000',
          },
          ...historyItems,
        ];
        return Promise.resolve(
          new Response(JSON.stringify(mockPublishResponse), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });

    renderPublishPage('admin');

    const publishBtn = await screen.findByTestId('publish-catalog-btn');
    fireEvent.click(publishBtn);

    await waitFor(() => {
      expect(screen.getByTestId('publish-success-card')).toBeInTheDocument();
      expect(screen.getByTestId('success-catalogue-version')).toHaveTextContent('v_20260904160000');
      expect(screen.getByTestId('success-shows-count')).toHaveTextContent('5');
      expect(screen.getByTestId('success-episodes-count')).toHaveTextContent('12');
    });

    // Check history table updated with backend fetched data
    await waitFor(() => {
      expect(screen.getByTestId('publish-history-table')).toBeInTheDocument();
      expect(screen.getByTestId('history-row-0')).toBeInTheDocument();
      expect(screen.getAllByText('v_20260904160000')).toHaveLength(2);
    });
  });

  it('displays human-readable validation errors on 422 failure', async () => {
    const mockValidationFailure = {
      detail: {
        message: 'Catalogue publish validation failed',
        errors: [
          {
            entity_type: 'show',
            entity_id: 1,
            title: 'Cosmic Quest',
            error: "Published show 'Cosmic Quest' has invalid or missing section ''",
          },
          {
            entity_type: 'episode',
            entity_id: 101,
            title: 'Pilot Episode',
            error: "Published episode 'Pilot Episode' is missing duration",
          },
          {
            entity_type: 'episode',
            entity_id: 102,
            title: 'Chapter Two',
            error: "Published episode 'Chapter Two' is missing required artwork: poster, banner",
          },
        ],
      },
    };

    let historyItems: any[] = [];

    vi.spyOn(window, 'fetch').mockImplementation((input) => {
      const url = String(input);
      if (url.includes('/auth/me')) {
        return Promise.resolve(
          new Response(JSON.stringify(mockGetMe('admin', 'admin_user')), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      }
      if (url.includes('/admin/catalog/status')) {
        return Promise.resolve(
          new Response(JSON.stringify(mockCatalogStatus), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      }
      if (url.includes('/admin/catalog/history')) {
        return Promise.resolve(
          new Response(JSON.stringify(historyItems), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      }
      if (url.includes('/admin/catalog/publish')) {
        historyItems = [
          {
            id: 1,
            status: 'failed',
            triggered_by: 'admin_user',
            catalogue_version: null,
            shows_count: 0,
            episodes_count: 0,
            started_at: '2026-09-04T16:05:00Z',
            completed_at: '2026-09-04T16:05:01Z',
            summary: 'Validation failed with 3 error(s)',
          },
        ];
        return Promise.resolve(
          new Response(JSON.stringify(mockValidationFailure), {
            status: 422,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });

    renderPublishPage('admin');

    const publishBtn = await screen.findByTestId('publish-catalog-btn');
    fireEvent.click(publishBtn);

    await waitFor(() => {
      expect(screen.getByTestId('publish-validation-report')).toBeInTheDocument();
      expect(screen.getByText(/Validation Failed \(3 issues\)/i)).toBeInTheDocument();
      expect(screen.getByTestId('validation-error-0')).toHaveTextContent("Published show 'Cosmic Quest' has invalid or missing section ''");
      expect(screen.getByTestId('validation-error-1')).toHaveTextContent("Published episode 'Pilot Episode' is missing duration");
      expect(screen.getByTestId('validation-error-2')).toHaveTextContent("Published episode 'Chapter Two' is missing required artwork: poster, banner");
    });

    // Verify failed run was logged and refetched in history
    await waitFor(() => {
      expect(screen.getByTestId('publish-history-table')).toBeInTheDocument();
      expect(screen.getByText(/Validation failed with 3 error\(s\)/i)).toBeInTheDocument();
    });
  });

  it('shows loading state and prevents duplicate submission while publishing is in flight', async () => {
    let resolvePublish: (value: Response) => void;
    const publishPromise = new Promise<Response>((resolve) => {
      resolvePublish = resolve;
    });

    const fetchSpy = vi.spyOn(window, 'fetch').mockImplementation((input) => {
      const url = String(input);
      if (url.includes('/auth/me')) {
        return Promise.resolve(
          new Response(JSON.stringify(mockGetMe('admin', 'admin_user')), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      }
      if (url.includes('/admin/catalog/status')) {
        return Promise.resolve(
          new Response(JSON.stringify(mockCatalogStatus), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
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
      if (url.includes('/admin/catalog/publish')) {
        return publishPromise;
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });

    renderPublishPage('admin');

    await waitFor(() => {
      expect(screen.getByTestId('current-username')).toHaveTextContent('admin_user');
    });

    const publishBtn = screen.getByTestId('publish-catalog-btn');
    expect(publishBtn).not.toBeDisabled();

    fireEvent.click(publishBtn);

    // Verify button is disabled and loading state rendered
    await waitFor(() => {
      expect(screen.getByTestId('publish-loading-state')).toBeInTheDocument();
      expect(publishBtn).toBeDisabled();
      expect(screen.getByText(/Deploying to Viewer...|Publishing Catalogue.../i)).toBeInTheDocument();
    });

    const publishCallsBefore = fetchSpy.mock.calls.filter((c) => String(c[0]).includes('/admin/catalog/publish'));
    expect(publishCallsBefore).toHaveLength(1);

    // Click again while in-flight (duplicate submission prevention)
    fireEvent.click(publishBtn);
    const publishCallsAfter = fetchSpy.mock.calls.filter((c) => String(c[0]).includes('/admin/catalog/publish'));
    expect(publishCallsAfter).toHaveLength(1);

    // Resolve in-flight request
    resolvePublish!(
      new Response(
        JSON.stringify({
          status: 'success',
          catalogue_version: 'v_123',
          shows_count: 1,
          episodes_count: 1,
          catalog: { sections: [] },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    await waitFor(() => {
      expect(screen.queryByTestId('publish-loading-state')).not.toBeInTheDocument();
      expect(screen.getByTestId('publish-success-card')).toBeInTheDocument();
      expect(publishBtn).not.toBeDisabled();
    });
  });

  it('displays readable error on server failure (500)', async () => {
    vi.spyOn(window, 'fetch').mockImplementation((input) => {
      const url = String(input);
      if (url.includes('/auth/me')) {
        return Promise.resolve(
          new Response(JSON.stringify(mockGetMe('admin', 'admin_user')), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      }
      if (url.includes('/admin/catalog/status')) {
        return Promise.resolve(
          new Response(JSON.stringify(mockCatalogStatus), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
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
      if (url.includes('/admin/catalog/publish')) {
        return Promise.resolve(
          new Response(JSON.stringify({ detail: 'Internal database transaction error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });

    renderPublishPage('admin');

    const publishBtn = await screen.findByTestId('publish-catalog-btn');
    fireEvent.click(publishBtn);

    await waitFor(() => {
      expect(screen.getByTestId('publish-error-alert')).toBeInTheDocument();
      expect(screen.getByText(/Internal database transaction error/i)).toBeInTheDocument();
    });
  });

  it('displays history error state and allows retry', async () => {
    let historyCallCount = 0;
    vi.spyOn(window, 'fetch').mockImplementation((input) => {
      const url = String(input);
      if (url.includes('/auth/me')) {
        return Promise.resolve(
          new Response(JSON.stringify(mockGetMe('admin', 'admin_user')), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      }
      if (url.includes('/admin/catalog/status')) {
        return Promise.resolve(
          new Response(JSON.stringify(mockCatalogStatus), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      }
      if (url.includes('/admin/catalog/history')) {
        historyCallCount++;
        if (historyCallCount === 1) {
          return Promise.resolve(
            new Response(JSON.stringify({ detail: 'Failed to fetch history' }), {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            })
          );
        }
        return Promise.resolve(
          new Response(
            JSON.stringify([
              {
                id: 1,
                status: 'success',
                triggered_by: 'admin_user',
                catalogue_version: 'v_recovered',
                shows_count: 1,
                episodes_count: 2,
                started_at: '2026-09-04T12:00:00Z',
                completed_at: '2026-09-04T12:00:01Z',
                summary: 'Recovered run',
              },
            ]),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }
          )
        );
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });

    renderPublishPage('admin');

    await waitFor(() => {
      expect(screen.getByTestId('publish-history-error')).toBeInTheDocument();
      expect(screen.getByTestId('history-retry-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('history-retry-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('publish-history-table')).toBeInTheDocument();
      expect(screen.getByText('v_recovered')).toBeInTheDocument();
    });
  });

  it('renders pending changes summary with affected breakdown and allows deployment', async () => {
    const mockPendingStatus = {
      status: 'changes_pending',
      catalogue_version: 'v_20260904120000',
      last_published_at: '2026-09-04T12:00:00Z',
      shows_count: { total: 2, published: 2, draft: 0 },
      episodes_count: { total: 4, published: 4, draft: 0 },
      live_shows_count: 2,
      live_episodes_count: 3,
      validation_errors: [],
      pending_changes: {
        shows_changed: 2,
        episodes_changed: 1,
        artwork_changed: 1,
        total_changes: 4,
        details: [
          {
            show_title: 'Rhyme Rangers',
            changes: ['Episode "The Lost Kite" published', 'Thumbnail updated'],
          },
          {
            show_title: "Moti's Many Lives",
            changes: ['Episode "Rain on the Roof" updated'],
          },
        ],
      },
    };

    const fetchSpy = vi.spyOn(window, 'fetch').mockImplementation((input) => {
      const url = String(input);
      if (url.includes('/auth/me')) {
        return Promise.resolve(
          new Response(JSON.stringify(mockGetMe('admin', 'admin_user')), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      }
      if (url.includes('/admin/catalog/status')) {
        return Promise.resolve(
          new Response(JSON.stringify(mockPendingStatus), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
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
      if (url.includes('/admin/catalog/publish')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              status: 'success',
              catalogue_version: 'v_new_deployed',
              shows_count: 2,
              episodes_count: 4,
              catalog: { sections: [] },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        );
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });

    renderPublishPage('admin');

    await waitFor(() => {
      expect(screen.getByTestId('pending-changes-summary')).toBeInTheDocument();
      expect(screen.getByTestId('pending-shows-count')).toHaveTextContent('2');
      expect(screen.getByTestId('pending-episodes-count')).toHaveTextContent('1');
      expect(screen.getByTestId('pending-artwork-count')).toHaveTextContent('1');
      expect(screen.getByTestId('pending-total-changes')).toHaveTextContent('4');
      expect(screen.getByText('Rhyme Rangers')).toBeInTheDocument();
      expect(screen.getByText(/Episode "The Lost Kite" published/i)).toBeInTheDocument();
      expect(screen.getByText("Moti's Many Lives")).toBeInTheDocument();
    });

    const deployBtn = screen.getByTestId('publish-catalog-btn');
    expect(deployBtn).toHaveTextContent(/Deploy to Viewer|Deploy Pending Changes/i);

    fireEvent.click(deployBtn);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        '/admin/catalog/publish',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });
});
