export type UserRole = 'guest' | 'user' | 'admin';

export interface AuthUser {
  user_id: string;
  email: string;
  role: UserRole;
  name?: string;
  provider?: 'local' | 'amazon';
  avatar?: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
}

export interface AuthSession {
  user: AuthUser | null;
  role: UserRole;
  email: string;
  token?: string;
  tokens?: AuthTokens | null;
  isAuthenticated: boolean;
}

export interface LoginResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
  user: {
    user_id: string;
    email: string;
    role: UserRole;
    name?: string;
    auth_provider?: string;
  };
}

export interface RegisterResponse {
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
  requires_2fa?: boolean;
  purpose?: 'register' | 'login' | 'amazon';
  email?: string;
  challenge_token?: string;
  cooldown_seconds?: number;
  message?: string;
  user: {
    user_id: string;
    email: string;
    role: UserRole;
  };
}

export interface OtpChallengeResponse {
  requires_2fa: true;
  purpose: 'register' | 'login' | 'amazon';
  email: string;
  challenge_token: string;
  expires_in: number;
  cooldown_seconds: number;
  message?: string;
}

export type AuthStepResult =
  | { status: 'authenticated'; user: AuthUser; tokens: AuthTokens }
  | { status: 'requires_2fa'; challenge: OtpChallengeResponse };
