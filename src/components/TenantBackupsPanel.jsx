import React, { useCallback, useEffect, useState } from 'react';
import { DatabaseBackup, Download, Loader2, RefreshCw } from 'lucide-react';
import { listTenantBackups, getBackupDownloadUrl, runTenantBackup } from '../services/masterAuthService';

function formatSize(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function totalRows(counts) {
  return Object.values(counts || {}).reduce((s, v) => s + (Number(v) || 0), 0);
}

/** Admin: a tenant's backups (nightly + manual), download, and "Back up now". */
export default function TenantBackupsPanel({ tenant }) {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  const tenantId = tenant?.id;
  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    const res = await listTenantBackups(tenantId);
    setRuns(res.runs || []);
    if (!res.success && res.message) setMessage({ type: 'error', text: res.message });
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  const backupNow = async () => {
    setBusy(true);
    setMessage(null);
    const res = await runTenantBackup(tenant.id);
    setBusy(false);
    setMessage({ type: res.success ? 'ok' : 'error', text: res.success ? 'Backup saved.' : `Backup failed: ${res.message}` });
    load();
  };

  const download = async (run) => {
    const res = await getBackupDownloadUrl(tenant.id, run.file_path);
    if (res.success && res.url) {
      window.location.assign(res.url);
    } else {
      setMessage({ type: 'error', text: res.message || 'Could not create a download link.' });
    }
  };

  const lastOk = runs.find(r => r.status === 'success');

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2 text-xs">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <DatabaseBackup className="w-4 h-4 text-indigo-600" />
          <span className="font-bold text-slate-900">Backups</span>
          <span className="text-[11px] text-slate-500">
            {lastOk ? `Last: ${new Date(lastOk.created_at).toLocaleString('en-IN')}` : 'No successful backup yet'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={load} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer" aria-label="Refresh backups">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={backupNow}
            disabled={busy}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold cursor-pointer disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <DatabaseBackup className="w-3.5 h-3.5" />}
            <span>{busy ? 'Backing up…' : 'Back up now'}</span>
          </button>
        </div>
      </div>

      {message && (
        <div className={`p-2 rounded-lg border ${message.type === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          {message.text}
        </div>
      )}

      {runs.length === 0 && !loading ? (
        <p className="text-slate-500">No backups yet. They run every night; use "Back up now" for an immediate copy.</p>
      ) : (
        <ul className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
          {runs.slice(0, 30).map(r => (
            <li key={r.id} className="flex items-center justify-between gap-2 py-1.5">
              <div className="min-w-0">
                <span className={`font-semibold ${r.status === 'success' ? 'text-slate-800' : r.status === 'failed' ? 'text-red-700' : 'text-slate-500'}`}>
                  {new Date(r.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="text-slate-500">
                  {' · '}
                  {r.status === 'success'
                    ? `${totalRows(r.row_counts)} rows, ${formatSize(r.size_bytes)}${r.trigger === 'manual' ? ' · manual' : ''}`
                    : `${r.status}: ${r.error || ''}`}
                </span>
              </div>
              {r.status === 'success' && (
                r.available ? (
                  <button type="button" onClick={() => download(r)} className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-slate-300 hover:bg-slate-50 font-semibold cursor-pointer shrink-0">
                    <Download className="w-3 h-3" /> Download
                  </button>
                ) : (
                  <span className="text-[10px] text-slate-400 shrink-0">removed (older than retention)</span>
                )
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="text-[10.5px] text-slate-400">
        Backups contain borrower personal data. Download only when needed and store them securely. Kept: 30 daily + 12 monthly.
      </p>
    </div>
  );
}
