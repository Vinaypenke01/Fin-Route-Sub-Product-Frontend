import React, { useEffect, useMemo, useState } from 'react';
import { History, X, Search, Loader2, RefreshCw } from 'lucide-react';
import { describeChange } from '../utils/changeLog';

/**
 * Operator view of the tenant's change history (who changed what, when).
 * Reads public.change_log (tenant update 003) with the operator's session.
 */
export default function ChangeHistoryModal({ isOpen, onClose, tenantClient, customers = [], weeks = [] }) {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState('idle'); // idle | loading | ready | missing | error
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!isOpen || !tenantClient) return undefined;
    let cancelled = false;
    (async () => {
      setStatus('loading');
      const { data, error: err } = await tenantClient
        .from('change_log')
        .select('*')
        .order('changed_at', { ascending: false })
        .limit(300);
      if (cancelled) return;
      if (err) {
        const missing = err.code === '42P01' || err.code === 'PGRST205' || /does not exist|could not find/i.test(err.message || '');
        setStatus(missing ? 'missing' : 'error');
        setError(err.message || '');
        return;
      }
      setRows(data || []);
      setStatus('ready');
    })();
    return () => { cancelled = true; };
  }, [isOpen, tenantClient, reloadKey]);

  const lookup = useMemo(() => {
    const names = new Map(customers.map(c => [c.id, c.name]));
    const labels = new Map(weeks.map(w => [w.id, w.date ? `${w.label} (${w.date})` : w.label]));
    return { customerName: id => names.get(id) || null, weekLabel: id => labels.get(id) || null };
  }, [customers, weeks]);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .map(r => ({ id: r.id, ...describeChange(r, lookup) }))
      .filter(d => !q || `${d.title} ${d.subject} ${d.who} ${d.changes.map(c => `${c.label} ${c.from} ${c.to}`).join(' ')}`.toLowerCase().includes(q));
  }, [rows, lookup, query]);

  // Escape closes the window
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Change history"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between gap-2 p-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-200 flex items-center justify-center">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm">Change history</h3>
              <p className="text-[11px] text-slate-500">Every change to payments, customers, weeks and cash: who, what and when (latest 300).</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setReloadKey(k => k + 1)} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer" title="Refresh" aria-label="Refresh">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer" aria-label="Close">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-4 border-b border-slate-100">
          <label className="relative block">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by customer, week, amount or person…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-indigo-500"
            />
          </label>
        </div>

        <div className="flex-1 overflow-y-auto p-4 text-sm">
          {status === 'loading' && (
            <div className="flex items-center gap-2 text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Loading history…</div>
          )}
          {status === 'missing' && (
            <p className="text-slate-600">
              Change history isn&apos;t switched on for your database yet. Ask your administrator to apply <b>tenant update 003</b>.
            </p>
          )}
          {status === 'error' && (
            <p className="text-red-700">Couldn&apos;t load history: {error}. Check your internet connection and try Refresh.</p>
          )}
          {status === 'ready' && items.length === 0 && (
            <p className="text-slate-500">{query ? 'No changes match your search.' : 'No changes recorded yet.'}</p>
          )}
          {status === 'ready' && items.length > 0 && (
            <ul className="space-y-2">
              {items.map(d => (
                <li key={d.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span className="font-bold text-slate-900">{d.title}{d.subject ? `: ${d.subject}` : ''}</span>
                    <span className="text-[11px] text-slate-500">
                      {d.when ? d.when.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                  </div>
                  {d.changes.length > 0 && (
                    <ul className="mt-1 space-y-0.5 text-[12.5px] text-slate-700">
                      {d.changes.map(c => (
                        <li key={c.field}>
                          {c.label}: <span className="line-through text-slate-400">{c.from}</span> → <b>{c.to}</b>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-1 text-[11px] text-slate-500">by {d.who}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
