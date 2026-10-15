import type { FC } from 'react';
import { X, Server, ShieldCheck } from 'lucide-react';
import { API_BASE_URL } from '../api/plannerApi';

interface SystemInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  isApiOnline: boolean | null;
  requestId?: string;
}

export const SystemInfoModal: FC<SystemInfoModalProps> = ({
  isOpen,
  onClose,
  isApiOnline,
  requestId,
}) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="system-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(1, 71, 46, 0.45)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        zIndex: 2000,
      }}
      onClick={onClose}
    >
      <div
        className="card-cream"
        style={{ maxWidth: '540px', width: '100%', padding: '2.25rem' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span id="system-modal-title" className="utility-label">
            AWS SYSTEM & TELEMETRY STATUS
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close system info modal"
            style={{ background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        <div
          style={{
            marginTop: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            fontSize: '0.9rem',
          }}
        >
          <div style={{ backgroundColor: 'var(--color-olive)', padding: '1rem', borderRadius: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
              <Server size={16} /> API Gateway Endpoint
            </div>
            <code
              style={{
                display: 'block',
                marginTop: '0.35rem',
                wordBreak: 'break-all',
                fontSize: '0.8rem',
              }}
            >
              {API_BASE_URL}
            </code>
          </div>

          <div style={{ backgroundColor: 'var(--color-olive)', padding: '1rem', borderRadius: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
              <ShieldCheck size={16} /> Live Health Check (/health)
            </div>
            <p style={{ marginTop: '0.35rem' }}>
              Status:{' '}
              <strong>
                {isApiOnline === null
                  ? 'Checking...'
                  : isApiOnline
                  ? 'Online (200 OK)'
                  : 'Unreachable'}
              </strong>
            </p>
            {requestId && (
              <p style={{ marginTop: '0.25rem', fontSize: '0.8rem', opacity: 0.8 }}>
                Last Request ID: <code>{requestId}</code>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};