import type {
  AuthStepResult,
  AuthTokens,
  AuthUser,
  LoginResponse,
  OtpChallengeResponse,
} from '../types/auth';

export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || ''
).replace(/\/+$/, '');

async function extractApiError(res: Response, fallback: string): Promise<string> {
  try {
    const errJson = await res.json();
    return errJson.error || errJson.message || fallback;
  } catch {
    return fallback;
  }
}

function parseAuthStepPayload(
  data: any,
  defaultProvider: 'local' | 'amazon' = 'local'
): AuthStepResult {
  if (data?.requires_2fa && data?.challenge_token) {
    return {
      status: 'requires_2fa',
      challenge: {
        requires_2fa: true,
        purpose: data.purpose || 'login',
        email: data.email || '',
        challenge_token: data.challenge_token,
        expires_in: Number(data.expires_in) || 600,
        cooldown_seconds: Number(data.cooldown_seconds) || 60,
        message: data.message,
      },
    };
  }

  const typed = data as LoginResponse;
  const user: AuthUser = {
    user_id: typed.user.user_id,
    email: typed.user.email,
    role: typed.user.role || 'user',
    name: typed.user.name || typed.user.email.split('@')[0],
    provider:
      defaultProvider === 'amazon' || typed.user.auth_provider?.includes('amazon')
        ? 'amazon'
        : 'local',
  };

  const tokens: AuthTokens = {
    access_token: typed.access_token,
    refresh_token: typed.refresh_token,
    token_type: typed.token_type,
    expires_in: typed.expires_in,
  };

  return { status: 'authenticated', user, tokens };
}

/**
 * Log in with user credentials via AWS API Gateway (/auth/login).
 * Returns either issued tokens or a 2FA OTP challenge.
 */
export async function loginWithCredentials(
  email: string,
  password: string
): Promise<AuthStepResult> {
  const cleanEmail = email.trim().toLowerCase();
  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: cleanEmail, password }),
  });

  if (!res.ok) {
    throw new Error(await extractApiError(res, 'Invalid email or password.'));
  }

  return parseAuthStepPayload(await res.json(), 'local');
}

/**
 * Register a new user via AWS API Gateway (/auth/register).
 * Triggers a 6-digit email verification OTP challenge before issuing tokens.
 */
export async function registerWithCredentials(
  email: string,
  password: string
): Promise<AuthStepResult> {
  const cleanEmail = email.trim().toLowerCase();
  const res = await fetch(`${API_BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: cleanEmail, password }),
  });

  if (!res.ok) {
    throw new Error(
      await extractApiError(res, 'Registration failed. User may already exist.')
    );
  }

  return parseAuthStepPayload(await res.json(), 'local');
}

/**
 * Verify a 6-digit email OTP code via AWS API Gateway (/auth/verify-otp)
 * and receive full HeatSafe JWT + refresh session tokens.
 */
export async function verifyOtpCode(params: {
  email: string;
  otpCode: string;
  challengeToken: string;
}): Promise<{ user: AuthUser; tokens: AuthTokens }> {
  const res = await fetch(`${API_BASE_URL}/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: params.email.trim().toLowerCase(),
      otp_code: params.otpCode.trim(),
      challenge_token: params.challengeToken,
    }),
  });

  if (!res.ok) {
    throw new Error(await extractApiError(res, 'Invalid or expired 6-digit code.'));
  }

  const parsed = parseAuthStepPayload(await res.json(), 'local');
  if (parsed.status !== 'authenticated') {
    throw new Error('Unexpected verification response.');
  }
  return { user: parsed.user, tokens: parsed.tokens };
}

/**
 * Request a fresh 6-digit email OTP code (/auth/resend-otp).
 */
