import { describe, it, expect } from 'vitest';
import { decideLogin, inUseMessage, isValidDeviceSessionId, cleanDeviceLabel, SESSION_TIMEOUT_MS } from '../supabase/functions/_shared/session.ts';
import { getDeviceLabel } from '../src/services/deviceSession';

const NOW = Date.parse('2026-11-24T10:00:00Z');
const ago = (ms) => new Date(NOW - ms).toISOString();
const A = 'device-aaaaaaaaaaaaaaaa';
const B = 'device-bbbbbbbbbbbbbbbb';

describe('one active device per tenant', () => {
  it('allows the first login', () => {
    expect(decideLogin(null, A, NOW)).toEqual({ allow: true });
  });

  it('allows the same device again (reload, re-login)', () => {
    expect(decideLogin({ session_id: A, last_seen_at: ago(10_000) }, A, NOW)).toEqual({ allow: true });
  });

  it('refuses a second device while the first is active', () => {
    const d = decideLogin({ session_id: A, device_label: 'Chrome on Android', last_seen_at: ago(2 * 60_000) }, B, NOW);
    expect(d).toEqual({ allow: false, deviceLabel: 'Chrome on Android', minutesAgo: 2 });
    expect(inUseMessage(d)).toContain('Chrome on Android, active 2 min ago');
  });

  it('allows a second device once the first has been quiet for 5 minutes', () => {
    expect(decideLogin({ session_id: A, last_seen_at: ago(SESSION_TIMEOUT_MS) }, B, NOW)).toEqual({ allow: true });
    expect(decideLogin({ session_id: A, last_seen_at: ago(SESSION_TIMEOUT_MS - 1000) }, B, NOW).allow).toBe(false);
  });

  it('treats a broken timestamp as expired', () => {
    expect(decideLogin({ session_id: A, last_seen_at: 'nonsense' }, B, NOW)).toEqual({ allow: true });
  });

  it('says "just now" for a heartbeat in the last minute', () => {
    const d = decideLogin({ session_id: A, last_seen_at: ago(5_000) }, B, NOW);
    expect(inUseMessage(d)).toContain('active just now');
  });
});

describe('input checks', () => {
  it('accepts only well-formed device ids', () => {
    expect(isValidDeviceSessionId('3f0e8a52-6c7b-4b8e-9a3a-2f6f1c2d9e10')).toBe(true);
    expect(isValidDeviceSessionId('short')).toBe(false);
    expect(isValidDeviceSessionId('bad id with spaces and more')).toBe(false);
    expect(isValidDeviceSessionId(null)).toBe(false);
  });

  it('cleans device labels', () => {
    expect(cleanDeviceLabel('<script>Chrome</script> on Android')).toBe('scriptChrome/script on Android');
    expect(cleanDeviceLabel('')).toBe('Unknown device');
    expect(cleanDeviceLabel('x'.repeat(200))).toHaveLength(80);
  });

  it('describes common phones and browsers', () => {
    expect(getDeviceLabel('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36')).toBe('Chrome on Android');
    expect(getDeviceLabel('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit Version/17.0 Mobile Safari/604.1')).toBe('Safari on iPhone/iPad');
    expect(getDeviceLabel('Mozilla/5.0 (Windows NT 10.0) AppleWebKit Chrome/120 Safari/537.36 Edg/120')).toBe('Edge on Windows');
  });
});
