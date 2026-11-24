// Free-tier database limit used for warnings (Supabase Free: 500 MB per project).
export const FREE_TIER_DB_BYTES = 500 * 1024 * 1024;

/** { text, percent, level: 'ok' | 'warn' | 'danger' } for a database size. */
export function describeDbSize(bytes, limit = FREE_TIER_DB_BYTES) {
  if (bytes === null || bytes === undefined || bytes === '') return null;
  const n = Number(bytes);
  if (!Number.isFinite(n) || n < 0) return null;
  const percent = Math.round((n / limit) * 100);
  const mb = n / (1024 * 1024);
  const text = `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB of ${Math.round(limit / (1024 * 1024))} MB (${percent}%)`;
  const level = percent >= 90 ? 'danger' : percent >= 70 ? 'warn' : 'ok';
  return { text, percent, level };
}
