// Builds the ordered list of writes needed to restore a FinRoute backup file
// into a tenant database. Pure (no network), so it can be unit-tested.

export const RESTORE_ORDER = [
  { table: 'tenant_settings', onConflict: 'id' },
  { table: 'villages', onConflict: 'id' },
  { table: 'weeks', onConflict: 'id' },
  { table: 'customers', onConflict: 'id' },
  { table: 'payments', onConflict: 'customer_id,week_id' },
  { table: 'weekly_reconciliation', onConflict: 'week_id' },
  { table: 'loan_archive', onConflict: 'id' },
  { table: 'audit_logs', onConflict: 'id' },
  // History keeps its content but gets new ids from the target's sequence
  { table: 'change_log', onConflict: null, stripColumns: ['id'] },
];

export const BATCH_SIZE = 500;

export function validateBackup(backup) {
  if (!backup || typeof backup !== 'object') throw new Error('Not a backup file (not JSON object).');
  if (backup.format !== 'finroute-tenant-backup') throw new Error('Not a FinRoute backup file (unknown format).');
  if (backup.formatVersion !== 1) throw new Error(`Unsupported backup version ${backup.formatVersion}.`);
  if (!backup.tables || typeof backup.tables !== 'object') throw new Error('Backup has no tables.');
  return true;
}

/**
 * @returns [{ table, onConflict, batches: [rows[]], rowCount }]
 */
export function planRestore(backup, { batchSize = BATCH_SIZE } = {}) {
  validateBackup(backup);
  const plan = [];
  for (const step of RESTORE_ORDER) {
    const rows = Array.isArray(backup.tables[step.table]) ? backup.tables[step.table] : null;
    if (!rows || rows.length === 0) continue;
    const cleaned = step.stripColumns
      ? rows.map(r => {
          const copy = { ...r };
          step.stripColumns.forEach(c => delete copy[c]);
          return copy;
        })
      : rows;
    const batches = [];
    for (let i = 0; i < cleaned.length; i += batchSize) batches.push(cleaned.slice(i, i + batchSize));
    plan.push({ table: step.table, onConflict: step.onConflict, batches, rowCount: cleaned.length });
  }
  return plan;
}
