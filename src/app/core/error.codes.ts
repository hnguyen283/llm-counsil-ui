/**
 * Stable machine-readable codes returned by the auth-service and gateway
 * (as both an `X-Auth-Code` header and a body `code` field).
 *
 * Centralising the vocabulary here means UI copy and routing decisions live
 * next to the contract.
 */
export const AuthCode = {
  /** Access token expired. Interceptor handles with a silent refresh. */
  EXPIRED:    'AUTH_001',
  /** Session displaced — another device signed in. Force re-login. */
  DISPLACED:  'AUTH_002',
  /** Refresh token reused or unknown. Force re-login. */
  REUSED:     'AUTH_003',
  /** Account locked or disabled. */
  LOCKED:     'AUTH_004',
  /** Invalid credentials. Stay on the login page; clear password field. */
  INVALID:    'AUTH_005',
  /** Refresh token missing. Force re-login. */
  NO_REFRESH: 'AUTH_006',
  /** Authentication backend unavailable (Redis down, fail-closed). */
  BACKEND:    'AUTH_007',
  /** Token version stale — role/permission change. Force re-login. */
  STALE:      'AUTH_008',
} as const;

export type AuthCodeValue = typeof AuthCode[keyof typeof AuthCode];

/**
 * Reason codes for the /login?reason= query param. These translate to UI
 * copy in the login page and are stable for analytics.
 */
export const LoginReason = {
  EXPIRED:    'expired',
  DISPLACED:  'displaced',
  REUSED:     'reused',
  LOCKED:     'locked',
  DISABLED:   'disabled',
  INVALID:    'invalid',
  LOGGED_OUT: 'logged_out',
  STALE:      'stale',
  SIGNED_UP:  'signed_up',
} as const;

export type LoginReasonValue = typeof LoginReason[keyof typeof LoginReason];

/** Maps an AUTH_* code to the equivalent /login reason. */
export function reasonFor(code: string | null | undefined): LoginReasonValue {
  switch (code) {
    case AuthCode.EXPIRED:   return LoginReason.EXPIRED;
    case AuthCode.DISPLACED: return LoginReason.DISPLACED;
    case AuthCode.REUSED:    return LoginReason.REUSED;
    case AuthCode.LOCKED:    return LoginReason.LOCKED;
    case AuthCode.INVALID:   return LoginReason.INVALID;
    case AuthCode.STALE:     return LoginReason.STALE;
    default:                 return LoginReason.LOGGED_OUT;
  }
}
