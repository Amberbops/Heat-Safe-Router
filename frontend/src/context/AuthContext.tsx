import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import type {
  AuthSession,
  AuthStepResult,
  AuthTokens,
  AuthUser,
  OtpChallengeResponse,
  UserRole,
} from '../types/auth';
import {
  loginWithCredentials,
  registerWithCredentials,
  verifyOtpCode,
  resendOtpCode,
  logoutTokens,
  getAmazonGatewayRedirect,
  loginWithAmazonBackend,
  getMeApi,
  refreshTokens,
} from '../api/authApi';

const STORAGE_KEY_USER = 'heatsafe_auth_user_v2';
const STORAGE_KEY_TOKENS = 'heatsafe_auth_tokens_v2';
const BROADCAST_CHANNEL = 'heatsafe_auth_broadcast';
const inFlightAmazonCodes = new Set<string>();

interface AuthContextType {
  user: AuthUser | null;
  tokens: AuthTokens | null;
  role: UserRole;
  accessToken: string | undefined;
  isAuthenticated: boolean;
  isLoading: boolean;
  authError: string | null;
  clearAuthError: () => void;
  pendingOtpChallenge: OtpChallengeResponse | null;
  clearPendingOtpChallenge: () => void;
  isAuthModalOpen: boolean;
  openAuthModal: (initialTab?: 'signin' | 'register') => void;
  closeAuthModal: () => void;
  authModalTab: 'signin' | 'register';
  setAuthModalTab: (tab: 'signin' | 'register') => void;
  login: (email: string, password: string) => Promise<OtpChallengeResponse | null>;
  register: (email: string, password: string) => Promise<OtpChallengeResponse | null>;
  verifyOtp: (email: string, otpCode: string, challengeToken: string) => Promise<void>;
  resendOtp: (email: string, challengeToken: string) => Promise<OtpChallengeResponse>;
  loginWithAmazon: () => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  session: AuthSession;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_USER);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const [tokens, setTokens] = useState<AuthTokens | null>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_TOKENS);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const [isLoading, setIsLoading] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).has('code');
  });
  const [authError, setAuthError] = useState<string | null>(null);
  const [pendingOtpChallenge, setPendingOtpChallenge] = useState<OtpChallengeResponse | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authModalTab, setAuthModalTab] = useState<'signin' | 'register'>('signin');

  const clearAuthError = useCallback(() => setAuthError(null), []);
  const clearPendingOtpChallenge = useCallback(() => setPendingOtpChallenge(null), []);

  // Broadcast channel for multi-tab synchronization
  useEffect(() => {
    let channel: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      channel = new BroadcastChannel(BROADCAST_CHANNEL);
      channel.onmessage = (event) => {
        if (event.data?.type === 'AUTH_STATE_CHANGE') {
          try {
            const rawUser = localStorage.getItem(STORAGE_KEY_USER);
            const rawTokens = localStorage.getItem(STORAGE_KEY_TOKENS);
            setUser(rawUser ? JSON.parse(rawUser) : null);
            setTokens(rawTokens ? JSON.parse(rawTokens) : null);
          } catch {
            // Safe
          }
        }
      };
    }
    return () => {
      channel?.close();
    };
  }, []);

  const notifySync = () => {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const channel = new BroadcastChannel(BROADCAST_CHANNEL);
        channel.postMessage({ type: 'AUTH_STATE_CHANGE' });
        channel.close();
      } catch {
        // safe
      }
    }
  };

  const saveAuthData = (newUser: AuthUser, newTokens: AuthTokens) => {
    setUser(newUser);
    setTokens(newTokens);
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(newUser));
    localStorage.setItem(STORAGE_KEY_TOKENS, JSON.stringify(newTokens));
    // Also update legacy storage key for backward compatibility with existing components
    localStorage.setItem(
      'heatsafe_aws_auth_session_v1',
      JSON.stringify({
        email: newUser.email,
        role: newUser.role,
        token: newTokens.access_token,
      })
    );
    notifySync();
  };

  const clearAuthData = () => {
    setUser(null);
    setTokens(null);
    localStorage.removeItem(STORAGE_KEY_USER);
    localStorage.removeItem(STORAGE_KEY_TOKENS);
    localStorage.removeItem('heatsafe_aws_auth_session_v1');
    notifySync();
  };

  // Check for Login with Amazon redirect callback (?code=... or ?error=...)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const urlParams = new URLSearchParams(window.location.search);
    const oauthError = urlParams.get('error');
    const oauthErrorDesc = urlParams.get('error_description');
    if (oauthError) {
      setAuthError(oauthErrorDesc || `Amazon login failed: ${oauthError}`);
      try {
        window.history.replaceState({}, document.title, window.location.pathname);
      } catch {
        // safe
      }
      return;
    }

    const authCode = urlParams.get('code');
    const codeVerifier = sessionStorage.getItem('lwa_code_verifier');

    if (authCode && !inFlightAmazonCodes.has(authCode)) {
      inFlightAmazonCodes.add(authCode);
      const redirectUri = `${window.location.origin}/`;
      setIsLoading(true);
      setAuthError(null);
      try {
        window.history.replaceState({}, document.title, window.location.pathname);
      } catch {
        // safe
      }

      loginWithAmazonBackend({
        code: authCode,
        redirectUri,
        codeVerifier: codeVerifier || undefined,
      })
        .then((result) => {
          sessionStorage.removeItem('lwa_code_verifier');
          if (result.status === 'requires_2fa') {
            setPendingOtpChallenge(result.challenge);
          } else {
            setPendingOtpChallenge(null);
            saveAuthData(result.user, result.tokens);
            setIsAuthModalOpen(false);
          }
        })
        .catch((err: any) => {
          const msg = err?.message || 'Amazon sign-in failed.';
          console.error('[Amazon Auth] Backend exchange error:', msg);
          setAuthError(msg);
        })
        .finally(() => {
          setIsLoading(false);
        });
      return;
    }

    // Sync active session & DynamoDB role via /auth/me (or refresh if expired) on initial load
    const currentTokens = tokens;
    if (!currentTokens?.access_token) return;

    getMeApi(currentTokens.access_token)
      .then((freshUser) => {
        saveAuthData(freshUser, currentTokens);
      })
      .catch(async () => {
        if (!currentTokens.refresh_token) {
          clearAuthData();
          return;
        }
        try {
          const refreshed = await refreshTokens(currentTokens.refresh_token);
          const nextTokens: AuthTokens = {
            ...currentTokens,
            access_token: refreshed.access_token,
            expires_in: refreshed.expires_in,
          };
          const freshUser = await getMeApi(nextTokens.access_token);
          saveAuthData(freshUser, nextTokens);
        } catch {
          clearAuthData();
        }
      });
  }, []);

  const applyAuthStep = (result: AuthStepResult): OtpChallengeResponse | null => {
    if (result.status === 'requires_2fa') {
      setPendingOtpChallenge(result.challenge);
      return result.challenge;
    }
    setPendingOtpChallenge(null);
    saveAuthData(result.user, result.tokens);
    setIsAuthModalOpen(false);
    return null;
  };

  const login = async (email: string, password: string): Promise<OtpChallengeResponse | null> => {
    setIsLoading(true);
    try {
      return applyAuthStep(await loginWithCredentials(email, password));
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (email: string, password: string): Promise<OtpChallengeResponse | null> => {
    setIsLoading(true);
    try {
      return applyAuthStep(await registerWithCredentials(email, password));
    } finally {
      setIsLoading(false);
    }
  };

  const verifyOtp = async (email: string, otpCode: string, challengeToken: string) => {
    setIsLoading(true);
    try {
      const result = await verifyOtpCode({ email, otpCode, challengeToken });
      setPendingOtpChallenge(null);
      saveAuthData(result.user, result.tokens);
      setIsAuthModalOpen(false);
    } finally {
      setIsLoading(false);
    }
  };

  const resendOtp = async (
    email: string,
    challengeToken: string
  ): Promise<OtpChallengeResponse> => {
    setIsLoading(true);
    try {
      const challenge = await resendOtpCode({ email, challengeToken });
      setPendingOtpChallenge(challenge);
      return challenge;
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithAmazon = async () => {
    setIsLoading(true);
    try {
      const redirect = await getAmazonGatewayRedirect();
      if (redirect.clientIdConfigured && redirect.url) {
        window.location.href = redirect.url;
        return;
      }
      throw new Error(
        `Login with Amazon (LWA) Client ID is not configured yet. Add ${redirect.missingEnvVar} in frontend/.env to enable direct Amazon sign-in gateway redirection.`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      if (tokens?.refresh_token) {
        await logoutTokens(tokens.refresh_token, tokens.access_token);
      }
    } catch {
      // Safe
    } finally {
      clearAuthData();
      setIsLoading(false);
    }
  };

  const refreshSession = async () => {
    if (!tokens?.refresh_token) return;
    try {
      const res = await refreshTokens(tokens.refresh_token);
      if (res.access_token && user) {
        saveAuthData(user, {
          ...tokens,
          access_token: res.access_token,
          expires_in: res.expires_in,
        });
      }
    } catch (err) {
      console.warn('[AuthContext] Token refresh error:', err);
    }
  };

  const openAuthModal = useCallback((initialTab: 'signin' | 'register' = 'signin') => {
    setAuthModalTab(initialTab);
    setIsAuthModalOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    setIsAuthModalOpen(false);
  }, []);

  const role: UserRole = user?.role || 'guest';
  const accessToken = tokens?.access_token;
  const isAuthenticated = Boolean(user && tokens?.access_token);

  const session: AuthSession = {
    user,
    tokens,
    role,
    email: user?.email || '',
    token: tokens?.access_token,
    isAuthenticated,
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        tokens,
        role,
        accessToken,
        isAuthenticated,
        isLoading,
        authError,
        clearAuthError,
        pendingOtpChallenge,
        clearPendingOtpChallenge,
        isAuthModalOpen,
        openAuthModal,
        closeAuthModal,
        authModalTab,
        setAuthModalTab,
        login,
        register,
        verifyOtp,
        resendOtp,
        loginWithAmazon,
        logout,
        refreshSession,
        session,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
