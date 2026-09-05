import React from 'react';
import { useAuth } from '../context/AuthContext';

export const PublishPlaceholderPage: React.FC = () => {
  const { user, isAdmin } = useAuth();

  if (!isAdmin) {
    return (
      <div className="page-container">
        <div className="permission-denied-box" data-testid="permission-denied">
          <h2>Permission Denied (403)</h2>
          <p>
            You are currently signed in as <strong>{user?.username}</strong> with role{' '}
            <strong>{user?.role}</strong>.
          </p>
          <p>
            Only administrators are authorized to publish changes to the live catalogue.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <header className="page-header">
        <h1>Publish Catalogue</h1>
        <p>Validate content and atomically deploy live catalogue updates.</p>
      </header>
      <div className="placeholder-content">
        <p>Catalogue publishing controls will be implemented in a subsequent step.</p>
      </div>
    </div>
  );
};
