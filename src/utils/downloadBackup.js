// Operator "Download my data": the same JSON format as the nightly server
// backups, so the same restore script works for both.
import {
  exportTenantTables,
  backupFileName,
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
} from '../../supabase/functions/_shared/backup.ts';

function safeName(text) {
  return String(text || 'ledger').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'ledger';
}

export async function downloadTenantBackup(tenantClient, { email, businessName, clientName } = {}) {
  const { tables, rowCounts, missing } = await exportTenantTables(tenantClient);
  const now = new Date();
  const payload = JSON.stringify({
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    createdAt: now.toISOString(),
    source: 'operator-download',
    tenant: { email, businessName, clientName },
    rowCounts,
    missingTables: missing,
    tables,
  }, null, 1);

  const blob = new Blob([payload], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `finroute-backup-${safeName(businessName || clientName)}-${backupFileName(now)}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return { rowCounts };
}
