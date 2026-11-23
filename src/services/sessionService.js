export const SESSION_AUTH_KEY = 'SUNDAY_AUTH_SESSION_V1';
export const GOOGLE_SCRIPT_URL_KEY = 'SUNDAY_MONEY_TRACKER_GS_URL';

/**
 * Dynamic tenant-scoped storage key function (isolates data per tenant)
 */
export function getTenantStorageKey(email) {
  if (!email) return 'SUNDAY_MONEY_TRACKER_STATE_GUEST';
  return `FINROUTE_DATA_${encodeURIComponent(String(email).trim().toLowerCase())}`;
}

/**
 * Safely retrieve and validate stored session with expiration check
 */
export function getValidStoredSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_AUTH_KEY) || localStorage.getItem(SESSION_AUTH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.email) return null;
    // Google Sheets sessions need the password for every sync call; Supabase
    // tenant sessions never store it (the tenant DB session is kept by supabase-js).
    if (!parsed.isSupabaseTenant && !parsed.password) return null;
    // Scrub passwords saved by older versions of the app
    if (parsed.isSupabaseTenant && parsed.password) {
      delete parsed.password;
      const target = localStorage.getItem(SESSION_AUTH_KEY) ? localStorage : sessionStorage;
      target.setItem(SESSION_AUTH_KEY, JSON.stringify(parsed));
    }
    if (parsed.expiresAt && Date.now() > parsed.expiresAt) {
      sessionStorage.removeItem(SESSION_AUTH_KEY);
      localStorage.removeItem(SESSION_AUTH_KEY);
      return null;
    }
    return parsed;
  } catch (e) {
    return null;
  }
}
