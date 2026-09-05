import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../context/AuthContext';
import { App } from '../App';

function renderApp(initialRoute = '/') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter initialEntries={[initialRoute]}>
          <App />
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

describe('CMS Auth & Navigation', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('redirects unauthenticated users to /login and renders footer outside card', async () => {
    renderApp('/');
    expect(await screen.findByText(/Sign in to manage catalog content/i)).toBeInTheDocument();
    const footer = screen.getByRole('contentinfo');
    expect(footer).toBeInTheDocument();
    expect(footer).toHaveTextContent('Made with ❤️ in India');
    // Ensure footer is outside the form card
    const form = screen.getByTestId('login-submit').closest('form');
    expect(form).not.toContainElement(footer);
  });

  it('shows error on invalid credentials (401)', async () => {
    vi.spyOn(window, 'fetch').mockImplementationOnce(() =>
      Promise.resolve(
        new Response(JSON.stringify({ detail: 'Invalid credentials' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );

    renderApp('/login');

    const usernameInput = screen.getByLabelText(/Username/i);
    const passwordInput = screen.getByLabelText(/Password/i);
    const submitBtn = screen.getByTestId('login-submit');

    fireEvent.change(usernameInput, { target: { value: 'wronguser' } });
    fireEvent.change(passwordInput, { target: { value: 'wrongpass' } });
    fireEvent.click(submitBtn);

    expect(
      await screen.findByText(/Invalid username or password/i)
    ).toBeInTheDocument();
  });

  it('handles successful login and redirects to Dashboard', async () => {
    vi.spyOn(window, 'fetch').mockImplementationOnce(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            access_token: 'fake-jwt-token',
            token_type: 'bearer',
            username: 'admin',
            role: 'admin',
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      )
    );

    renderApp('/login');

    const usernameInput = screen.getByLabelText(/Username/i);
    const passwordInput = screen.getByLabelText(/Password/i);
    const submitBtn = screen.getByTestId('login-submit');

    fireEvent.change(usernameInput, { target: { value: 'admin' } });
    fireEvent.change(passwordInput, { target: { value: 'admin123' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /dashboard/i })).toBeInTheDocument();
      expect(screen.getByTestId('current-username')).toHaveTextContent('admin');
      expect(screen.getByTestId('current-role')).toHaveTextContent('admin');
    });

    expect(window.localStorage.getItem('peblo_tv_cms_token')).toBe('fake-jwt-token');
  });

  it('allows logging out and redirects to /login', async () => {
    window.localStorage.setItem('peblo_tv_cms_token', 'test-token');
    window.localStorage.setItem(
      'peblo_tv_cms_user',
      JSON.stringify({ username: 'editor', role: 'editor' })
    );

    renderApp('/');

    await waitFor(() => {
      expect(screen.getByTestId('current-username')).toHaveTextContent('editor');
    });

    const logoutBtn = screen.getByTestId('logout-btn');
    fireEvent.click(logoutBtn);

    await waitFor(() => {
      expect(screen.getByText(/Sign in to manage catalog content/i)).toBeInTheDocument();
      expect(window.localStorage.getItem('peblo_tv_cms_token')).toBeNull();
    });
  });

  it('shows permission denied for editor on publish route', async () => {
    window.localStorage.setItem('peblo_tv_cms_token', 'editor-token');
    window.localStorage.setItem(
      'peblo_tv_cms_user',
      JSON.stringify({ username: 'editor_user', role: 'editor' })
    );

    renderApp('/publish');

    await waitFor(() => {
      expect(screen.getByTestId('permission-denied')).toBeInTheDocument();
      expect(screen.getByText(/Permission Denied \(403\)/i)).toBeInTheDocument();
    });
  });
});
