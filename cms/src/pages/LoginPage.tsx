import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { loginUser } from '../api/auth';
import { ApiError } from '../api/client';
import { TvIcon } from '../components/icons';

export const LoginPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/';

  React.useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, from]);

  const loginMutation = useMutation({
    mutationFn: loginUser,
    onSuccess: (data) => {
      login(data.access_token, { username: data.username, role: data.role });
      navigate(from, { replace: true });
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          setErrorMessage('Invalid username or password.');
        } else {
          setErrorMessage(err.message || 'Login failed. Please try again.');
        }
      } else if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('An unexpected error occurred. Please try again.');
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!username.trim() || !password) {
      setErrorMessage('Please enter both username and password.');
      return;
    }
    loginMutation.mutate({ username: username.trim(), password });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-[#0f172a] text-[#f8fafc]">
      <div className="w-full max-w-md bg-[#1e293b] border border-[#334155] rounded-xl p-8 shadow-2xl">
        <div className="text-center mb-6">
          <TvIcon className="w-10 h-10 text-indigo-400 mx-auto mb-2" />
          <h1 className="text-2xl font-bold tracking-tight text-[#f8fafc]">Peblo TV CMS</h1>
          <p className="text-slate-400 text-sm mt-1">Sign in to manage catalog content</p>
        </div>

        {errorMessage && (
          <div
            className="bg-red-500/10 border border-red-500 text-red-300 p-3 rounded-lg mb-5 text-sm"
            role="alert"
            data-testid="login-error"
          >
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="username" className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              disabled={loginMutation.isPending}
              autoComplete="username"
              required
              className="w-full px-3.5 py-2.5 rounded-lg bg-[#0f172a] border border-[#334155] text-[#f8fafc] text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder-slate-500"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              disabled={loginMutation.isPending}
              autoComplete="current-password"
              required
              className="w-full px-3.5 py-2.5 rounded-lg bg-[#0f172a] border border-[#334155] text-[#f8fafc] text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder-slate-500"
            />
          </div>

          <button
            type="submit"
            data-testid="login-submit"
            disabled={loginMutation.isPending}
            className="w-full mt-2 py-3 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-sm transition-all cursor-pointer shadow-sm flex items-center justify-center gap-2"
          >
            {loginMutation.isPending ? (
              <span className="inline-flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Signing in...
              </span>
            ) : (
              'Sign In'
            )}
          </button>
        </form>
      </div>

      <footer className="mt-8 text-center text-xs text-slate-500">
        Made with ❤️ in India
      </footer>
    </div>
  );
};
