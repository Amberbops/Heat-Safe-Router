import React, { useState, useEffect } from 'react';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Shield,
  Sparkles,
  KeyRound,
  RotateCcw,
  ArrowLeft,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface AuthFormPanelProps {
  /** Optional callback invoked after local sign-in or registration succeeds. */
  onSuccess?: () => void;
  /** Whether to show quick-fill demo account pills. */
  showQuickFill?: boolean;
}

export const AuthFormPanel: React.FC<AuthFormPanelProps> = ({
  onSuccess,
  showQuickFill = false,
}) => {
  const {
    authModalTab,
    setAuthModalTab,
    login,
    register,
    verifyOtp,
    resendOtp,
    pendingOtpChallenge,
    clearPendingOtpChallenge,
    loginWithAmazon,
    isLoading,
    authError,
    clearAuthError,
  } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isAmazonLoading, setIsAmazonLoading] = useState(false);
  const [showAmazonHelp, setShowAmazonHelp] = useState(false);

  useEffect(() => {
    setErrorMessage(authError || null);
    setSuccessMessage(null);
    setShowAmazonHelp(false);
  }, [authModalTab, authError]);

  useEffect(() => {
    if (!pendingOtpChallenge) {
      setOtpCode('');
      setResendCooldown(0);
      return;
    }
    setOtpCode('');
    setResendCooldown(pendingOtpChallenge.cooldown_seconds || 60);
    setErrorMessage(null);
    setSuccessMessage(
      pendingOtpChallenge.message ||
        `A 6-digit verification code has been sent to ${pendingOtpChallenge.email}.`
    );
  }, [pendingOtpChallenge]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setResendCooldown((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    clearAuthError();

    if (!email.trim() || !password) {
      setErrorMessage('Please enter both email and password.');
      return;
    }

    if (authModalTab === 'register' && password.length < 12) {
      setErrorMessage('Password must contain at least 12 characters for account registration.');
      return;
    }

    try {
      const challenge =
        authModalTab === 'signin'
          ? await login(email, password)
          : await register(email, password);

      if (!challenge) {
        setSuccessMessage(
          authModalTab === 'signin'
            ? 'Successfully signed in!'
            : 'Account registered and signed in!'
        );
        onSuccess?.();
      }
    } catch (err: any) {
      const msg = err?.message || 'Authentication failed.';
      if (msg.includes('Invalid credentials') || msg.includes('Invalid email')) {
        setErrorMessage(
          authModalTab === 'signin'
            ? 'Invalid email or password. If you have not created an account yet, switch to REGISTER above!'
            : msg
        );
      } else {
        setErrorMessage(msg);
      }
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingOtpChallenge) return;
    setErrorMessage(null);
    setSuccessMessage(null);
    clearAuthError();

    const cleanedCode = otpCode.replace(/\D/g, '').slice(0, 6);
    if (cleanedCode.length !== 6) {
      setErrorMessage('Please enter the full 6-digit verification code.');
      return;
    }

    try {
      await verifyOtp(
        pendingOtpChallenge.email,
        cleanedCode,
        pendingOtpChallenge.challenge_token
      );
      setSuccessMessage('Email verified! Entering HeatSafe...');
      onSuccess?.();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Invalid or expired 6-digit verification code.');
    }
  };

  const handleResendOtp = async () => {
    if (!pendingOtpChallenge || resendCooldown > 0 || isLoading) return;
    setErrorMessage(null);
    setSuccessMessage(null);
    clearAuthError();
    try {
      const updated = await resendOtp(
        pendingOtpChallenge.email,
        pendingOtpChallenge.challenge_token
      );
      setResendCooldown(updated.cooldown_seconds || 60);
      setSuccessMessage(`A fresh 6-digit verification code was sent to ${updated.email}.`);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Could not resend verification code.');
    }
  };

  const handleAmazonLogin = async () => {
    setErrorMessage(null);
    setShowAmazonHelp(false);
    clearAuthError();
    setIsAmazonLoading(true);
    try {
      await loginWithAmazon();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to connect with Amazon.');
      setShowAmazonHelp(true);
    } finally {
      setIsAmazonLoading(false);
    }
  };

  const fillQuickDemo = (type: 'admin' | 'user') => {
    setEmail(
      type === 'admin'
        ? 'heatsafe-admin-20261106@example.com'
        : 'heatsafe-smoke-20261103@example.com'
    );
    setPassword('');
    setErrorMessage(null);
    setSuccessMessage('Demo email populated! Please enter your account password.');
  };

  const renderAlerts = () => (
    <>
      {errorMessage && (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.65rem',
            padding: '0.85rem 1rem',
            backgroundColor: '#fee2e2',
            border: '1px solid #f87171',
            borderRadius: '1rem',
            color: '#b91c1c',
            fontSize: '0.8rem',
            marginBottom: '1.15rem',
          }}
        >
          <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
            padding: '0.85rem 1rem',
            backgroundColor: '#dcfce7',
            border: '1px solid #86efac',
            borderRadius: '1rem',
            color: '#15803d',
            fontSize: '0.8rem',
            marginBottom: '1.15rem',
          }}
        >
          <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
          <span>{successMessage}</span>
        </div>
      )}
    </>
  );

  if (pendingOtpChallenge) {
    return (
      <div>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '52px',
              height: '52px',
              borderRadius: '1.25rem',
              backgroundColor: 'var(--color-forest)',
              color: 'var(--color-cream)',
              marginBottom: '0.85rem',
              boxShadow: 'var(--shadow-forest-sm)',
            }}
          >
            <KeyRound size={24} />
          </div>
          <h2
            style={{
              fontFamily: 'Anton, sans-serif',
              fontSize: '1.85rem',
              letterSpacing: '0.02em',
              color: 'var(--color-forest)',
              lineHeight: 1.1,
            }}
          >
            VERIFY YOUR EMAIL
          </h2>
          <p
            style={{
              fontSize: '0.82rem',
              color: 'var(--color-forest)',
              opacity: 0.82,
              marginTop: '0.45rem',
              fontWeight: 500,
              lineHeight: 1.45,
            }}
          >
            Enter the 6-digit security code sent to{' '}
            <strong style={{ color: 'var(--color-forest)' }}>
              {pendingOtpChallenge.email}
            </strong>
          </p>
        </div>

        {renderAlerts()}

        <form
          onSubmit={handleOtpSubmit}
          style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
        >
          <div>
            <label
              htmlFor="heatsafe-otp-code"
              style={{
                display: 'block',
                fontSize: '0.72rem',
                fontWeight: 700,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                marginBottom: '0.45rem',
                opacity: 0.8,
                textAlign: 'center',
              }}
            >
              6-Digit Verification Code
            </label>
            <input
              id="heatsafe-otp-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
              autoFocus
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              className="input-editorial"
              style={{
                textAlign: 'center',
                fontSize: '1.65rem',
                fontWeight: 700,
                letterSpacing: '0.42em',
                padding: '0.95rem 1rem',
              }}
              disabled={isLoading}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || otpCode.length !== 6}
            className="btn-pill-primary"
            style={{
              width: '100%',
              padding: '1rem',
              boxShadow: 'var(--shadow-forest)',
              gap: '0.65rem',
              opacity: isLoading || otpCode.length !== 6 ? 0.65 : 1,
            }}
          >
            {isLoading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>VERIFYING CODE...</span>
              </>
            ) : (
              <span>VERIFY &amp; ENTER HEATSAFE</span>
            )}
          </button>
        </form>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '0.75rem',
            marginTop: '1.15rem',
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            onClick={() => {
              clearPendingOtpChallenge();
              setErrorMessage(null);
              setSuccessMessage(null);
            }}
            disabled={isLoading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.5rem 0.9rem',
              borderRadius: '999px',
              border: '1px solid rgba(1, 71, 46, 0.25)',
              backgroundColor: 'transparent',
              color: 'var(--color-forest)',
              fontSize: '0.72rem',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              cursor: isLoading ? 'not-allowed' : 'pointer',
            }}
          >
            <ArrowLeft size={14} /> Back
          </button>

          <button
            type="button"
            onClick={handleResendOtp}
            disabled={isLoading || resendCooldown > 0}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.5rem 0.95rem',
              borderRadius: '999px',
              border: '1px solid rgba(1, 71, 46, 0.25)',
              backgroundColor: 'var(--color-olive)',
              color: 'var(--color-forest)',
              fontSize: '0.72rem',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              opacity: isLoading || resendCooldown > 0 ? 0.6 : 1,
              cursor: isLoading || resendCooldown > 0 ? 'not-allowed' : 'pointer',
            }}
          >
            <RotateCcw size={13} />
            {resendCooldown > 0 ? `Resend (${resendCooldown}s)` : 'Resend Code'}
          </button>
        </div>

        <div
          style={{
            marginTop: '1.35rem',
            textAlign: 'center',
            fontSize: '0.68rem',
            opacity: 0.68,
            fontWeight: 500,
          }}
        >
          Secured with Email 2FA (6-Digit OTP), AWS DynamoDB &amp; HS256 JWT
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '1.65rem' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '52px',
            height: '52px',
            borderRadius: '1.25rem',
            backgroundColor: 'var(--color-forest)',
            color: 'var(--color-cream)',
            marginBottom: '0.85rem',
            boxShadow: 'var(--shadow-forest-sm)',
          }}
        >
          <Shield size={26} />
        </div>
        <h2
          style={{
            fontFamily: 'Anton, sans-serif',
            fontSize: '1.85rem',
            letterSpacing: '0.02em',
            color: 'var(--color-forest)',
            lineHeight: 1.1,
          }}
        >
          {authModalTab === 'signin' ? 'SIGN IN TO HEATSAFE' : 'CREATE YOUR ACCOUNT'}
        </h2>
        <p
          style={{
            fontSize: '0.82rem',
            color: 'var(--color-forest)',
            opacity: 0.78,
            marginTop: '0.35rem',
            fontWeight: 500,
          }}
        >
          {authModalTab === 'signin'
            ? 'Authenticate to unlock heat-safe pedestrian routing & community cool spots'
            : 'Register once in DynamoDB or continue seamlessly with your Amazon account'}
        </p>
      </div>

      {/* Tabs: Sign In vs Register */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          backgroundColor: 'var(--color-olive)',
          padding: '0.3rem',
          borderRadius: '999px',
          marginBottom: '1.5rem',
          border: '1px solid rgba(1, 71, 46, 0.15)',
        }}
      >
        <button
          type="button"
          onClick={() => {
            clearAuthError();
            setAuthModalTab('signin');
          }}
          style={{
            padding: '0.65rem 1rem',
            borderRadius: '999px',
            border: 'none',
            background: authModalTab === 'signin' ? 'var(--color-forest)' : 'transparent',
            color: authModalTab === 'signin' ? 'var(--color-cream)' : 'var(--color-forest)',
            fontWeight: 700,
            fontSize: '0.75rem',
            letterSpacing: '0.12em',
            cursor: 'pointer',
            transition: 'all 0.25s ease',
          }}
        >
          SIGN IN
        </button>
        <button
          type="button"
          onClick={() => {
            clearAuthError();
            setAuthModalTab('register');
          }}
          style={{
            padding: '0.65rem 1rem',
            borderRadius: '999px',
            border: 'none',
            background: authModalTab === 'register' ? 'var(--color-forest)' : 'transparent',
            color: authModalTab === 'register' ? 'var(--color-cream)' : 'var(--color-forest)',
            fontWeight: 700,
            fontSize: '0.75rem',
            letterSpacing: '0.12em',
            cursor: 'pointer',
            transition: 'all 0.25s ease',
          }}
        >
          REGISTER
        </button>
      </div>

      {/* Login with Amazon (LWA) Gateway */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.35rem' }}>
        <button
          type="button"
          onClick={handleAmazonLogin}
          disabled={isLoading || isAmazonLoading}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.75rem',
            width: '100%',
            padding: '0.88rem 1.25rem',
            backgroundColor: '#232F3E',
            border: '1.5px solid #131921',
            borderRadius: '999px',
            color: '#ffffff',
            fontSize: '0.88rem',
            fontWeight: 700,
            letterSpacing: '0.04em',
            cursor: isLoading || isAmazonLoading ? 'not-allowed' : 'pointer',
            opacity: isLoading || isAmazonLoading ? 0.7 : 1,
            boxShadow: '0 4px 12px rgba(35, 47, 62, 0.25)',
            transition: 'all 0.2s ease',
          }}
          onMouseOver={(e) => {
            if (!isLoading && !isAmazonLoading) e.currentTarget.style.backgroundColor = '#131921';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = '#232F3E';
          }}
        >
          {isAmazonLoading ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M13.5 12.8c-1.3 0-2.2.3-2.8.9-.6.6-.7 1.3-.7 2 0 .9.3 1.6.8 2.1.5.5 1.3.8 2.2.8 1.1 0 2.1-.4 2.8-1.2.7-.8 1.1-1.8 1.1-3v-1.6h-3.4zm4.8 4.8c-.5.6-1.1 1.1-1.8 1.4-.7.3-1.6.5-2.6.5-1.5 0-2.7-.4-3.6-1.3-.9-.9-1.3-2-1.3-3.4 0-1.5.5-2.7 1.5-3.6 1-.9 2.4-1.3 4.2-1.3h3.5v-.8c0-1.1-.3-1.9-.9-2.5-.6-.6-1.5-.9-2.7-.9-1.3 0-2.5.4-3.5 1.1-.3.2-.6.1-.8-.1l-1.1-1.3c-.2-.2-.2-.5 0-.7 1.5-1.1 3.3-1.7 5.3-1.7 2 0 3.6.5 4.6 1.5 1 1 1.5 2.5 1.5 4.4v7.9c0 .4.2.7.5.9.2.1.2.4.1.6l-1.7 1.2c-.3.2-.6.1-.8-.2l-.5-.9z"
                fill="#FFFFFF"
              />
              <path
                d="M21.5 18.2c-2.8 2-6.5 3.1-10.4 3.1-4.7 0-9-1.6-12.6-4.5-.3-.2-.3-.6 0-.8.2-.2.6-.2.8 0 3.4 2.7 7.5 4.2 11.8 4.2 3.6 0 7-1 9.6-2.8.4-.3.9 0 .8.8z"
                fill="#FF9900"
              />
              <path
                d="M22.2 16.9c-.3-.4-1.8-.2-2.7-.1-.3 0-.4-.3-.2-.5 1.4-1.2 3.5-.8 3.8-.4.3.4-.1 2.5-1.4 3.7-.2.2-.5.1-.4-.2.4-.8.9-2.1.9-2.5z"
                fill="#FF9900"
              />
            </svg>
          )}
          <span>{authModalTab === 'register' ? 'Continue with Amazon' : 'Sign in with Amazon'}</span>
        </button>
      </div>

      {/* Login with Amazon Setup Guidance Card if misconfigured */}
      {showAmazonHelp && (
        <div
          style={{
            padding: '1rem',
            backgroundColor: 'var(--color-olive)',
            borderRadius: '1.25rem',
            border: '1.5px solid rgba(1, 71, 46, 0.25)',
            marginBottom: '1.25rem',
            fontSize: '0.78rem',
            color: 'var(--color-forest)',
            lineHeight: 1.45,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <strong style={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.75rem' }}>
              Login with Amazon (LWA) Setup
            </strong>
            <button
              type="button"
              onClick={() => setShowAmazonHelp(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}
            >
              ✕
            </button>
          </div>
          <p style={{ marginBottom: '0.45rem', opacity: 0.85 }}>
            Add your Amazon Security Profile Client ID (<code>VITE_AMAZON_CLIENT_ID</code>) to <code>frontend/.env</code> and register your origin in Web Settings.
          </p>
        </div>
      )}

      {/* Divider */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          margin: '1.2rem 0',
          gap: '0.85rem',
        }}
      >
        <div style={{ flex: 1, height: '1px', backgroundColor: 'rgba(1, 71, 46, 0.15)' }} />
        <span
          style={{
            fontSize: '0.68rem',
            fontWeight: 700,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            color: 'var(--color-forest)',
            opacity: 0.6,
          }}
        >
          or email credentials
        </span>
        <div style={{ flex: 1, height: '1px', backgroundColor: 'rgba(1, 71, 46, 0.15)' }} />
      </div>

      {showQuickFill && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.5rem',
            marginBottom: '1.15rem',
            alignItems: 'center',
          }}
        >
          <span
            style={{
              fontSize: '0.65rem',
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              opacity: 0.6,
            }}
          >
            QUICK FILL:
          </span>
          <button
            type="button"
            onClick={() => fillQuickDemo('admin')}
            style={{
              fontSize: '0.68rem',
              fontWeight: 700,
              padding: '0.3rem 0.65rem',
              borderRadius: '999px',
              backgroundColor: 'rgba(1, 71, 46, 0.12)',
              border: '1px solid rgba(1, 71, 46, 0.25)',
              color: 'var(--color-forest)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
            }}
          >
            <Shield size={12} /> Admin Email
          </button>
          <button
            type="button"
            onClick={() => fillQuickDemo('user')}
            style={{
              fontSize: '0.68rem',
              fontWeight: 700,
              padding: '0.3rem 0.65rem',
              borderRadius: '999px',
              backgroundColor: 'rgba(1, 71, 46, 0.12)',
              border: '1px solid rgba(1, 71, 46, 0.25)',
              color: 'var(--color-forest)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
            }}
          >
            <Sparkles size={12} /> User Email
          </button>
        </div>
      )}

      {renderAlerts()}

      {/* Email & Password Form */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div>
          <label
            htmlFor="heatsafe-auth-email"
            style={{
              display: 'block',
              fontSize: '0.72rem',
              fontWeight: 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              marginBottom: '0.45rem',
              opacity: 0.8,
            }}
          >
            Email Address
          </label>
          <div style={{ position: 'relative' }}>
            <div
              style={{
                position: 'absolute',
                left: '1rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--color-forest)',
                opacity: 0.5,
                pointerEvents: 'none',
              }}
            >
              <Mail size={16} />
            </div>
            <input
              id="heatsafe-auth-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="input-editorial"
              style={{ paddingLeft: '2.75rem' }}
              disabled={isLoading}
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="heatsafe-auth-password"
            style={{
              display: 'block',
              fontSize: '0.72rem',
              fontWeight: 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              marginBottom: '0.45rem',
              opacity: 0.8,
            }}
          >
            Password{' '}
            {authModalTab === 'register' && (
              <span
                style={{
                  opacity: 0.7,
                  fontWeight: 500,
                  textTransform: 'none',
                  letterSpacing: 'normal',
                }}
              >
                (min 12 chars)
              </span>
            )}
          </label>
          <div style={{ position: 'relative' }}>
            <div
              style={{
                position: 'absolute',
                left: '1rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--color-forest)',
                opacity: 0.5,
                pointerEvents: 'none',
              }}
            >
              <Lock size={16} />
            </div>
            <input
              id="heatsafe-auth-password"
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete={authModalTab === 'signin' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="input-editorial"
              style={{ paddingLeft: '2.75rem', paddingRight: '2.75rem' }}
              disabled={isLoading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              style={{
                position: 'absolute',
                right: '0.85rem',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: 'var(--color-forest)',
                opacity: 0.6,
                cursor: 'pointer',
                padding: '4px',
              }}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="btn-pill-primary"
          style={{
            width: '100%',
            padding: '1rem',
            marginTop: '0.65rem',
            boxShadow: 'var(--shadow-forest)',
            gap: '0.65rem',
          }}
        >
          {isLoading ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              <span>PROCESSING...</span>
            </>
          ) : (
            <span>{authModalTab === 'signin' ? 'SIGN IN' : 'CREATE ACCOUNT'}</span>
          )}
        </button>
      </form>

      <div
        style={{
          marginTop: '1.35rem',
          textAlign: 'center',
          fontSize: '0.68rem',
          opacity: 0.68,
          fontWeight: 500,
        }}
      >
        Secured with AWS DynamoDB, HS256 JWT & Login with Amazon
      </div>
    </div>
  );
};
