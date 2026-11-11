import React from 'react';
import { Compass, Loader2, MapPin, ShieldCheck, Sun } from 'lucide-react';
import { AuthFormPanel } from './AuthFormPanel';

interface AuthPageProps {
  isAuthPending?: boolean;
}

const HIGHLIGHTS = [
  {
    icon: Compass,
    title: 'Thermal & Shade-Aware Routing',
    desc: 'Compare fastest vs. heat-safe pedestrian paths scored by live WBGT, solar radiation, and tree canopy density.',
  },
  {
    icon: MapPin,
    title: 'Verified Cool Spots Network',
    desc: 'Discover and contribute community hydration kiosks, shaded parks, and cooling shelters synced with DynamoDB.',
  },
  {
    icon: ShieldCheck,
    title: 'Unified Account & Role Access',
    desc: 'Register an encrypted HeatSafe account or sign in directly with Amazon — sessions and moderator roles sync automatically.',
  },
];

export const AuthPage: React.FC<AuthPageProps> = ({
  isAuthPending = false,
}) => {
  return (
    <div className="auth-gate-shell">
      {/* Top Centered Editorial Brand Panel */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.1rem 2rem',
          backgroundColor: 'rgba(254, 250, 224, 0.88)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderRadius: 'var(--radius-pill)',
          border: 'var(--border-forest-subtle)',
          boxShadow: 'var(--shadow-forest-sm)',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.85rem',
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: '26px',
                height: '2px',
                backgroundColor: 'var(--color-forest)',
                opacity: 0.45,
                borderRadius: '999px',
              }}
            />
            <span
              style={{
                fontFamily: 'Anton, sans-serif',
                fontSize: 'clamp(1.75rem, 2.6vw, 2.35rem)',
                letterSpacing: '0.07em',
                lineHeight: 1,
                color: 'var(--color-forest)',
              }}
            >
              HEATSAFE
            </span>
            <span
              aria-hidden="true"
              style={{
                width: '26px',
                height: '2px',
                backgroundColor: 'var(--color-forest)',
                opacity: 0.45,
                borderRadius: '999px',
              }}
            />
          </div>
          <span
            style={{
              fontSize: '0.68rem',
              fontWeight: 700,
              letterSpacing: '0.34em',
              marginTop: '0.35rem',
              opacity: 0.78,
              textTransform: 'uppercase',
            }}
          >
            CLIMATE-AWARE PEDESTRIAN NAVIGATION
          </span>
        </div>
      </header>

      {/* Main Split Editorial Gate */}
      <main className="auth-gate-grid">
        {/* Left Column: Brand Hero & Highlights */}
        <div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.45rem 1rem',
              borderRadius: 'var(--radius-pill)',
              backgroundColor: 'var(--color-olive)',
              border: '1px solid rgba(1, 71, 46, 0.2)',
              fontSize: '0.7rem',
              fontWeight: 700,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              marginBottom: '1.25rem',
            }}
          >
            <Sun size={14} />
            REGISTERED MEMBERS PORTAL
          </div>

          <h1
            className="display-hero"
            style={{ fontSize: 'clamp(2.8rem, 5.4vw, 5.1rem)', marginBottom: '1.15rem' }}
          >
            <span>COOLER ROUTES.</span>
            <span>SAFER WALKS.</span>
          </h1>

          <p
            style={{
              fontSize: 'clamp(1rem, 1.25vw, 1.12rem)',
              maxWidth: '52ch',
              opacity: 0.88,
              lineHeight: 1.6,
              marginBottom: '2rem',
              fontWeight: 500,
            }}
          >
            Sign in or create a free HeatSafe account to access live solar-exposure route planning,
            street-level thermal analytics, and verified community cooling refuges.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', maxWidth: '540px' }}>
            {HIGHLIGHTS.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="heatsafe-box-olive"
                style={{
                  padding: '1.1rem 1.35rem',
                  marginBottom: 0,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.95rem',
                  backgroundColor: 'rgba(233, 237, 201, 0.85)',
                }}
              >
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '0.9rem',
                    backgroundColor: 'var(--color-forest)',
                    color: 'var(--color-cream)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: '2px',
                  }}
                >
                  <Icon size={18} />
                </div>
                <div>
                  <h3
                    style={{
                      fontSize: '0.88rem',
                      fontWeight: 800,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      marginBottom: '0.2rem',
                    }}
                  >
                    {title}
                  </h3>
                  <p style={{ fontSize: '0.82rem', opacity: 0.84, lineHeight: 1.45 }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Editorial Cream Auth Card */}
        <div
          className="card-cream"
          style={{
            width: '100%',
            maxWidth: '490px',
            justifySelf: 'center',
            padding: 'clamp(1.65rem, 3vw, 2.5rem)',
            borderRadius: '2.25rem',
            border: '1.5px solid rgba(1, 71, 46, 0.2)',
          }}
        >
          {isAuthPending ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '1rem',
                padding: '3.5rem 1rem',
                textAlign: 'center',
              }}
            >
              <Loader2 size={36} className="animate-spin" />
              <div
                style={{
                  fontFamily: 'Anton, sans-serif',
                  fontSize: '1.5rem',
                  letterSpacing: '0.03em',
                }}
              >
                VERIFYING YOUR CREDENTIALS...
              </div>
              <p style={{ fontSize: '0.84rem', opacity: 0.78, maxWidth: '32ch' }}>
                Connecting your Amazon / DynamoDB session before unlocking the HeatSafe planner.
              </p>
            </div>
          ) : (
            <AuthFormPanel />
          )}
        </div>
      </main>

      {/* Compact Footer */}
      <footer
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
          fontSize: '0.75rem',
          opacity: 0.72,
          paddingTop: '0.75rem',
          borderTop: '1px solid rgba(1, 71, 46, 0.14)',
        }}
      >
        <span>Heat-Safe Route Planner • Member Access Only</span>
        <span>Protected by AWS API Gateway, Lambda Authorizer & DynamoDB</span>
      </footer>
    </div>
  );
};
