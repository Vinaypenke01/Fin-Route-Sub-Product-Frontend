import { describe, it, expect } from 'vitest';
import { passwordProblem, passwordStrength, PASSWORD_MIN_LENGTH } from '../supabase/functions/_shared/password.ts';

describe('password rule', () => {
  it('accepts a reasonable password', () => {
    expect(passwordProblem('Sunday collections 2026')).toBeNull();
    expect(passwordProblem('k8#Pq2!mZr')).toBeNull();
  });

  it(`requires at least ${PASSWORD_MIN_LENGTH} characters`, () => {
    expect(passwordProblem('Kovuru@1')).toMatch(/at least 10/);
    expect(passwordProblem('')).toMatch(/at least 10/);
  });

  it('rejects common and repeated passwords', () => {
    expect(passwordProblem('Password123')).toMatch(/too common/);
    expect(passwordProblem('aaaaaaaaaaaa')).toMatch(/repeat/);
  });

  it('rejects passwords containing the email name', () => {
    expect(passwordProblem('ravikumar2026!', 'ravikumar@example.com')).toMatch(/email name/);
    expect(passwordProblem('Long enough pass', 'ab@example.com')).toBeNull(); // very short names ignored
  });

  it('rejects leading/trailing spaces and over-long passwords', () => {
    expect(passwordProblem(' spaces around ')).toMatch(/space/);
    expect(passwordProblem('x'.repeat(40) + 'y'.repeat(40))).toMatch(/at most 72/);
  });

  it('rates strength for the hint', () => {
    expect(passwordStrength('short')).toBe('weak');
    expect(passwordStrength('onlylowercase')).toBe('ok');
    expect(passwordStrength('Mixed1Case!')).toBe('strong');
    expect(passwordStrength('a long simple phrase')).toBe('strong');
  });
});
