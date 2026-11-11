import React from 'react';
import { X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AuthFormPanel } from './AuthFormPanel';

export const AuthModal: React.FC = () => {
  const { isAuthModalOpen, closeAuthModal } = useAuth();

  if (!isAuthModalOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(1, 71, 46, 0.45)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        animation: 'fadeIn 0.25s ease-out',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) closeAuthModal();
      }}
    >
      <div
        className="card-cream"
        style={{
          width: '100%',
          maxWidth: '480px',
          borderRadius: '2rem',
          padding: '2.25rem',
          position: 'relative',
          boxShadow: '0 25px 60px -15px rgba(1, 71, 46, 0.35)',
          border: '1.5px solid rgba(1, 71, 46, 0.2)',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        <button
          onClick={closeAuthModal}
          type="button"
          aria-label="Close modal"
          style={{
            position: 'absolute',
            top: '1.25rem',
            right: '1.25rem',
            background: 'rgba(1, 71, 46, 0.08)',
            border: 'none',
            borderRadius: '50%',
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'var(--color-forest)',
          }}
        >
          <X size={18} />
        </button>

        <AuthFormPanel onSuccess={closeAuthModal} showQuickFill />
      </div>
    </div>
  );
};