export async function resendOtpCode(params: {
  email: string;
  challengeToken: string;
}): Promise<OtpChallengeResponse> {
  const res = await fetch(`${API_BASE_URL}/auth/resend-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: params.email.trim().toLowerCase(),
      challenge_token: params.challengeToken,
    }),
  });

  if (!res.ok) {
    throw new Error(await extractApiError(res, 'Could not resend verification code.'));
  }

  const parsed = parseAuthStepPayload(await res.json(), 'local');
  if (parsed.status !== 'requires_2fa') {
    throw new Error('Unexpected resend OTP response.');
  }
  return parsed.challenge;
}

/**
 * Invalidate session on server via AWS API Gateway (/auth/logout).
 */
export async function logoutTokens(refreshToken?: string, accessToken?: string): Promise<void> {
  if (!refreshToken) return;
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

    await fetch(`${API_BASE_URL}/auth/logout`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
  } catch (err) {
    console.warn('[AuthApi] Logout request failed non-blocking:', err);
  }
}

/**
 * Refresh access token using refresh_token (/auth/refresh).
 */
export async function refreshTokens(
  refreshToken: string
): Promise<{ access_token: string; expires_in: number }> {
  const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!res.ok) {
    throw new Error('Failed to refresh session');
  }

  return await res.json();
}

/**
 * Fetch authenticated user profile (/auth/me).
 */
export async function getMeApi(accessToken: string): Promise<AuthUser> {
  const res = await fetch(`${API_BASE_URL}/auth/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    throw new Error('Session invalid or expired');
  }

  const data = await res.json();
  return {
    user_id: data.user.user_id,
    email: data.user.email,
    role: data.user.role || 'user',
    name: data.user.name || data.user.email.split('@')[0],
    provider: data.user.auth_provider?.includes('amazon') ? 'amazon' : 'local',
  };
}

// ========================================================
// Login with Amazon (LWA) — Authorization Code Grant with PKCE
// (Required by Amazon since deprecation of Implicit Grant)
// ========================================================

function dec2hex(dec: number): string {
  return ('0' + dec.toString(16)).substr(-2);
}

function generateRandomString(len = 64): string {
  const array = new Uint32Array(len / 2);
  window.crypto.getRandomValues(array);
  return Array.from(array, dec2hex).join('');
}

function base64urlencode(buffer: ArrayBuffer): string {
  let str = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    str += String.fromCharCode(bytes[i]);
  }
  return btoa(str)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function sha256(plain: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return window.crypto.subtle.digest('SHA-256', data);
}

export async function createPkceChallenge(): Promise<{ verifier: string; challenge: string }> {
  const verifier = generateRandomString(64);
  const hashed = await sha256(verifier);
  const challenge = base64urlencode(hashed);
  return { verifier, challenge };
}

/**
 * Login with Amazon (LWA) OAuth 2.0 Gateway with PKCE.
 * Inspects VITE_AMAZON_CLIENT_ID and generates direct Amazon OAuth redirect URL with code_challenge.
 */
export async function getAmazonGatewayRedirect(): Promise<{
  url: string | null;
  clientIdConfigured: boolean;
  missingEnvVar: string;
}> {
  const clientId = import.meta.env.VITE_AMAZON_CLIENT_ID;
  if (!clientId) {
    return {
      url: null,
      clientIdConfigured: false,
      missingEnvVar: 'VITE_AMAZON_CLIENT_ID',
    };
  }

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';
  const redirectUri = encodeURIComponent(`${currentOrigin}/`);
  
  const { verifier, challenge } = await createPkceChallenge();
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('lwa_code_verifier', verifier);
  }

  // Modern Authorization Code Grant with PKCE
  const url = `https://www.amazon.com/ap/oa?client_id=${encodeURIComponent(
    clientId
  )}&scope=profile&response_type=code&redirect_uri=${redirectUri}&code_challenge=${encodeURIComponent(
    challenge
  )}&code_challenge_method=S256`;

  return { url, clientIdConfigured: true, missingEnvVar: 'VITE_AMAZON_CLIENT_ID' };
}

/**
 * Exchange Authorization Code via HeatSafe backend (/auth/amazon) so Amazon
 * credentials are verified server-side, stored in HeatSafe_Users (DynamoDB),
 * and issued a HeatSafe JWT + session in HeatSafe_Sessions.
 */
export async function loginWithAmazonBackend(params: {
  code: string;
  redirectUri: string;
  codeVerifier?: string;
}): Promise<AuthStepResult> {
  const res = await fetch(`${API_BASE_URL}/auth/amazon`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code: params.code,
      redirect_uri: params.redirectUri,
      ...(params.codeVerifier ? { code_verifier: params.codeVerifier } : {}),
    }),
  });

  if (!res.ok) {
    throw new Error(await extractApiError(res, 'Amazon sign-in failed on server.'));
  }

  return parseAuthStepPayload(await res.json(), 'amazon');
}
