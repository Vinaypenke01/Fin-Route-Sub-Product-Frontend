import React, { useCallback, useEffect, useState } from 'react';
import { Bug, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';
import { listClientErrors } from '../services/masterAuthService';

const KIND_LABEL = { crash: 'Screen crash', save_failed: 'Save failed', error: 'Error' };

/** Admin: recent problems reported by operators' devices (personal data removed). */
export default function ClientErrorsPanel() {
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [open, setOpen] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await listClientErrors(150);
    setErrors(res.errors || []);
    setMessage(res.success ? '' : (res.message || 'Could not load error reports.'));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const lastDay = errors.filter(e => Date.now() - new Date(e.created_at).getTime() < 86400000).length;

  return (
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 text-xs">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Bug className="w-4 h-4 text-rose-600" />
          <h3 className="text-sm font-extrabold text-slate-900">App errors from operators</h3>
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${lastDay > 0 ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
            {lastDay} in last 24h
          </span>
        </div>
        <button type="button" onClick={load} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer" aria-label="Refresh errors">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      <p className="text-[11px] text-slate-500 mb-2">
        Crashes and saves the database refused, sent automatically by the app. Phone numbers, long numbers, other emails and Telugu text are removed before storing. Kept 90 days.
      </p>
      {message && <p className="text-rose-700 mb-2">{message}</p>}
      {errors.length === 0 && !loading ? (
        <p className="text-slate-500">No problems reported. 🎉</p>
      ) : (
        <ul className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
          {errors.map(e => (
            <li key={e.id} className="py-2">
              <button type="button" onClick={() => setOpen(open === e.id ? null : e.id)} className="w-full text-left flex items-start gap-2 cursor-pointer">
                {open === e.id ? <ChevronDown className="w-3.5 h-3.5 mt-0.5 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 mt-0.5 shrink-0" />}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap gap-x-2">
                    <span className="font-bold text-slate-900">{KIND_LABEL[e.kind] || e.kind}</span>
                    <span className="text-slate-500">{e.tenant_email || 'signed out'}</span>
                    <span className="text-slate-400">{new Date(e.created_at).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="text-slate-700 break-words">{e.message}</div>
                </div>
              </button>
              {open === e.id && (
                <div className="mt-1 ml-5 space-y-1 text-[11px] text-slate-600">
                  <div>Device: {e.device || '–'} · Screen: {e.page || '–'} · Build: {e.app_version || '–'}</div>
                  {e.detail && <pre className="whitespace-pre-wrap break-words bg-slate-50 border border-slate-200 rounded p-2 max-h-48 overflow-auto">{e.detail}</pre>}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
