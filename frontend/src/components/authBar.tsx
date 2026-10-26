import React from 'react';
import { useAuth } from 'react-oidc-context';

export const AuthBar: React.FC = () => {
  const auth = useAuth();

  if (auth.isLoading) {
    return <div className="text-sm text-gray-500">Loading session...</div>;
  }

  if (auth.error) {
    return <div className="text-sm text-red-500">Auth error: {auth.error.message}</div>;
  }

  if (auth.isAuthenticated) {
    return (
      <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-lg shadow-sm border border-gray-200">
        <span className="text-xs text-gray-700 font-medium truncate max-w-[160px]">
          {auth.user?.profile.email}
        </span>
        <button
          onClick={() => auth.removeUser()}
          className="px-3 py-1 bg-red-50 text-red-600 border border-red-200 rounded text-xs font-semibold hover:bg-red-100 transition-colors"
        >
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => auth.signinRedirect()}
      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold shadow-sm hover:bg-blue-700 transition-colors"
    >
      Sign In / Register
    </button>
  );
};