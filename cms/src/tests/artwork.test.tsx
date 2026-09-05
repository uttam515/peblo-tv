import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../context/AuthContext';
import { EpisodeArtworkModal } from '../components/EpisodeArtworkModal';
import { Episode } from '../types/episode';
import { Artwork } from '../types/artwork';

const mockEpisode: Episode = {
  id: 1001,
  episode_id: 'ep-101-en',
  season_id: 10,
  episode_number: 1,
  title: 'Pilot Episode',
  synopsis: 'Pilot synopsis',
  duration_seconds: 120,
  language: 'en',
  content_group: 'cg-pilot',
  status: 'published',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const mockExistingArtwork: Artwork[] = [
  {
    id: 1,
    episode_id: 1001,
    artwork_type: 'poster',
    file_path: 'artwork/ep-101-en/poster.jpg',
    width: 600,
    height: 900,
    file_size: 153600, // 150 KB
    mime_type: 'image/jpeg',
    created_at: '2026-01-02T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
  },
];

function renderArtworkModal(props = {}) {
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
        <EpisodeArtworkModal
          isOpen={true}
          onClose={vi.fn()}
          episode={mockEpisode}
          {...props}
        />
      </AuthProvider>
    </QueryClientProvider>
  );
}

describe('CMS Artwork Management', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockGetMe = () => ({
    id: 1,
    username: 'editor_user',
    role: 'editor',
  });

  it('renders all three artwork slots with specifications', async () => {
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
      if (url.includes('/episodes/ep-101-en/artwork')) {
        return Promise.resolve(
          new Response(JSON.stringify([]), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      }
      return Promise.reject(new Error(`Unhandled: ${url}`));
    });

    renderArtworkModal();

    await waitFor(() => {
      expect(screen.getByTestId('artwork-slot-poster')).toBeInTheDocument();
      expect(screen.getByTestId('artwork-slot-banner')).toBeInTheDocument();
      expect(screen.getByTestId('artwork-slot-thumbnail')).toBeInTheDocument();
    });

    expect(screen.getByText(/600 × 900 \(2:3\)/i)).toBeInTheDocument();
    expect(screen.getByText(/1280 × 720 \(16:9\)/i)).toBeInTheDocument();
    expect(screen.getByText(/640 × 360 \(16:9\)/i)).toBeInTheDocument();
  });

  it('displays existing artwork metadata for uploaded slots', async () => {
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
      if (url.includes('/episodes/ep-101-en/artwork')) {
        return Promise.resolve(
          new Response(JSON.stringify(mockExistingArtwork), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      }
      return Promise.reject(new Error(`Unhandled: ${url}`));
    });

    renderArtworkModal();

    await waitFor(() => {
      expect(screen.getByTestId('artwork-status-poster')).toHaveTextContent('Uploaded');
      expect(screen.getByTestId('artwork-metadata-poster')).toHaveTextContent('600 × 900 px');
      expect(screen.getByTestId('artwork-metadata-poster')).toHaveTextContent('150.0 KB');
      expect(screen.getByTestId('artwork-metadata-poster')).toHaveTextContent('image/jpeg');

      expect(screen.getByTestId('artwork-status-banner')).toHaveTextContent('Missing');
      expect(screen.getByTestId('artwork-status-thumbnail')).toHaveTextContent('Missing');
    });
  });

  it('handles client-side invalid file type and file size', async () => {
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
      if (url.includes('/episodes/ep-101-en/artwork')) {
        return Promise.resolve(
          new Response(JSON.stringify([]), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      }
      return Promise.reject(new Error(`Unhandled: ${url}`));
    });

    renderArtworkModal();

    await waitFor(() => {
      expect(screen.getByTestId('artwork-slot-poster')).toBeInTheDocument();
    });

    // Test invalid format (e.g. text/plain or gif)
    const fileInput = screen.getByTestId('file-input-poster');
    const invalidFile = new File(['dummy'], 'test.gif', { type: 'image/gif' });

    fireEvent.change(fileInput, { target: { files: [invalidFile] } });

    expect(
      await screen.findByText(/Invalid file type. Only JPEG, PNG, and WebP are supported/i)
    ).toBeInTheDocument();

    // Test file size > 200 KB
    const bigContent = new Uint8Array(250 * 1024);
    const bigFile = new File([bigContent], 'large.png', { type: 'image/png' });

    fireEvent.change(fileInput, { target: { files: [bigFile] } });

    expect(
      await screen.findByText(/File is too large/i)
    ).toBeInTheDocument();
  });

  it('uploads valid artwork and refreshes list', async () => {
    let currentArtworks: Artwork[] = [];

    // Mock URL.createObjectURL
    window.URL.createObjectURL = vi.fn(() => 'blob:mock-preview-url');

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
      if (url.includes('/episodes/ep-101-en/artwork') && method === 'POST') {
        const uploaded: Artwork = {
          id: 2,
          episode_id: 1001,
          artwork_type: 'banner',
          file_path: 'artwork/ep-101-en/banner.png',
          width: 1280,
          height: 720,
          file_size: 180000,
          mime_type: 'image/png',
          created_at: '2026-01-03T00:00:00Z',
          updated_at: '2026-01-03T00:00:00Z',
        };
        currentArtworks = [uploaded];
        return Promise.resolve(
          new Response(JSON.stringify(uploaded), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      }
      if (url.includes('/episodes/ep-101-en/artwork') && method === 'GET') {
        return Promise.resolve(
          new Response(JSON.stringify(currentArtworks), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      }
      return Promise.reject(new Error(`Unhandled: ${url}`));
    });

    renderArtworkModal();

    await waitFor(() => {
      expect(screen.getByTestId('artwork-status-banner')).toHaveTextContent('Missing');
    });

    const fileInput = screen.getByTestId('file-input-banner');
    const validFile = new File(['valid_image_data'], 'banner.png', { type: 'image/png' });

    // Selecting a file immediately initiates the upload automatically
    fireEvent.change(fileInput, { target: { files: [validFile] } });

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        '/episodes/ep-101-en/artwork',
        expect.objectContaining({ method: 'POST' })
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('artwork-status-banner')).toHaveTextContent('Uploaded');
    });
  });

  it('displays backend validation errors clearly', async () => {
    window.URL.createObjectURL = vi.fn(() => 'blob:mock-preview-url');

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
      if (url.includes('/episodes/ep-101-en/artwork') && method === 'POST') {
        return Promise.resolve(
          new Response(
            JSON.stringify({ detail: 'Poster must be exactly 600x900 pixels.' }),
            { status: 422, headers: { 'Content-Type': 'application/json' } }
          )
        );
      }
      if (url.includes('/episodes/ep-101-en/artwork')) {
        return Promise.resolve(
          new Response(JSON.stringify([]), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      }
      return Promise.reject(new Error(`Unhandled: ${url}`));
    });

    renderArtworkModal();

    await waitFor(() => {
      expect(screen.getByTestId('artwork-slot-poster')).toBeInTheDocument();
    });

    const fileInput = screen.getByTestId('file-input-poster');
    const file = new File(['data'], 'wrong_dim.jpg', { type: 'image/jpeg' });

    // Selecting file immediately attempts upload and receives 422 error
    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(
      await screen.findByText('Poster must be exactly 600x900 pixels.')
    ).toBeInTheDocument();
  });

  it('deletes artwork with confirmation dialog', async () => {
    let currentArtworks = [...mockExistingArtwork];

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
      if (url.includes('/episodes/ep-101-en/artwork/poster') && method === 'DELETE') {
        currentArtworks = [];
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      if (url.includes('/episodes/ep-101-en/artwork')) {
        return Promise.resolve(
          new Response(JSON.stringify(currentArtworks), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      }
      return Promise.reject(new Error(`Unhandled: ${url}`));
    });

    renderArtworkModal();

    await waitFor(() => {
      expect(screen.getByTestId('delete-artwork-btn-poster')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('delete-artwork-btn-poster'));

    expect(screen.getByText(/Confirm Deletion/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Are you sure you want to delete the/i)
    ).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('confirm-delete-artwork-btn'));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        '/episodes/ep-101-en/artwork/poster',
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('artwork-status-poster')).toHaveTextContent('Missing');
    });
  });
});
