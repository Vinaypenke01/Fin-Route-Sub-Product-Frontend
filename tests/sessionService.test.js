import { describe, it, expect, beforeEach } from 'vitest';
import { SESSION_AUTH_KEY, getValidStoredSession, getTenantStorageKey } from '../src/services/sessionService';

class MemoryStorage {
  constructor() { this.map = new Map(); }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}

beforeEach(() => {
  globalThis.localStorage = new MemoryStorage();
  globalThis.sessionStorage = new MemoryStorage();
});

const store = (obj, where = localStorage) => where.setItem(SESSION_AUTH_KEY, JSON.stringify(obj));

describe('getValidStoredSession', () => {
  it('returns a valid Supabase tenant session', () => {
    store({ email: 'op@example.com', isSupabaseTenant: true, expiresAt: Date.now() + 60_000 });
    expect(getValidStoredSession()?.email).toBe('op@example.com');
  });

  it('never returns a password and scrubs it from storage', () => {
    store({ email: 'op@example.com', isSupabaseTenant: true, password: 'secret', expiresAt: Date.now() + 60_000 });
    const s = getValidStoredSession();
    expect(s.password).toBeUndefined();
    expect(localStorage.getItem(SESSION_AUTH_KEY)).not.toContain('secret');
  });

  it('clears retired Google Sheets sessions', () => {
    store({ email: 'op@example.com', password: 'x', sheetUrl: 'https://script.google.com/x/exec' });
    expect(getValidStoredSession()).toBeNull();
    expect(localStorage.getItem(SESSION_AUTH_KEY)).toBeNull();
  });

  it('clears expired sessions', () => {
    store({ email: 'op@example.com', isSupabaseTenant: true, expiresAt: Date.now() - 1 }, sessionStorage);
    expect(getValidStoredSession()).toBeNull();
    expect(sessionStorage.getItem(SESSION_AUTH_KEY)).toBeNull();
  });

  it('ignores corrupt data', () => {
    localStorage.setItem(SESSION_AUTH_KEY, '{not json');
    expect(getValidStoredSession()).toBeNull();
  });
});

describe('getTenantStorageKey', () => {
  it('is per email and case-insensitive', () => {
    expect(getTenantStorageKey('Op@Example.com')).toBe(getTenantStorageKey('op@example.com'));
    expect(getTenantStorageKey('a@x.com')).not.toBe(getTenantStorageKey('b@x.com'));
  });
});
