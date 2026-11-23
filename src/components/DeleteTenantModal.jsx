import React, { useState } from 'react';
import { Trash2, X, AlertTriangle, Loader2 } from 'lucide-react';
import { deleteTenant } from '../services/masterAuthService';

/**
 * Confirmation dialog for permanently deleting a tenant. The admin must type
 * the tenant's email exactly; the server checks it again before deleting.
 */
export default function DeleteTenantModal({ tenant, onClose, onDeleted }) {
  const [typedEmail, setTypedEmail] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState(null);

  if (!tenant) return null;

  const expected = String(tenant.email || '').trim().toLowerCase();
  const matches = typedEmail.trim().toLowerCase() === expected && expected !== '';

  const handleDelete = async (e) => {
    e.preventDefault();
    if (!matches || isDeleting) return;
    setIsDeleting(true);
    setError(null);
    const res = await deleteTenant(tenant.id, typedEmail.trim());
    setIsDeleting(false);
    if (res.success) {
      onDeleted?.(tenant, res);
    } else {
      setError(res.message || 'Failed to delete tenant.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget && !isDeleting) onClose(); }}
    >
      <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200 text-xs">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 border border-red-200 flex items-center justify-center">
              <Trash2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Delete tenant</h3>
              <p className="text-[11px] text-slate-500">{tenant.client_name} · {tenant.email}</p>
            </div>
          </div>
          {!isDeleting && (
            <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer" aria-label="Close">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 space-y-1.5 mb-3">
          <div className="flex items-center gap-1.5 font-bold">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span>This cannot be undone.</span>
          </div>
          <ul className="list-disc pl-5 space-y-0.5 text-[11px] leading-relaxed">
            <li>The operator can no longer sign in.</li>
            <li>Their sign-in account in the tenant project is removed.</li>
            <li>Login details, database settings, the stored secret key and health logs are deleted from FinRoute.</li>
          </ul>
        </div>

        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 text-[11px] leading-relaxed mb-4">
          <strong>Not deleted:</strong> the tenant's own Supabase project and its ledger data. Export or delete that
          separately from the Supabase dashboard if needed. To only block access, use <strong>Suspend</strong> instead.
        </div>

        {error && (
          <div className="mb-3 p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>
        )}

        <form onSubmit={handleDelete} className="space-y-3">
          <label className="block">
            <span className="block text-slate-700 font-semibold mb-1">
              Type <span className="font-mono text-red-700">{tenant.email}</span> to confirm
            </span>
            <input
              type="text"
              autoComplete="off"
              autoFocus
              value={typedEmail}
              onChange={(e) => setTypedEmail(e.target.value)}
              disabled={isDeleting}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono focus:outline-none focus:border-red-500"
              placeholder={tenant.email}
            />
          </label>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isDeleting}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!matches || isDeleting}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              <span>{isDeleting ? 'Deleting...' : 'Delete tenant'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
