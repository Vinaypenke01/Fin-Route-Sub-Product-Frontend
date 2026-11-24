// ==============================================================================
// Password rule, shared by the Edge Functions and the web app (single source).
// ==============================================================================

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 72; // bcrypt only uses the first 72 bytes

const COMMON = new Set([
  'password', 'password1', 'password12', 'password123', 'password1234',
  '1234567890', '12345678910', '0123456789', '9876543210', '1111111111',
  'qwertyuiop', 'qwerty12345', 'iloveyou12', 'admin12345', 'welcome123',
  'finroute123', 'finroute@123', 'abcdefghij', 'abcd123456', 'india12345',
]);

/**
 * Returns null when the password is acceptable, otherwise a short
 * plain-language reason the user can act on.
 */
export function passwordProblem(password: string, email = ''): string | null {
  const pw = String(password || '');
  if (pw.trim() !== pw) return 'Password must not start or end with a space.';
  if (pw.length < PASSWORD_MIN_LENGTH) return `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  if (pw.length > PASSWORD_MAX_LENGTH) return `Use at most ${PASSWORD_MAX_LENGTH} characters.`;
  if (/^(.)\1+$/.test(pw)) return 'Don’t repeat one character.';
  if (COMMON.has(pw.toLowerCase())) return 'That password is too common. Choose something less guessable.';

  const localPart = String(email || '').split('@')[0].toLowerCase();
  if (localPart.length >= 4 && pw.toLowerCase().includes(localPart)) {
    return 'Don’t include your email name in the password.';
  }
  return null;
}

/** Rough strength for the hint shown under password fields. */
export function passwordStrength(password: string): 'weak' | 'ok' | 'strong' {
  const pw = String(password || '');
  if (pw.length < PASSWORD_MIN_LENGTH) return 'weak';
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter(r => r.test(pw)).length;
  return pw.length >= 14 || kinds >= 3 ? 'strong' : 'ok';
}
