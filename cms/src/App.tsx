import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ShowsPage } from './pages/ShowsPage';
import { ShowDetailPage } from './pages/ShowDetailPage';
import { PublishPage } from './pages/PublishPage';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';

export const App: React.FC = () => {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/shows" element={<ShowsPage />} />
        <Route path="/shows/:showId" element={<ShowDetailPage />} />
        <Route path="/publish" element={<PublishPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
