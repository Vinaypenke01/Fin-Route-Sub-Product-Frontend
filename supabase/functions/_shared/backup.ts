// ==============================================================================
// Tenant backup helpers (shared by the tenant-backup Edge Function and tests)
// ==============================================================================

/** Tables copied into every backup, in restore order (parents before children). */
export const BACKUP_TABLES = [
  'tenant_settings',
  'villages',
  'weeks',
  'customers',
  'payments',
  'weekly_reconciliation',
  'loan_archive',
  'audit_logs',
  'change_log',
  'finroute_schema_version',
] as const;

export const BACKUP_FORMAT = 'finroute-tenant-backup';
export const BACKUP_FORMAT_VERSION = 1;
export const BACKUP_BUCKET = 'tenant-backups';

const PAGE = 1000;

/** Reads every row of every backup table (missing tables are skipped). */
export async function exportTenantTables(client: any): Promise<{ tables: Record<string, unknown[]>; rowCounts: Record<string, number>; missing: string[] }> {
  const tables: Record<string, unknown[]> = {};
  const rowCounts: Record<string, number> = {};
  const missing: string[] = [];

  for (const table of BACKUP_TABLES) {
    const rows: unknown[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await client.from(table).select('*').range(from, from + PAGE - 1);
      if (error) {
        if (error.code === '42P01' || error.code === 'PGRST205' || /does not exist|could not find/i.test(error.message || '')) {
          missing.push(table);
          break;
        }
        throw new Error(`${table}: ${error.message}`);
      }
      rows.push(...(data || []));
      if (!data || data.length < PAGE) break;
    }
    if (!missing.includes(table)) {
      tables[table] = rows;
      rowCounts[table] = rows.length;
    }
  }
  return { tables, rowCounts, missing };
}

/** "2026-11-24T21-30-05Z.json" style names sort by time and are safe as paths. */
export function backupFileName(date: Date = new Date()): string {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z').replace(/:/g, '-') + '.json';
}

export function parseBackupFileName(name: string): Date | null {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})Z\.json$/.exec(name);
  if (!m) return null;
  const d = new Date(`${m[1]}T${m[2]}:${m[3]}:${m[4]}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Retention: keep every backup from the last `dailyDays` days, plus the first
 * backup of each month for the last `monthly` months. Returns names to delete.
 * Files that don't look like backups are never deleted.
 */
export function selectBackupsToDelete(names: string[], now: Date = new Date(), dailyDays = 30, monthly = 12): string[] {
  const parsed = names
    .map(name => ({ name, date: parseBackupFileName(name) }))
    .filter((x): x is { name: string; date: Date } => x.date !== null)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const dailyCutoff = now.getTime() - dailyDays * 24 * 60 * 60 * 1000;
  const monthCutoff = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (monthly - 1), 1)).getTime();

  const keep = new Set<string>();
  const firstOfMonth = new Map<string, string>();
  for (const { name, date } of parsed) {
    if (date.getTime() >= dailyCutoff) keep.add(name);
    const monthKey = `${date.getUTCFullYear()}-${date.getUTCMonth()}`;
    if (!firstOfMonth.has(monthKey) && date.getTime() >= monthCutoff) firstOfMonth.set(monthKey, name);
  }
  firstOfMonth.forEach(name => keep.add(name));

  return parsed.filter(x => !keep.has(x.name)).map(x => x.name);
}
