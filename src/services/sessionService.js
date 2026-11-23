export const SESSION_AUTH_KEY = 'SUNDAY_AUTH_SESSION_V1';
// Google Sheets mode was retired; this key is only cleared on logout.
export const LEGACY_SHEET_URL_KEY = 'SUNDAY_MONEY_TRACKER_GS_URL';

/**
 * Dynamic tenant-scoped storage key function (isolates data per tenant)
 */
export function getTenantStorageKey(email) {
  if (!email) return 'SUNDAY_MONEY_TRACKER_STATE_GUEST';
  return `FINROUTE_DATA_${encodeURIComponent(String(email).trim().toLowerCase())}`;
}

function clearStoredSession() {
  sessionStorage.removeItem(SESSION_AUTH_KEY);
  localStorage.removeItem(SESSION_AUTH_KEY);
}

/**
 * Safely retrieve and validate stored session with expiration check.
 * Sessions never contain a password; the tenant DB session itself is kept by
 * supabase-js under its own storage key.
 */
export function getValidStoredSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_AUTH_KEY) || localStorage.getItem(SESSION_AUTH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);

    // Old Google Sheets sessions are no longer supported: sign in again.
    if (!parsed?.email || !parsed.isSupabaseTenant) {
      clearStoredSession();
      return null;
    }

    // Scrub passwords saved by older versions of the app
    if (parsed.password) {
      delete parsed.password;
      const target = localStorage.getItem(SESSION_AUTH_KEY) ? localStorage : sessionStorage;
      target.setItem(SESSION_AUTH_KEY, JSON.stringify(parsed));
    }

    if (parsed.expiresAt && Date.now() > parsed.expiresAt) {
      clearStoredSession();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
