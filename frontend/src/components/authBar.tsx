import React from 'react';
import { LogIn, LogOut, Shield, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const AuthBar: React.FC = () => {
  const { user, role, isAuthenticated, isLoading, openAuthModal, logout } = useAuth();

  if (isLoading) {
    return (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.45rem',
          padding: '0.45rem 0.85rem',
          borderRadius: '999px',
          backgroundColor: 'var(--color-olive)',
          fontSize: '0.72rem',
          fontWeight: 600,
          opacity: 0.8,
        }}
      >
        <span
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: 'var(--heat-moderate)',
            display: 'inline-block',
          }}
        />
        Authenticating...
      </div>
    );
  }

  if (isAuthenticated && user) {
    const isAdmin = role === 'admin';
    return (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.65rem',
          padding: '0.35rem 0.65rem 0.35rem 0.85rem',
          borderRadius: '999px',
          backgroundColor: 'var(--color-olive)',
          border: '1.5px solid rgba(1, 71, 46, 0.2)',
          boxShadow: '0 2px 8px rgba(1, 71, 46, 0.08)',
        }}
      >
        {/* User / Admin Chip */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <div
            style={{
              width: '26px',
              height: '26px',
              borderRadius: '50%',
              backgroundColor: isAdmin ? '#b45309' : 'var(--color-forest)',
              color: 'var(--color-cream)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.72rem',
              fontWeight: 700,
            }}
          >
            {isAdmin ? <Shield size={14} /> : <User size={14} />}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                color: 'var(--color-forest)',
                maxWidth: '130px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={user.email}
            >
              {user.email}
            </span>
            <span
              style={{
                fontSize: '0.58rem',
                fontWeight: 800,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: isAdmin ? '#b45309' : 'var(--heat-low)',
              }}
            >
              {isAdmin ? 'ADMIN MODERATOR' : 'COMMUNITY WALKER'}
            </span>
          </div>
        </div>

        {/* Sign Out Button */}
        <button
          type="button"
          onClick={() => logout()}
          title="Sign out"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.3rem',
            padding: '0.35rem 0.75rem',
            borderRadius: '999px',
            backgroundColor: 'rgba(194, 65, 52, 0.12)',
            border: '1px solid rgba(194, 65, 52, 0.3)',
            color: 'var(--heat-very-high)',
            fontSize: '0.66rem',
            fontWeight: 700,
            letterSpacing: '0.08em',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          onMouseOver={(e) => (e.currentTarget.style.backgroundColor = 'rgba(194, 65, 52, 0.22)')}
          onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'rgba(194, 65, 52, 0.12)')}
        >
          <LogOut size={12} />
          <span>SIGN OUT</span>
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
      <button
        type="button"
        onClick={() => openAuthModal('signin')}
        className="btn-pill-primary"
        style={{
          padding: '0.55rem 1.15rem',
          fontSize: '0.72rem',
          letterSpacing: '0.14em',
        }}
      >
        <LogIn size={14} />
        <span>SIGN IN / REGISTER</span>
      </button>
    </div>
  );
};
