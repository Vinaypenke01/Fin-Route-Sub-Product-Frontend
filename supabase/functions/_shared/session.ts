// ==============================================================================
// One active device per tenant: shared rules for Edge Functions
// ==============================================================================

/** A device that hasn't sent a heartbeat for this long no longer holds the account. */
export const SESSION_TIMEOUT_MS = 5 * 60 * 1000;

export interface ActiveSessionRow {
  session_id: string;
  device_label?: string | null;
  last_seen_at: string;
}

export type LoginDecision =
  | { allow: true }
  | { allow: false; deviceLabel: string; minutesAgo: number };

/**
 * Decide whether `deviceSessionId` may sign in, given the tenant's current row.
 * - no row, or row from this same device  -> allow
 * - row from another device seen within the timeout -> refuse
 * - row from another device that went quiet -> allow (it is taken over)
 */
export function decideLogin(
  row: ActiveSessionRow | null | undefined,
  deviceSessionId: string,
  now: number = Date.now(),
  timeoutMs: number = SESSION_TIMEOUT_MS,
): LoginDecision {
  if (!row) return { allow: true };
  if (row.session_id === deviceSessionId) return { allow: true };
  const lastSeen = new Date(row.last_seen_at).getTime();
  if (!Number.isFinite(lastSeen) || now - lastSeen >= timeoutMs) return { allow: true };
  return {
    allow: false,
    deviceLabel: row.device_label || 'another device',
    minutesAgo: Math.max(0, Math.floor((now - lastSeen) / 60000)),
  };
}

export function inUseMessage(d: { deviceLabel: string; minutesAgo: number }): string {
  const when = d.minutesAgo <= 0 ? 'just now' : `${d.minutesAgo} min ago`;
  return `This account is already open on another device (${d.deviceLabel}, active ${when}). ` +
    'Log out there first, or wait 5 minutes after closing it. Lost the phone? Ask your administrator to end that session.';
}

/** Device session ids are random UUIDs generated in the browser. */
export function isValidDeviceSessionId(id: unknown): id is string {
  return typeof id === 'string' && /^[A-Za-z0-9-]{16,64}$/.test(id);
}

export function cleanDeviceLabel(label: unknown): string {
  return String(label || 'Unknown device').replace(/[^\w .,()/+-]/g, '').slice(0, 80) || 'Unknown device';
}
