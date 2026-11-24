// Removes personal data from error text before it is stored or shown.

/**
 * - phone numbers / long digit runs (6+ digits) -> [number]
 * - email addresses (except `keepEmail`)          -> [email]
 * - Telugu text (names, villages)                  -> [text]
 * - bearer tokens / Supabase keys                  -> [secret]
 */
export function scrubText(input: unknown, keepEmail = '', maxLength = 2000): string {
  let s = String(input ?? '');
  s = s.replace(/\b(Bearer\s+)[A-Za-z0-9._-]+/gi, '$1[secret]');
  s = s.replace(/\bsb_(?:secret|publishable)_[A-Za-z0-9_-]+/g, '[secret]');
  s = s.replace(/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[secret]');
  const keep = String(keepEmail || '').toLowerCase();
  s = s.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, m => (m.toLowerCase() === keep ? m : '[email]'));
  s = s.replace(/\+?\d[\d\s-]{4,}\d/g, m => (m.replace(/\D/g, '').length >= 6 ? '[number]' : m));
  s = s.replace(/[ఀ-౿]+(?:\s+[ఀ-౿]+)*/g, '[text]');
  return s.length > maxLength ? s.slice(0, maxLength) + '…' : s;
}
