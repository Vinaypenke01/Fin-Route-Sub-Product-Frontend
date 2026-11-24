import { describe, it, expect } from 'vitest';
import { scrubText } from '../supabase/functions/_shared/scrub.ts';
import { shouldSend } from '../src/services/errorReporter';
import { describeDbSize, FREE_TIER_DB_BYTES } from '../src/utils/dbSize';

describe('scrubText removes personal data', () => {
  it('removes phone numbers and long numbers, keeps short ones', () => {
    expect(scrubText('Call 9494544713 or +91 98480 22338 about row 12')).toBe('Call [number] or [number] about row 12');
  });

  it('removes other emails but keeps the tenant email', () => {
    expect(scrubText('op@x.com saw borrower a.b@gmail.com', 'op@x.com')).toBe('op@x.com saw borrower [email]');
  });

  it('removes Telugu text (names, villages)', () => {
    expect(scrubText('Failed for కొల్లు లక్ష్మి in రాంపూర్')).toBe('Failed for [text] in [text]');
  });

  it('removes keys and tokens', () => {
    expect(scrubText('apikey sb_secret_abc123XYZ and Bearer eyJhbGciOi.payload.sig')).toBe('apikey [secret] and Bearer [secret]');
    expect(scrubText('jwt eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abc')).toBe('jwt [secret]');
  });

  it('limits length', () => {
    expect(scrubText('x'.repeat(50), '', 10)).toBe('xxxxxxxxxx…');
  });
});

describe('error report throttling', () => {
  it('sends the same message once per 10 minutes', () => {
    const state = { recent: new Map(), sent: [] };
    expect(shouldSend('boom', 0, state)).toBe(true);
    expect(shouldSend('boom', 60_000, state)).toBe(false);
    expect(shouldSend('boom', 11 * 60_000, state)).toBe(true);
  });

  it('sends at most 5 reports per minute', () => {
    const state = { recent: new Map(), sent: [] };
    const results = Array.from({ length: 7 }, (_, i) => shouldSend(`err ${i}`, 1000 + i, state));
    expect(results).toEqual([true, true, true, true, true, false, false]);
    expect(shouldSend('later', 70_000, state)).toBe(true);
  });
});

describe('database size warnings', () => {
  it('describes size and level', () => {
    expect(describeDbSize(5 * 1024 * 1024)).toEqual({ text: '5.0 MB of 500 MB (1%)', percent: 1, level: 'ok' });
    expect(describeDbSize(FREE_TIER_DB_BYTES * 0.75).level).toBe('warn');
    expect(describeDbSize(FREE_TIER_DB_BYTES * 0.95).level).toBe('danger');
  });

  it('ignores missing values', () => {
    expect(describeDbSize(null)).toBeNull();
    expect(describeDbSize(undefined)).toBeNull();
  });
});
