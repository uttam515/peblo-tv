import React from 'react';
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Role } from '../types/auth';

interface ProtectedRouteProps {
  requiredRole?: Role;
  children?: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  requiredRole,
  children,
}) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#0f172a] text-slate-400">
        <div className="w-9 h-9 border-3 border-[#334155] border-t-blue-500 rounded-full animate-spin" />
        <p className="text-sm">Loading session...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredRole && user?.role !== requiredRole) {
    return (
      <div className="bg-red-500/10 border border-red-500 rounded-xl p-8 text-red-200 max-w-lg mx-auto mt-12">
        <h2 className="text-xl font-bold text-red-400 mb-2">403 - Permission Denied</h2>
        <p className="text-sm mb-1">
          Your current role (<strong>{user?.role}</strong>) does not have permission to access this page.
        </p>
        <p className="text-xs text-red-300">Admin role required.</p>
      </div>
    );
  }

  return children ? <>{children}</> : <Outlet />;
};
