import { describe, it, expect } from 'vitest';
import {
  backupFileName,
  parseBackupFileName,
  selectBackupsToDelete,
  exportTenantTables,
  BACKUP_TABLES,
} from '../supabase/functions/_shared/backup.ts';
import { planRestore, validateBackup } from '../scripts/lib/restorePlan.js';

const dayName = (iso) => backupFileName(new Date(iso));

describe('backup file names', () => {
  it('round-trips and sorts by time', () => {
    const name = backupFileName(new Date('2026-11-24T21:30:05.123Z'));
    expect(name).toBe('2026-11-24T21-30-05Z.json');
    expect(parseBackupFileName(name).toISOString()).toBe('2026-11-24T21:30:05.000Z');
    expect(parseBackupFileName('notes.txt')).toBeNull();
  });
});

describe('retention: 30 daily + 12 monthly', () => {
  const now = new Date('2026-11-24T22:00:00Z');

  it('keeps the last 30 days', () => {
    const names = Array.from({ length: 30 }, (_, i) => dayName(new Date(now.getTime() - i * 86400000).toISOString()));
    expect(selectBackupsToDelete(names, now)).toEqual([]);
  });

  it('keeps only the first backup of older months, for 12 months', () => {
    const names = [
      dayName('2026-10-01T21:30:00Z'), dayName('2026-10-02T21:30:00Z'), // older than 30 days
      dayName('2026-09-01T21:30:00Z'), dayName('2026-09-15T21:30:00Z'),
      dayName('2025-11-01T21:30:00Z'), // 13 months back: outside 12
      dayName('2026-11-20T21:30:00Z'), // recent
    ];
    const del = selectBackupsToDelete(names, now);
    expect(del.sort()).toEqual([
      dayName('2025-11-01T21:30:00Z'),
      dayName('2026-09-15T21:30:00Z'),
      dayName('2026-10-02T21:30:00Z'),
    ].sort());
  });

  it('never deletes files that are not backups', () => {
    expect(selectBackupsToDelete(['README.txt', '.emptyFolderPlaceholder'], now)).toEqual([]);
  });
});

describe('exportTenantTables', () => {
  it('pages through large tables and skips missing ones', async () => {
    const big = Array.from({ length: 2500 }, (_, i) => ({ id: i }));
    const client = {
      from: (table) => ({
        select: () => ({
          range: async (from, to) => {
            if (table === 'change_log') return { data: null, error: { code: 'PGRST205', message: 'Could not find the table' } };
            if (table === 'payments') return { data: big.slice(from, to + 1), error: null };
            return { data: [{ id: table }], error: null };
          },
        }),
      }),
    };
    const { tables, rowCounts, missing } = await exportTenantTables(client);
    expect(rowCounts.payments).toBe(2500);
    expect(missing).toEqual(['change_log']);
    expect(Object.keys(tables)).toHaveLength(BACKUP_TABLES.length - 1);
  });

  it('fails loudly on real errors', async () => {
    const client = { from: () => ({ select: () => ({ range: async () => ({ data: null, error: { code: '42501', message: 'permission denied' } }) }) }) };
    await expect(exportTenantTables(client)).rejects.toThrow('permission denied');
  });
});

describe('restore plan', () => {
  const backup = {
    format: 'finroute-tenant-backup',
    formatVersion: 1,
    tables: {
      payments: [{ id: 'p1', customer_id: 'C1', week_id: 'w1', amount: 10 }],
      customers: [{ id: 'C1', name: 'A' }],
      weeks: [{ id: 'w1' }],
      change_log: [{ id: 99, table_name: 'payments' }],
      finroute_schema_version: [{ version: 3 }],
    },
  };

  it('restores parents before children with the right conflict keys', () => {
    const plan = planRestore(backup);
    expect(plan.map(p => p.table)).toEqual(['weeks', 'customers', 'payments', 'change_log']);
    expect(plan.find(p => p.table === 'payments').onConflict).toBe('customer_id,week_id');
  });

  it('gives change history new ids and does not touch the schema version', () => {
    const plan = planRestore(backup);
    expect(plan.find(p => p.table === 'change_log').batches[0][0]).toEqual({ table_name: 'payments' });
    expect(plan.some(p => p.table === 'finroute_schema_version')).toBe(false);
  });

  it('splits big tables into batches', () => {
    const many = { ...backup, tables: { customers: Array.from({ length: 1201 }, (_, i) => ({ id: `C${i}` })) } };
    expect(planRestore(many, { batchSize: 500 })[0].batches.map(b => b.length)).toEqual([500, 500, 201]);
  });

  it('rejects files that are not FinRoute backups', () => {
    expect(() => validateBackup({ hello: 1 })).toThrow('Not a FinRoute backup');
    expect(() => validateBackup({ format: 'finroute-tenant-backup', formatVersion: 2, tables: {} })).toThrow('Unsupported');
  });
});
